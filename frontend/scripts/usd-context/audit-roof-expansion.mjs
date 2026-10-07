// Frozen dataset replay. No price fit, forecast input, external notes or preference writes.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { createServer } from 'vite'

const [inputFile, outputFile] = process.argv.slice(2)
if (!outputFile || fs.existsSync(outputFile)) throw Error('Supply frozen input and a new output path; existing reports are preserved.')
const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'))
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false } })
try {
  const load = p => server.ssrLoadModule('./src/usd-context/' + p + '.ts')
  const { buildContextTimeline } = await load('core/build-context-timeline')
  const { relationshipVersion } = await load('sequences/core/contracts')
  const { relationshipPairs } = await load('sequences/core/relationship-registry')
  const { roofSupport, roofResultLabel } = await load('sequences/core/relationship-support')
  const { prepareRoofAnchors, createRoofPlan, projectRoofPlan } = await load('sequences/chart/roof-plan')
  const start = performance.now(), timeline = buildContextTimeline(input.inputUSD)
  const builtMs = performance.now() - start
  const roofs = timeline.relationships.episodes, pairCounts = {}, states = {}
  const resultObjects = new Set(timeline.points.map(p => p.result))
  for (const roof of roofs) {
    assert.ok(roof.sources.every(s => s.chartAt <= roof.chartAt), 'No future publication')
    assert.ok(roof.sources.some(s => s.chartAt === roof.chartAt) || ['labor-inflation', 'weekly-labor', 'fresh-news'].includes(roof.kind))
    assert.ok(resultObjects.has(roof.after), 'Roof reuses a canonical snapshot instead of adding votes')
    if (roof.kind.endsWith('relationship')) {
      assert.equal(new Set(roof.sources.map(s => s.family)).size, 2)
      const id = roof.sources.map(s => s.family).sort().join('+')
      pairCounts[id] = (pairCounts[id] ?? 0) + 1
    }
    const support = roofSupport(roof)
    states[support.state] = (states[support.state] ?? 0) + 1
  }
  for (const pair of relationshipPairs) assert.ok(pairCounts[[...pair.families].sort().join('+')] > 0, `${pair.label} has a historical eligible snapshot`)
  const claimsAt = Date.UTC(2026, 8, 3, 15, 30) // broker +3; 19:30 Asia/Jakarta
  const pair = roofs.find(r => r.kind === 'release-relationship' && r.chartAt === claimsAt && r.sources.some(s => s.family === 'claims') && r.sources.some(s => s.family === 'ism'))
  assert.ok(pair, 'ISM + Claims is now registered at Claims publication')
  const ism = pair.sources.find(s => s.family === 'ism')
  assert.equal(ism.chartAt, Date.UTC(2026, 8, 1, 17)) // 21:00 Jakarta
  assert.ok(ism.coverage < 1, 'Manufacturing-only monthly assembly remains partial')
  const servicesAt = Date.UTC(2026, 8, 3, 17)
  const fresh = timeline.relationships.fresh.find(r => r.chartAt === servicesAt)?.members.find(s => s.family === 'ism')
  assert.ok(fresh?.participants?.length === 2, 'Services compares its own preceding release; Manufacturing remains separately budgeted')
  assert.ok(fresh.participants.every(s => s.comparable))
  for (const p of fresh.participants) assert.ok(p.assessment.components.length && p.referenceMonth !== null)
  const hour = 3600000, first = Math.floor(timeline.points[0].chartAt / hour) * hour
  const last = Math.max(...roofs.map(r => r.chartAt))
  const bars = Array.from({ length: Math.ceil((last - first) / hour) + 1 }, (_, i) => ({ time: (first + i * hour) / 1000 }))
  const sourceIds = [...new Set(roofs.flatMap(r => r.sources.map(s => s.sourceId)))]
  const markers = sourceIds.map(id => ({ release: { id }, symbol: 'cloud' }))
  const planStarted = performance.now(), anchors = prepareRoofAnchors(roofs, bars, 'H1', markers, true, roofs.length)
  const plan = createRoofPlan(anchors, 3, true), planMs = performance.now() - planStarted
  const panStarted = performance.now(); let maximumPositioned = 0, maximumOverflow = 0
  for (let i = 0; i < 100; i++) {
    const layout = projectRoofPlan(plan, -3 * bars.length * i / 100, 1600)
    maximumPositioned = Math.max(maximumPositioned, layout.positioned.length)
    maximumOverflow = Math.max(maximumOverflow, layout.overflow.length)
    assert.ok(layout.positioned.length <= 3 * (Math.ceil(1600 / 178) + 4), 'Chart display remains bounded by three lanes, not history count')
  }
  const panMs = performance.now() - panStarted
  const report = { source: input.source, revision: input.revision, relationshipVersion,
    scope: 'Frozen current stored vintage; automatic magnitude settings, no price-fit or original-vintage certification.',
    builtMs: Math.round(builtMs), usdPoints: timeline.points.length, roofCount: roofs.length, pairCounts, states,
    headlessProjection: { syntheticHourlyBars: bars.length, anchors: anchors.length, planMs: Math.round(planMs), pans: 100,
      panMs: Math.round(panMs), maximumPositioned, maximumOverflow, caveat: 'Pure projection benchmark; browser painting and manual UI performance remain unverified.' },
    september: { claimsActivation: new Date(pair.chartAt).toISOString(), label: roofResultLabel(pair),
      sources: pair.sources.map(s => ({ family: s.family, at: new Date(s.chartAt).toISOString(), total: s.total, coverage: s.coverage })),
      servicesActivation: new Date(servicesAt).toISOString(), freshChange: fresh.change, incomingChange: fresh.scoreChange,
      sectorChanges: fresh.participants.map(s => ({ sector: s.sector, change: s.change, comparable: s.comparable, at: new Date(s.chartAt).toISOString() })) },
    timing: 'Chart clocks are broker time; source releaseAt remains separate.' }
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
} finally { await server.close() }
