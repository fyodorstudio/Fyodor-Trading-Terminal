import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const [usdFile, eurFile, priceFile, from, through, output] = process.argv.slice(2)
if (!output) throw new Error('Usage: audit-release-sequence.mjs <USD snapshot> <EUR snapshot> <H1 snapshot> <YYYY-MM-DD> <YYYY-MM-DD> <output.json>')
const read = file => JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'))
const usd = read(usdFile), eur = read(eurFile), price = read(priceFile)
const start = Date.parse(from + 'T00:00:00Z'), end = Date.parse(through + 'T23:59:59.999Z')
assert.ok(Number.isFinite(start) && Number.isFinite(end) && start <= end)
assert.equal(price.timeframe, 'H1')
assert.equal(price.symbol, 'EURUSD')
assert.equal(usd.source_id, eur.source_id, 'Currency inventories must belong to the same broker')
assert.equal(usd.source_id, price.source_id, 'Bars and calendars must belong to the same broker')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const server = await createServer({ root, server: { middlewareMode: true, hmr: false } })
const settings = { cpi: {}, nfp: {}, services: {}, manufacturing: {}, retail: {}, claims: {}, pce: {}, ppi: {}, gdp: {} }
const bias = direction => direction === 'stronger' ? 'EURUSD Short' : direction === 'weaker' ? 'EURUSD Long' : 'Uncomputed'
const bars = [...price.bars].sort((a, b) => a.time - b.time)
assert.equal(new Set(bars.map(b => b.time)).size, bars.length, 'Duplicate bar timestamps')
function reaction(chartTime) {
  const hour = Math.floor(chartTime / 3600) * 3600
  const index = bars.findIndex(b => b.time === hour)
  const previous = bars[index - 1]
  if (index < 1 || previous.time + 3600 !== hour) return { unavailable: 'Missing contiguous pre-event H1 bar' }
  const baseline = previous.close
  const moves = Object.fromEntries([1, 4, 24].map(n => {
    const last = bars[index + n - 1]
    return [n + 'TradingBars', last ? { pips: +(10000 * (last.close - baseline)).toFixed(1),
      throughBroker: new Date((last.time + 3600) * 1000).toISOString(),
      elapsedHours: (last.time + 3600 - chartTime) / 3600 } : null]
  }))
  return { baseline, baselineAtBroker: new Date(hour * 1000).toISOString(), ...moves }
}

try {
  const load = p => server.ssrLoadModule('./src/' + p + '.ts')
  const { buildContextTimeline } = await load('scoring-system/context/usd/build-context-timeline')
  const { contextAt } = await load('scoring-system/context/usd/context-lookup')
  const { contextPriority, contextSourceFamilies } = await load('scoring-system/context/usd/policy')
  const { scorePublication, contextSeriesIds, publicationFamily } = await load('scoring-system/context/usd/score-publication')
  const { groupInspectorReleases } = await load('inspector/inspector-data')
  const { buildEurContextTimeline } = await load('scoring-system/context/relative/eur-context-timeline')
  const { eurContextAt, relativeContext } = await load('scoring-system/context/relative/relative-context')
  const { eurPolicies, eurNumericSeriesIds } = await load('scoring-system/PAIR/EURUSD/EUR/policy/eur-policies')
  const { assessEurScore } = await load('scoring-system/PAIR/EURUSD/EUR/assessment/eur-score')
  const { assessEcbRateAction } = await load('scoring-system/PAIR/EURUSD/EUR/assessment/ecb-rate-action')
  const usdAssessors = {}
  for (const [family, folder, file, exported] of [
    ['gdp', 'GDP', 'gdp-score', 'assessGdpScore'], ['pce', 'PCE', 'pce-score', 'assessPceScore'],
    ['claims', 'CLAIMS', 'claims-score', 'assessClaimsScore'], ['jobs', 'NFP', 'nfp-score-v2', 'assessNfpScoreV2'],
    ['ism-manufacturing', 'ISM', 'ism-score-v3', 'assessIsmScoreV3'],
    ['ism-services', 'ISM', 'ism-score-v3', 'assessIsmScoreV3'],
  ]) usdAssessors[family] = (await load(`scoring-system/PAIR/EURUSD/USD/${folder}/assessment/${file}`))[exported]
  const utcInventory = usd.events.filter(e => e.release_at !== null && e.release_at <= end)
  const eurInventory = eur.events.filter(e => e.release_at !== null && e.release_at <= end)
  const usdInput = { events: utcInventory, families: contextSourceFamilies(contextPriority), settings, asOf: end }
  const eurInput = { events: eurInventory, families: eurPolicies.map(p => p.family), settings: {}, asOf: end }
  const usdTimeline = buildContextTimeline(usdInput), eurTimeline = buildEurContextTimeline(eurInput)
  const numerical = [...utcInventory.filter(e => contextSeriesIds.includes(e.event_id)),
    ...eurInventory.filter(e => eurNumericSeriesIds.includes(e.event_id) || ['999010006', '999010007', '999010015'].includes(e.event_id))]
  const releases = groupInspectorReleases(numerical).filter(r => r.chartTime * 1000 >= start && r.chartTime * 1000 <= end)
    .sort((a, b) => a.chartTime - b.chartTime || a.id.localeCompare(b.id))
  const rows = releases.map(release => {
    const chartAt = release.chartTime * 1000
    const usdPoint = contextAt(usdTimeline, chartAt), eurPoint = eurContextAt(eurTimeline, chartAt)
    const standalone = publicationFamily(release.familyId) ? scorePublication(release, utcInventory, settings) :
      release.familyId === 'ecb' ? assessEcbRateAction(release) : assessEurScore(release, eurInventory)
    const assessment = usdAssessors[release.familyId]?.(release, utcInventory)
    return { id: release.id, family: release.familyId, currency: release.currency,
      publicationUtc: new Date(release.releaseAt).toISOString(), chartBroker: new Date(chartAt).toISOString(),
      standalone, assessment, usdContext: { label: bias(usdPoint?.result.direction), strength: usdPoint?.result.strength,
        total: usdPoint?.result.total, policy: usdPoint?.result.policy, members: usdPoint?.result.members },
      relativeContext: relativeContext(eurPoint, usdPoint),
      facts: release.events.map(e => ({ id: e.event_id, name: e.name, actual: e.actual,
        previous: e.previous, revisedPrevious: e.revised_previous, unit: e.unit, multiplier: e.multiplier,
        referencePeriod: e.period_seconds, valueId: e.value_id })), reaction: reaction(release.chartTime) }
  })
  // The stored later inventory must not influence these earlier states.
  let futureRemovalChecks = 0
  const samples = [releases[0], releases[Math.floor(releases.length / 2)], releases.at(-1)]
  const checked = new Set()
  for (const point of samples) {
    if (!point) continue
    const at = point.releaseAt, chartAt = point.chartTime * 1000
    if (checked.has(at)) continue
    checked.add(at)
    const u = buildContextTimeline({ ...usdInput, asOf: at, events: utcInventory.filter(e => e.release_at <= at) })
    const e = buildEurContextTimeline({ ...eurInput, asOf: at, events: eurInventory.filter(e => e.release_at <= at) })
    assert.deepEqual(contextAt(u, chartAt), contextAt(usdTimeline, chartAt))
    assert.deepEqual(eurContextAt(e, chartAt), eurContextAt(eurTimeline, chartAt))
    futureRemovalChecks += 2
  }
  const report = { source: usd.source_id, revisions: { usd: usd.revision, eur: eur.revision }, from, through,
    scope: 'All numerical USD/EUR families; automatic magnitudes; no live filter overrides.',
    price: { source: price.source_id, symbol: price.symbol, timeframe: price.timeframe, observedAt: price.observed_at, generation: price.source_generation,
      clock: price.clock, note: 'Baseline is preceding H1 close. Release-containing bar includes pre-publication minutes. 4/24 trading-bar returns can span weekends and later releases; elapsedHours is explicit. Price is audit-only.' },
    futureRemovalChecks, rows }
  fs.writeFileSync(path.resolve(output), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ ...report, rows: rows.map(r => ({ family: r.family, chartBroker: r.chartBroker,
    standalone: r.standalone?.sourceLabel ? { label: bias(r.standalone.usdDirection), score: r.standalone.total, evidence: r.standalone.strength } :
      { label: r.standalone?.label, score: r.standalone?.total, evidence: r.standalone?.strength },
    usd: r.usdContext.label, relative: r.relativeContext.label, reaction: r.reaction })) }, null, 2))
} finally { await server.close() }
