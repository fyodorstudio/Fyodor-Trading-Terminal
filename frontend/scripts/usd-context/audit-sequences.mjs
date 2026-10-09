import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { createServer } from 'vite'

const [snapshotFile, outputFile, asOfDay = '2026-10-07'] = process.argv.slice(2)
if (!outputFile) throw new Error('Usage: audit-sequences.mjs <USD snapshot.json> <output.json> [YYYY-MM-DD]')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const snapshot = JSON.parse(fs.readFileSync(path.resolve(snapshotFile), 'utf8'))
const asOf = Date.parse(asOfDay + 'T23:59:59.999Z')
assert.ok(Number.isFinite(asOf))
const referenceName = `.sequence-reference-${process.pid}.ts`
const referencePath = path.join(root, 'src/scoring-system/context/usd', referenceName)
const reference = execFileSync('git', ['show', 'HEAD:frontend/src/scoring-system/context/usd/build-context-timeline.ts'], { cwd: root, encoding: 'utf8' })
// Exclusive creation and exact-file cleanup leave the shared checkout intact.
fs.writeFileSync(referencePath, reference, { encoding: 'utf8', flag: 'wx' })
const server = await createServer({ root, server: { middlewareMode: true, hmr: false } })
try {
  const load = p => server.ssrLoadModule('./src/' + p)
  const { buildContextTimeline } = await load('scoring-system/context/usd/build-context-timeline.ts')
  const { buildContextTimeline: referenceTimeline } = await load('scoring-system/context/usd/' + referenceName)
  const { contextPriority, contextSourceFamilies } = await load('scoring-system/context/usd/policy.ts')
  const { lookupFreshNews } = await load('scoring-system/relationships/fresh-news.ts')
  const settings = { cpi: {}, nfp: {}, claims: {}, services: {}, manufacturing: {}, retail: {}, pce: {}, ppi: {}, gdp: {} }
  const input = { events: snapshot.events, settings, families: contextSourceFamilies(contextPriority), asOf }
  const timeline = buildContextTimeline(input), original = referenceTimeline(input)
  assert.deepEqual(timeline.points, original.points, 'Every original context point, direction, contribution and update must remain identical')
  assert.deepEqual(timeline.enabled, original.enabled); assert.equal(timeline.excludedTiming, original.excludedTiming)
  const knownNow = Math.max(...snapshot.events.filter(e => e.release_at != null && e.release_at <= asOf)
    .map(e => (e.chart_time_seconds ?? e.server_time_seconds ?? 0) * 1000))
  const episodes = timeline.relationships.episodes.filter(e => e.chartAt <= knownNow)
  assert.ok(episodes.every(e => e.sources.every(s => s.chartAt <= e.chartAt)), 'No later endpoint in any roof')
  const cutoffChecks = []
  for (const date of ['2025-02-27', '2025-03-03', '2025-03-05', '2025-08-12', '2025-12-31', '2026-06-17']) {
    const end = Date.parse(date + 'T23:59:59.999Z')
    const sample = episodes.filter(e => e.chartAt <= end && e.sources.some(s => s.chartAt === e.chartAt)).at(-1)
    if (!sample) continue
    const cutoff = Math.max(...sample.sources.map(s => s.releaseAt))
    const replay = buildContextTimeline({ ...input, asOf: cutoff, events: input.events.filter(e => e.release_at != null && e.release_at <= cutoff) })
    assert.deepEqual(replay.relationships.episodes.filter(e => e.chartAt <= sample.chartAt), timeline.relationships.episodes.filter(e => e.chartAt <= sample.chartAt))
    assert.deepEqual(lookupFreshNews(replay.relationships.fresh, sample.chartAt), lookupFreshNews(timeline.relationships.fresh, sample.chartAt))
    cutoffChecks.push({ requestedDay: date, roofAtBroker: new Date(sample.chartAt).toISOString(), cutoffUtc: new Date(cutoff).toISOString(), passed: true })
  }
  const febMar = episodes.filter(e => e.chartAt >= Date.parse('2025-02-27T00:00:00Z') && e.chartAt < Date.parse('2025-03-08T00:00:00Z'))
    .map(e => ({ kind: e.kind, knownAtBroker: new Date(e.chartAt).toISOString(), direction: e.direction, strength: e.strength,
      mainDirection: e.after.direction, mainTotal: e.after.total,
      sources: e.sources.map(s => ({ family: s.family, standalone: s.usdDirection, change: s.change, role: s.role })) }))
  const report = { source: snapshot.source_id, storedRevision: snapshot.revision, asOf: asOfDay, contextVersion: timeline.version,
    unchangedContextPoints: timeline.points.length, pointsSha256: createHash('sha256').update(JSON.stringify(timeline.points)).digest('hex'),
    knownRoofs: episodes.length, kinds: Object.fromEntries(['ism-sectors', 'labor-inflation', 'weekly-labor', 'fresh-news'].map(kind => [kind, episodes.filter(e => e.kind === kind).length])),
    publicationEndpointsVerified: episodes.reduce((sum, e) => sum + e.sources.length, 0), cutoffChecks, febMar }
  fs.writeFileSync(path.resolve(outputFile), JSON.stringify(report, null, 2) + '\n', 'utf8')
  console.log(JSON.stringify({ ...report, febMar: `${febMar.length} dated snapshots saved` }, null, 2))
} finally { await server.close(); fs.unlinkSync(referencePath) }
