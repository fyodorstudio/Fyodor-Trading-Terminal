import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import { createServer } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [cpiFile, nfpFile, ismFile, retailFile, claimsFile, output] = process.argv.slice(2)
if (!output) throw new Error('Usage: after pnpm build, node scripts/audit-usd-context.mjs <cpi.json> <nfp.json> <ism.json> <retail.json> <claims.json> <output-prefix>')
const read = file => JSON.parse(fs.readFileSync(path.resolve(file), 'utf8').replace(/^\uFEFF/, ''))
const calendars = [cpiFile, nfpFile, ismFile, retailFile, claimsFile].map(read)
assert.equal(new Set(calendars.map(c => c.source_id)).size, 1, 'Snapshots must belong to the same broker.')
const events = [...new Map(calendars.flatMap(c => c.events).map(e => [e.value_id, e])).values()]
const input = { events, families: ['jobs', 'us-cpi', 'claims', 'ism-manufacturing', 'ism-services', 'retail'],
  settings: { cpi: {}, nfp: {}, services: {}, manufacturing: {}, retail: {}, claims: {} }, asOf: Math.min(Date.now(), Math.max(...events.map(e => e.release_at ?? 0))) }
const server = await createServer({ root, server: { middlewareMode: true, hmr: false } })
let timeline, replays, calculationMs, cpiInput, cpiExpected
try {
  const { buildContextTimeline } = await server.ssrLoadModule('./src/usd-context/core/build-context-timeline.ts')
  const { contextAt } = await server.ssrLoadModule('./src/usd-context/core/context-lookup.ts')
  const { compareCpiPublication } = await server.ssrLoadModule('./src/usd-context/core/publication-comparison.ts')
  const { calculateCpiRelease } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/CPI/runtime/cpi-release-analysis.ts')
  const { groupInspectorReleases } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const start = performance.now(); timeline = buildContextTimeline(input); calculationMs = performance.now() - start
  const publications = groupInspectorReleases(events).filter(r => input.families.includes(r.familyId))
  // Canonical stored audit parity: layer and indexing preserve original vote totals/grades.
  const baselineFiles = ['cpi-v3-refined-audit.json', 'nfp-v2-design-audit.json', 'ism-v2-design-audit.json', 'retail-v1-design-audit.json', 'claims-v1-design-audit.json']
  const checked = {}
  for (const [i, file] of baselineFiles.entries()) {
    const rows = read(path.join(root, '../storage/data', file)).rows
    const family = ['cpi', 'nfp', 'ism', 'retail', 'claims'][i]
    let count = 0
    for (const row of rows) {
      if (row.releaseAt > input.asOf) continue
      const publication = publications.find(r => r.releaseAt === row.releaseAt && (family === 'cpi' ? r.familyId === 'us-cpi' : family === 'nfp' ? r.familyId === 'jobs' : family === 'retail' ? r.familyId === 'retail' : family === 'claims' ? r.familyId === 'claims' : r.familyId === row.family))
      if (!publication) continue
      const point = contextAt(timeline, publication.chartTime * 1000)
      const current = point.result.members.find(m => m.family === family), expected = family === 'cpi' ? row.v3 : row.assessment
      assert.equal(current.total, expected.total); assert.equal(current.strength, expected.strength)
      assert.equal(current.changeSize, expected.changeSize)
      assert.equal(current.usdDirection, expected.direction === 'long' ? 'weaker' : expected.direction === 'short' ? 'stronger' : 'uncomputed')
      count++
    }
    assert.ok(count > 0, `No ${family} baseline rows were checked.`); checked[family] = count
  }
  replays = ['2025-08-12', '2025-09-11', '2026-06-17', '2026-07-16', '2026-08-03', '2026-08-05', '2026-08-07', '2026-08-12', '2026-08-14', '2026-09-16'].map(date => {
    const release = publications.find(r => new Date(r.releaseAt).toISOString().slice(0, 10) === date && (!date.startsWith('2025') || r.familyId === 'us-cpi'))
    assert.ok(release)
    const at = release.chartTime * 1000, point = contextAt(timeline, at)
    const replay = buildContextTimeline({ ...input, events: events.filter(e => e.release_at !== null && e.release_at <= release.releaseAt), asOf: release.releaseAt })
    assert.deepEqual(contextAt(replay, at), point, 'Future removal must preserve the full snapshot.')
    if (release.familyId === 'us-cpi') assert.deepEqual(compareCpiPublication(replay, release, input.asOf), compareCpiPublication(timeline, release, input.asOf), 'CPI v4 before/after replay parity')
    const before = contextAt(timeline, at - 1)
    assert.notEqual(before?.latest.sourceId, release.id)
    return { date, direction: point.result.direction, total: point.result.total, strength: point.result.strength,
      explanation: point.result.explanation, update: point.update, members: point.result.members.map(m =>
        ({ family: m.family, direction: m.usdDirection, status: m.status, contribution: m.contribution, releaseAt: m.releaseAt })) }
  })
  const selectedCpi = publications.find(r => r.familyId === 'us-cpi' && new Date(r.releaseAt).toISOString().slice(0, 10) === '2025-08-12')
  cpiInput = { release: selectedCpi, events, settings: {} }; cpiExpected = calculateCpiRelease(cpiInput)
  console.log(JSON.stringify({ baselineParity: checked, calculationMs: Math.round(calculationMs), replays: replays.map(({ date, direction, strength }) => ({ date, direction, strength })) }, null, 2))
} finally { await server.close() }
const assets = path.join(root, 'dist/assets')
const bundle = fs.readdirSync(assets).find(name => /^context-timeline\.worker-.*\.js$/.test(name))
assert.ok(bundle, 'Build the frontend first.')
const wrapper = `const {parentPort,workerData}=require('node:worker_threads');globalThis.self=globalThis;
self.postMessage=result=>parentPort.postMessage(result);import(workerData.bundle).then(()=>parentPort.on('message',data=>self.onmessage({data})));`
const worker = new Worker(wrapper, { eval: true, workerData: { bundle: pathToFileURL(path.join(assets, bundle)).href } })
let pulses = 0
const timer = setInterval(() => pulses++, 1), start = performance.now()
try {
  const reply = await new Promise((resolve, reject) => { worker.once('message', resolve); worker.once('error', reject); worker.postMessage({ id: 1, input }) })
  assert.equal(reply.error, undefined); assert.deepEqual(reply.result, timeline); assert.ok(pulses > 0)
  const report = { source: calendars[0].source_id, sourceRevisions: calendars.map(c => c.revision), version: timeline.version,
    readings: events.length, snapshots: timeline.points.length, calculationMs: Math.round(calculationMs),
    workerMs: Math.round(performance.now() - start), mainThreadPulses: pulses, replays, timeline }
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true })
  fs.writeFileSync(`${output}.json`, JSON.stringify(report, null, 2), 'utf8')
  fs.writeFileSync(`${output}.md`, ['# USD context chronological audit', '', `Broker: ${report.source}. Source revisions: ${report.sourceRevisions.join(', ')}.`,
    'Reconstructed stored history, not certified original-release vintages. No price outcomes or forecasts enter the policy.', '',
    `Readings ${report.readings}; snapshots ${report.snapshots}; pure build ${report.calculationMs} ms; worker ${report.workerMs} ms; event-loop pulses ${pulses}.`,
    'Stored scorer parity, June/July/August/September future-removal replay and actual built-worker parity passed. Weights: CPI 40%, NFP 30%, Claims 10%, ISM 10%, Retail Sales 10%. Claims expires at 14 days; other votes at 45 days. CPI v4 shares Raycaster inputs and exact publication snapshots. Inspector marker filters do not select context inputs.', '',
    '| Date | USD bias | Evidence | Score | Latest update |', '| --- | --- | --- | --- | --- |',
    ...replays.map(r => `| ${r.date} | ${r.direction} | ${r.strength} | ${r.total} | ${r.update} |`), ''].join('\n'), 'utf8')
  console.log(JSON.stringify({ snapshots: report.snapshots, workerMs: report.workerMs, mainThreadPulses: pulses, workerParity: true }))
} finally { clearInterval(timer); await worker.terminate() }

// Smoke-test the production CPI v4 standalone worker against canonical v3.1.
const cpiBundle = fs.readdirSync(assets).find(name => /^cpi-release\.worker-.*\.js$/.test(name))
assert.ok(cpiBundle)
const cpiWorker = new Worker(wrapper, { eval: true, workerData: { bundle: pathToFileURL(path.join(assets, cpiBundle)).href } })
try {
  const reply = await new Promise((resolve, reject) => { cpiWorker.once('message', resolve); cpiWorker.once('error', reject); cpiWorker.postMessage({ id: 1, input: cpiInput }) })
  assert.equal(reply.error, undefined); assert.deepEqual(reply.result, cpiExpected)
  console.log('CPI v4 production standalone worker matches v3.1.')
} finally { await cpiWorker.terminate() }
