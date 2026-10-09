// Offline comparison only: prices never enter buildContextTimeline or a scorer.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const [baselineFile, priceFile, outputFile] = process.argv.slice(2)
if (!outputFile) throw Error('Usage: audit-context-refinement.mjs <frozen baseline.json> <H1 prices.json> <output.json>')
const read = file => JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'))
const baseline = read(baselineFile), price = read(priceFile)
assert.equal(baseline.usd.version, 'usd-context-memory-v6.2', 'Use the baseline frozen before v7 edits')
assert.equal(price.timeframe, 'H1')
assert.equal(baseline.source, price.source, 'Price and calendar must share a broker')
const bars = [...price.bars].sort((a, b) => a.time - b.time)
assert.equal(new Set(bars.map(b => b.time)).size, bars.length)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const server = await createServer({ root, server: { middlewareMode: true, hmr: false } })
const blocks = [
  { id: 'Mar-Jun 2025 comparison', from: '2025-03-01', to: '2025-07-01' },
  { id: 'Jul-Oct 2025 comparison', from: '2025-07-01', to: '2025-11-01' },
  { id: 'Dec16-Jan28 development audit', from: '2025-12-16', to: '2026-01-29' },
].map(b => ({ ...b, start: Date.parse(b.from), end: Date.parse(b.to) }))
const side = label => label.endsWith(' Long') ? 1 : label.endsWith(' Short') ? -1 : 0
const rawLabel = direction => direction === 'stronger' ? 'EURUSD Short' : direction === 'weaker' ? 'EURUSD Long' : 'Uncomputed'
const median = values => { const v = [...values].sort((a, b) => a - b); return v.length ? (v[Math.floor((v.length - 1) / 2)] + v[Math.floor(v.length / 2)]) / 2 : null }
const round = n => n === null ? null : +n.toFixed(3)
function forward(at, count) {
  // First complete post-publication bar. Exclude an H1 bar's pre-release minutes.
  let lo = 0, hi = bars.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (bars[mid].time * 1000 < at) lo = mid + 1; else hi = mid }
  const first = bars[lo], last = bars[lo + count - 1]
  // No borrowing an arbitrarily distant first bar across a price-history gap.
  if (!first || !last || first.time * 1000 - at > 3600000 || (last.time + 3600) * 1000 > baseline.inputUSD.asOf) return null
  for (let index = lo + 1; index < lo + count; index++) if (bars[index].time - bars[index - 1].time > 4 * 86400) return null
  return { pips: round((last.close - first.open) * 10000), firstBroker: new Date(first.time * 1000).toISOString(),
    throughBroker: new Date((last.time + 3600) * 1000).toISOString(), elapsedHours: (last.time * 1000 + 3600000 - at) / 3600000 }
}
// Faithful v1 direction, including its old USD-leg exact-cancellation fallback.
function baselineRelative(e, u) {
  if (e?.total == null || u?.result.total == null) return 'Uncomputed'
  const total = e.total - u.result.total / 4
  const deciding = Math.abs(total) < 1e-12 ? u.result.direction === 'stronger' ? -1 : u.result.direction === 'weaker' ? 1 : 0 : total
  return deciding > 0 ? 'EURUSD Long' : deciding < 0 ? 'EURUSD Short' : 'Uncomputed'
}
try {
  const load = p => server.ssrLoadModule('./src/' + p + '.ts')
  const { buildContextTimeline } = await load('scoring-system/context/usd/build-context-timeline')
  const { contextAt } = await load('scoring-system/context/usd/context-lookup')
  const { contextResultLabel } = await load('scoring-system/context/usd/usd-pair')
  const { buildEurContextTimeline } = await load('scoring-system/context/relative/eur-context-timeline')
  const { eurContextAt, relativeContext } = await load('scoring-system/context/relative/relative-context')
  const usd = buildContextTimeline(baseline.inputUSD), eur = buildEurContextTimeline(baseline.inputEUR)
  let unchangedEurSnapshots = 0
  for (const old of baseline.eur.points) {
    const current = eurContextAt(eur, old.chartAt)
    for (const key of ['total', 'members', 'coverage']) assert.deepEqual(current[key], old[key], `EUR unchanged raw ${key}`)
    unchangedEurSnapshots++
  }
  const publications = baseline.usd.points.filter(p => p.latest?.chartAt === p.chartAt)
  let unchangedSources = 0, changedNfp = 0
  const rows = []
  for (const old of publications) {
    const candidate = contextAt(usd, old.chartAt)
    assert.equal(candidate.latest.sourceId, old.latest.sourceId)
    if (old.latest.family !== 'nfp') {
      for (const key of ['total', 'usdDirection', 'strength', 'coverage', 'reduced', 'traits']) assert.deepEqual(candidate.latest[key], old.latest[key], `${old.latest.sourceId}: standalone ${key}`)
      unchangedSources++
    } else if (candidate.latest.total !== old.latest.total || candidate.latest.coverage !== old.latest.coverage) changedNfp++
    const block = blocks.find(b => old.chartAt >= b.start && old.chartAt < b.end)
    if (!block) continue
    rows.push({ block: block.id, at: old.chartAt, brokerTime: new Date(old.chartAt).toISOString(), family: old.latest.family,
      labels: { baselineUSD: rawLabel(old.result.direction), candidateUSD: contextResultLabel('EURUSD', candidate.result),
        baselineRelative: baselineRelative(eurContextAt(baseline.eur, old.chartAt), old),
        candidateRelative: relativeContext(eurContextAt(eur, old.chartAt), candidate).label,
        standaloneLatest: rawLabel(candidate.latest.usdDirection) },
      reactions: Object.fromEntries([1, 4, 24].map(n => [n, forward(old.chartAt, n)])) })
  }
  const summaries = []
  for (const block of blocks) for (const horizon of [1, 4, 24]) for (const model of ['baselineUSD', 'candidateUSD', 'baselineRelative', 'candidateRelative', 'standaloneLatest']) {
    const cohort = rows.filter(r => r.block === block.id && r.reactions[horizon])
    const directional = cohort.filter(r => side(r.labels[model]))
    const nonflat = directional.filter(r => Math.abs(r.reactions[horizon].pips) > 1e-9)
    const signed = directional.map(r => side(r.labels[model]) * r.reactions[horizon].pips)
    summaries.push({ block: block.id, horizon, model, evaluable: cohort.length, directional: directional.length,
      abstentions: cohort.length - directional.length, aligned: nonflat.filter(r => side(r.labels[model]) * r.reactions[horizon].pips > 0).length,
      nonflat: nonflat.length, alignmentPercent: nonflat.length ? round(100 * nonflat.filter(r => side(r.labels[model]) * r.reactions[horizon].pips > 0).length / nonflat.length) : null,
      meanSignedPips: signed.length ? round(signed.reduce((a, b) => a + b, 0) / signed.length) : null, medianSignedPips: round(median(signed)) })
  }
  const checkpoints = ['2025-12-16T18:00', '2025-12-24T15:30', '2026-01-09T15:30', '2026-01-15T15:30', '2026-01-19T12:00', '2026-01-22T15:30', '2026-01-28T00:00'].map(date => {
    const at = Date.parse(date + 'Z'), u = contextAt(usd, at)
    return { brokerTime: date, baseline: rawLabel(contextAt(baseline.usd, at)?.result.direction),
      candidateUSD: contextResultLabel('EURUSD', u?.result), candidateRelative: relativeContext(eurContextAt(eur, at), u).label,
      decision: u?.result.decision, total: u?.result.total, members: u?.result.members,
      fresh: usd.relationships.fresh.filter(p => p.chartAt <= at).at(-1) }
  })
  let futureRemovalChecks = 0
  for (const date of ['2025-12-16T18:00', '2026-01-19T12:00', '2026-01-22T15:30']) {
    const at = Date.parse(date + 'Z'), admitted = baseline.inputUSD.events.filter(e => e.chart_time_seconds * 1000 <= at)
    const utcCutoff = Math.max(...admitted.map(e => e.release_at))
    const truncated = buildContextTimeline({ ...baseline.inputUSD, asOf: utcCutoff, events: admitted })
    assert.deepEqual(contextAt(truncated, at), contextAt(usd, at))
    assert.deepEqual(truncated.relationships.episodes.filter(e => e.chartAt <= at), usd.relationships.episodes.filter(e => e.chartAt <= at))
    futureRemovalChecks += 2
    const admittedEur = baseline.inputEUR.events.filter(e => e.chart_time_seconds * 1000 <= at)
    const truncatedEur = buildEurContextTimeline({ ...baseline.inputEUR, asOf: Math.max(...admittedEur.map(e => e.release_at)), events: admittedEur })
    assert.deepEqual(eurContextAt(truncatedEur, at), eurContextAt(eur, at))
    futureRemovalChecks++
  }
  const roofs = blocks.map(b => {
    const old = baseline.usd.relationships.episodes.filter(e => e.chartAt >= b.start && e.chartAt < b.end)
    const candidate = usd.relationships.episodes.filter(e => e.chartAt >= b.start && e.chartAt < b.end)
    return { block: b.id, baseline: old.length, candidate: candidate.length,
      byKind: Object.fromEntries(['fresh-news', 'ism-sectors', 'weekly-labor', 'labor-inflation'].map(kind => [kind, {
        baseline: old.filter(e => e.kind === kind).length, candidate: candidate.filter(e => e.kind === kind).length }])) }
  })
  const report = { source: baseline.source, revision: baseline.revision, baselineVersion: baseline.usd.version, candidateVersion: usd.version,
    notes: ['Current stored vintage, not certified original publication vintages.', 'Automatic settings/all numerical families. Screenshots may use different saved exclusions.',
      'Blocks/horizons declared before replay; earlier historical windows have been discussed, so this is not prospective out-of-sample validation.',
      'One observation per atomic USD publication timestamp; standalone comparison uses the latest updating family selected by the existing timeline.',
      'Returns start at first complete post-release H1 open. Horizons count trading bars and can span weekends/later releases. Overlap prevents independent-significance claims.',
      'Alignment and signed price change are descriptive, without spreads, slippage, stops or an entry strategy. They do not establish a trading edge.'],
    bars: { count: bars.length, firstBroker: new Date(bars[0].time * 1000).toISOString(), lastBroker: new Date(bars.at(-1).time * 1000).toISOString() },
    checks: { unchangedNonNfpStandalonePublications: unchangedSources, unchangedEurSnapshots, changedNfpPublications: changedNfp, futureRemovalChecks }, roofs, summaries, checkpoints, rows }
  fs.writeFileSync(path.resolve(outputFile), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ candidateVersion: usd.version, checks: report.checks, roofs, summaries,
    checkpoints: checkpoints.map(({ brokerTime, baseline, candidateUSD, candidateRelative, decision, total }) => ({ brokerTime, baseline, candidateUSD, candidateRelative, decision, total })) }, null, 2))
} finally { await server.close() }
