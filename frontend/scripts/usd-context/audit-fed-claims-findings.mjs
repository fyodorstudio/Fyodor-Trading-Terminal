import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import { createServer } from 'vite'

const [snapshotPath, prefix] = process.argv.slice(2)
if (!snapshotPath || !prefix) throw new Error('Usage: node scripts/usd-context/audit-fed-claims-findings.mjs <snapshot.json> <output-prefix>')
const snapshot = JSON.parse(fs.readFileSync(path.resolve(snapshotPath), 'utf8'))
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const server = await createServer({ root, server: { middlewareMode: true, hmr: false } })
const iso = value => new Date(value).toISOString()
const jakartaDate = value => iso(value + 7 * 3600000).slice(0, 10)
const fedDates = ['2026-09-17', '2026-07-30', '2026-06-18', '2026-04-30', '2026-03-19', '2026-01-29',
  '2025-12-11', '2025-10-30', '2025-09-18', '2025-07-31', '2025-06-19', '2025-05-08', '2025-03-20']
const claimsDates = ['2025-03-13', '2025-03-20', '2025-03-27', '2025-04-03']
let report, input, expected
try {
  const load = file => server.ssrLoadModule('./src/' + file + '.ts')
  const { groupInspectorReleases } = await load('inspector/inspector-data')
  const { observedReading } = await load('scoring-system/shared/core/historical-release-signals')
  const { buildContextTimeline } = await load('scoring-system/context/usd/build-context-timeline')
  const { contextAt } = await load('scoring-system/context/usd/context-lookup')
  const { contextPriority, contextSourceFamilies } = await load('scoring-system/context/usd/policy')
  const { assessClaimsScore } = await load('scoring-system/PAIR/EURUSD/USD/CLAIMS/assessment/claims-score')
  const { assessFedScore } = await load('scoring-system/PAIR/EURUSD/USD/FED/assessment/fed-score')
  const { scorePublication, publicationFamily, contextSeriesIds } = await load('scoring-system/context/usd/score-publication')
  const asOf = Date.parse('2026-10-06T00:00:00Z')
  input = { events: snapshot.events, families: contextSourceFamilies(contextPriority), asOf,
    settings: { cpi: {}, nfp: {}, services: {}, manufacturing: {}, claims: {}, retail: {}, pce: {}, ppi: {}, gdp: {} } }
  const start = performance.now()
  expected = buildContextTimeline(input)
  const buildMs = performance.now() - start
  console.log(JSON.stringify({ stage: 'timeline', buildMs: Math.round(buildMs), points: expected.points.length }))
  const releases = groupInspectorReleases(snapshot.events.filter(e => observedReading(e) && e.release_at <= asOf))
  const fed = fedDates.map(date => {
    const candidates = releases.filter(r => r.familyId === 'fomc' && jakartaDate(r.releaseAt) === date)
    assert.equal(candidates.length, 1, date + ' unique Fed meeting')
    const release = candidates[0], at = release.chartTime * 1000
    const point = contextAt(expected, at), action = assessFedScore(release)
    const horizons = [1, 4, 14, 24, 48, 168].map(hours => ({ hours, point: contextAt(expected, at + hours * 3600000) }))
    return { date, releaseAt: iso(release.releaseAt), brokerAt: iso(at), action, point, horizons,
      nextUpdates: expected.points.filter(p => p.chartAt > at && p.chartAt <= at + 7 * 86400000 && p.latest?.chartAt === p.chartAt)
        .map(p => ({ chartAt: iso(p.chartAt), releaseAt: iso(p.latest.releaseAt), family: p.latest.family, direction: p.result.direction, update: p.update })) }
  })
  const claims = claimsDates.map(date => {
    const candidates = releases.filter(r => r.familyId === 'claims' && jakartaDate(r.releaseAt) === date)
    assert.equal(candidates.length, 1, date + ' unique Claims publication')
    const release = candidates[0], assessment = assessClaimsScore(release, snapshot.events)
    assert.deepEqual(assessment, assessClaimsScore(release, snapshot.events.filter(e => e.release_at < release.releaseAt)), date + ' claims future removal')
    return { date, assessment }
  })
  // Replay selected difficult meetings with every later publication physically removed.
  for (const date of ['2025-10-30', '2026-03-19', '2026-04-30']) {
    const row = fed.find(r => r.date === date), cutoff = Date.parse(row.releaseAt)
    const replay = buildContextTimeline({ ...input, asOf: cutoff, events: snapshot.events.filter(e => e.release_at <= cutoff) })
    assert.deepEqual(contextAt(replay, Date.parse(row.brokerAt)), row.point, date + ' context future removal')
  }
  const inventory = snapshot.events.filter(e => observedReading(e) && e.release_at <= asOf && contextSeriesIds.includes(e.event_id))
  const sources = groupInspectorReleases(inventory).filter(r => publicationFamily(r.familyId))
  const profile = {}
  for (const release of sources) {
    const started = performance.now()
    scorePublication(release, inventory, input.settings)
    const family = publicationFamily(release.familyId)
    const row = profile[family] ??= { count: 0, totalMs: 0, maxMs: 0 }
    const elapsed = performance.now() - started
    row.count++; row.totalMs += elapsed; row.maxMs = Math.max(row.maxMs, elapsed)
  }
  const april = releases.filter(r => r.releaseAt >= Date.parse('2026-04-01') && r.releaseAt < Date.parse('2026-04-10') && publicationFamily(r.familyId))
    .map(r => ({ family: r.familyId, releaseAt: iso(r.releaseAt), brokerAt: iso(r.chartTime * 1000), context: contextAt(expected, r.chartTime * 1000)?.result.direction }))
  report = { source: snapshot.source_id, revision: snapshot.revision ?? null, version: expected.version,
    scope: 'All eight Raycaster families enabled; automatic component magnitudes. No saved browser settings or price bars.',
    buildMs, points: expected.points.length, inventoryRows: inventory.length, profile, fed, claims, april,
    futureRemovalChecks: { fed: 3, claims: claims.length } }
} finally { await server.close() }

const assets = path.join(root, 'dist/assets')
const bundle = fs.readdirSync(assets).find(name => /^context-timeline\.worker-.*\.js$/.test(name))
if (!bundle) throw new Error('Build frontend first to produce the context worker.')
const wrapper = `const {parentPort,workerData}=require('node:worker_threads');globalThis.self=globalThis;
self.postMessage=result=>parentPort.postMessage(result);import(workerData.bundle).then(()=>parentPort.on('message',data=>self.onmessage({data})));`
const worker = new Worker(wrapper, { eval: true, workerData: { bundle: pathToFileURL(path.join(assets, bundle)).href } })
let pulses = 0
const timer = setInterval(() => pulses++, 10), started = performance.now()
try {
  const reply = await new Promise((resolve, reject) => {
    worker.once('message', resolve); worker.once('error', reject); worker.postMessage({ id: 1, input })
  })
  assert.equal(reply.error, undefined)
  assert.deepEqual(reply.result, expected, 'Production context worker parity')
  assert.ok(pulses > 0, 'Main event loop stays active during calculation')
  report.worker = { roundtripMs: performance.now() - started, mainThreadPulses: pulses, parity: true }
} finally { clearInterval(timer); await worker.terminate() }
fs.writeFileSync(path.resolve(prefix + '.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ buildMs: Math.round(report.buildMs), worker: report.worker, profile: report.profile,
  fed: report.fed.map(r => ({ date: r.date, action: r.action.action, direction: r.point.result.direction,
    strength: r.point.result.strength, total: r.point.result.total })),
  claims: report.claims.map(r => ({ date: r.date, label: r.assessment.label, strength: r.assessment.strength,
    total: r.assessment.total, readings: r.assessment.readings.map(s => ({ id: s.id, value: s.value, points: s.points })) })),
  april: report.april, futureRemovalChecks: report.futureRemovalChecks }, null, 2))
