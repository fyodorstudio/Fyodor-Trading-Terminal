import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import { createServer } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [cpiFile, nfpFile, ismFile, output] = process.argv.slice(2)
if (!output) throw new Error('Usage: after pnpm build, node scripts/audit-usd-context.mjs <cpi.json> <nfp.json> <ism.json> <output-prefix>')
const read = file => JSON.parse(fs.readFileSync(path.resolve(file), 'utf8').replace(/^\uFEFF/, ''))
const calendars = [cpiFile, nfpFile, ismFile].map(read)
assert.equal(new Set(calendars.map(c => c.source_id)).size, 1, 'Snapshots must belong to the same broker.')
const events = [...new Map(calendars.flatMap(c => c.events).map(e => [e.value_id, e])).values()]
const input = { events, families: ['jobs', 'us-cpi', 'ism-manufacturing', 'ism-services'],
  settings: { cpi: {}, nfp: {}, services: {}, manufacturing: {} }, asOf: Math.min(Date.now(), Math.max(...events.map(e => e.release_at ?? 0))) }
const server = await createServer({ root, server: { middlewareMode: true, hmr: false } })
let timeline, august, calculationMs
try {
  const { buildContextTimeline } = await server.ssrLoadModule('./src/usd-context/core/build-context-timeline.ts')
  const { contextAt } = await server.ssrLoadModule('./src/usd-context/core/context-lookup.ts')
  const { groupInspectorReleases } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const start = performance.now(); timeline = buildContextTimeline(input); calculationMs = performance.now() - start
  const publications = groupInspectorReleases(events).filter(r => ['jobs', 'us-cpi', 'ism-services', 'ism-manufacturing'].includes(r.familyId))
  // Canonical stored audit parity: layer and indexing preserve original vote totals/grades.
  const baselineFiles = ['cpi-v3-refined-audit.json', 'nfp-v2-design-audit.json', 'ism-v2-design-audit.json']
  const checked = {}
  for (const [i, file] of baselineFiles.entries()) {
    const rows = read(path.join(root, '../storage/data', file)).rows
    const family = ['cpi', 'nfp', 'ism'][i]
    let count = 0
    for (const row of rows) {
      if (row.releaseAt > input.asOf) continue
      const publication = publications.find(r => r.releaseAt === row.releaseAt && (family === 'cpi' ? r.familyId === 'us-cpi' : family === 'nfp' ? r.familyId === 'jobs' : r.familyId === row.family))
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
  august = ['2026-08-03', '2026-08-05', '2026-08-07', '2026-08-12'].map(date => {
    const release = publications.find(r => new Date(r.releaseAt).toISOString().slice(0, 10) === date)
    assert.ok(release)
    const at = release.chartTime * 1000, point = contextAt(timeline, at)
    const replay = buildContextTimeline({ ...input, events: events.filter(e => e.release_at !== null && e.release_at <= release.releaseAt), asOf: release.releaseAt })
    assert.deepEqual(contextAt(replay, at), point, 'Future removal must preserve the full snapshot.')
    const before = contextAt(timeline, at - 1)
    assert.notEqual(before?.latest.sourceId, release.id)
    return { date, direction: point.result.direction, total: point.result.total, strength: point.result.strength,
      explanation: point.result.explanation, update: point.update, members: point.result.members.map(m =>
        ({ family: m.family, direction: m.usdDirection, status: m.status, contribution: m.contribution, releaseAt: m.releaseAt })) }
  })
  console.log(JSON.stringify({ baselineParity: checked, calculationMs: Math.round(calculationMs), august }, null, 2))
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
    workerMs: Math.round(performance.now() - start), mainThreadPulses: pulses, august, timeline }
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true })
  fs.writeFileSync(`${output}.json`, JSON.stringify(report, null, 2), 'utf8')
  fs.writeFileSync(`${output}.md`, ['# USD context chronological audit', '', `Broker: ${report.source}. Source revisions: ${report.sourceRevisions.join(', ')}.`,
    'Reconstructed stored history, not certified original-release vintages. No price outcomes or forecasts enter the policy.', '',
    `Readings ${report.readings}; snapshots ${report.snapshots}; pure build ${report.calculationMs} ms; worker ${report.workerMs} ms; event-loop pulses ${pulses}.`,
    'Stored scorer parity, August future-removal replay and actual built-worker parity passed.', '',
    '| Date | USD bias | Evidence | Score | Latest update |', '| --- | --- | --- | --- | --- |',
    ...august.map(r => `| ${r.date} | ${r.direction} | ${r.strength} | ${r.total} | ${r.update} |`), ''].join('\n'), 'utf8')
  console.log(JSON.stringify({ snapshots: report.snapshots, workerMs: report.workerMs, mainThreadPulses: pulses, workerParity: true }))
} finally { clearInterval(timer); await worker.terminate() }
