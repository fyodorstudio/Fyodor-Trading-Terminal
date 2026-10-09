import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { history, latestRows, settings, families } from './fixtures.mjs'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false } })
try {
  const load = p => server.ssrLoadModule('./src/' + p + '.ts')
  const { updateFreshNews, freshNewsAt, lookupFreshNews, freshWindowMs } = await load('scoring-system/relationships/fresh-news')
  const { buildContextRelationships } = await load('scoring-system/relationships/build-relationships')
  const { buildContextTimeline } = await load('scoring-system/context/usd/build-context-timeline')
  const { combineContext } = await load('scoring-system/context/usd/combine-context')
  const { contextWeights } = await load('scoring-system/context/usd/policy')
  const day = 86400000, at = Date.UTC(2020, 0, 1, 12)
  const source = (family, total, chartAt = at, patch = {}) => ({ family, total, chartAt, releaseAt: chartAt - 3 * 3600000,
    sourceId: family + '/' + chartAt, sourceLabel: family, usdDirection: total === null ? 'uncomputed' : total > 0 ? 'stronger' : 'weaker',
    strength: total === null ? null : 'moderate', reduced: false, tie: false, coverage: 1, comparisonBasis: family + ':100', calibrationBasis: 'fixed-fixture-calibration', reason: '', explanation: '', changeSize: null, ...patch })
  const combine = (sources, chartAt, enabled = sources.map(s => s.family)) => combineContext(Object.fromEntries(sources.map(s => [s.family, s])), enabled, chartAt)
  const old = source('claims', -2, at - day), replacement = source('claims', -1)
  const before = combine([old], at - 1), after = combine([replacement], at)
  const latest = new Map()
  updateFreshNews(latest, before, after, at)
  const flow = freshNewsAt(latest, at)
  assert.equal(flow.direction, 'stronger', 'A still-Long but less negative report can increase USD support')
  assert.equal(flow.members[0].usdDirection, 'weaker', 'Standalone direction stays distinct')
  const expected = contextWeights.claims / 100
  assert.equal(flow.total, expected)
  assert.ok(flow.members[0].memoryRenewal < 0, 'Renewal of a negative prior strengthens its old adverse vote separately')
  const effect = flow.members[0]
  assert.ok(Math.abs(effect.replacementChange - effect.scoreChange - effect.calibrationChange - effect.memoryRenewal - effect.availabilityChange) < 1e-11)
  const renewalOnly = new Map()
  updateFreshNews(renewalOnly, before, combine([source('claims', -2)], at), at)
  assert.equal(freshNewsAt(renewalOnly, at).direction, 'uncomputed', 'An unchanged score never becomes directional fresh news from renewal alone')
  assert.notEqual(renewalOnly.get('claims').memoryRenewal, 0)
  const changedCoverage = new Map()
  updateFreshNews(changedCoverage, before, combine([source('claims', -1, at, { coverage: .8 })], at), at)
  assert.equal(changedCoverage.get('claims').change, 0, 'Unequal component coverage withholds economic comparability')
  const changedComponents = new Map()
  updateFreshNews(changedComponents, before, combine([source('claims', -1, at, { comparisonBasis: 'different-components:100' })], at), at)
  assert.equal(changedComponents.get('claims').change, 0, 'Equal total coverage cannot conceal different usable components')
  const shifted = { ...after, policy: { ...after.policy, weights: { ...after.policy.weights, claims: 20, nfp: 20 } } }
  const alternative = new Map(); updateFreshNews(alternative, before, shifted, at)
  assert.equal(freshNewsAt(alternative, at).total, expected, 'Policy reweighting is not counted as new data')
  const newer = source('claims', -.5, at + day)
  updateFreshNews(latest, combine([replacement], at + day - 1), combine([newer], at + day), at + day)
  assert.equal(latest.size, 1, 'Weekly overlapping updates replace, rather than stack')
  assert.equal(latest.get('claims').sourceId, newer.sourceId)
  const missing = source('claims', null, at + 2 * day)
  updateFreshNews(latest, combine([newer], missing.chartAt - 1), combine([missing], missing.chartAt), missing.chartAt)
  assert.equal(freshNewsAt(latest, missing.chartAt).direction, 'uncomputed', 'Missing new data never invents a disinflation or labor vote')

  const atomicAt = at + 3 * day
  const atomicSources = [source('claims', -1, atomicAt), source('gdp', null, atomicAt), source('pce', -.5, atomicAt)]
  const atomicBefore = combine([source('claims', 0, atomicAt - day), source('pce', 0, atomicAt - day)], atomicAt - 1, ['claims', 'gdp', 'pce'])
  const atomicAfter = combine(atomicSources, atomicAt)
  const points = [{ chartAt: atomicAt, result: atomicAfter, latest: atomicSources[0], update: 'Same-time publications' }]
  const relationships = buildContextRelationships(points, new Map([[atomicAt, atomicBefore]]), new Map())
  const roof = relationships.episodes.find(e => e.kind === 'fresh-news')
  assert.ok(roof); assert.equal(roof.sources.length, 3); assert.equal(roof.before, atomicBefore)
  assert.equal(roof.sources.find(s => s.family === 'gdp').change, 0)
  assert.equal(roof.strength, 'weak'); assert.equal(roof.experimental, true)
  assert.equal(relationships.fresh[0].agreeingDomains, 2, 'Only labor and inflation qualify; Uncomputed GDP supplies no domain')
  const unknownBefore = combine([], atomicAt - 1, ['claims', 'gdp', 'pce'])
  assert.equal(buildContextRelationships(points, new Map([[atomicAt, unknownBefore]]), new Map()).episodes.filter(e => e.kind === 'fresh-news').length, 0,
    'Newly available readings without comparable predecessors cannot establish an economic change roof')
  const opposingBefore = combine(['claims', 'ism', 'cpi'].map(f => source(f, 1, at - day)), at - 1)
  const opposed = combine([source('claims', 2), source('ism', 2), source('cpi', .3)], at)
  const nearCancellation = buildContextRelationships([{ chartAt: at, result: opposed }], new Map([[at, opposingBefore]]), new Map())
  const mixedRoof = nearCancellation.episodes.find(e => e.kind === 'fresh-news')
  assert.ok(mixedRoof, 'Two domains agree, but the opposing inflation change nearly cancels them')
  assert.equal(mixedRoof.decision.state, 'mixed'); assert.equal(mixedRoof.strength, 'weak', 'Roof exposes a narrow lead while the separate accumulated gate still withholds direction')
  const exact = combine([source('claims', 2), source('ism', 2), source('cpi', 2 / 7)], at)
  assert.equal(buildContextRelationships([{ chartAt: at, result: exact }], new Map([[at, opposingBefore]]), new Map()).episodes.find(e => e.kind === 'fresh-news').direction, 'uncomputed',
    'Exact cancellation is exposed without inventing a directional fresh roof')
  assert.equal(lookupFreshNews(relationships.fresh, atomicAt - 1), null)
  assert.equal(lookupFreshNews(relationships.fresh, atomicAt + freshWindowMs - 1).direction, 'weaker')
  assert.equal(lookupFreshNews(relationships.fresh, atomicAt + freshWindowMs).direction, 'uncomputed', 'Exact seven-day expiry works between precomputed stages')
  const inflationOnly = combine([source('cpi', -1), source('pce', -1)], at)
  assert.equal(buildContextRelationships([{ chartAt: at, result: inflationOnly }], new Map([[at, atomicBefore]]), new Map()).episodes.filter(e => e.kind === 'fresh-news').length, 0,
    'Two inflation families alone are one domain, not a cross-domain sequence')

  const ismAt = at + day, ism = source('ism', -.3, ismAt)
  const sectors = [source('ism', -1, at, { sourceId: 'manufacturing', role: 'Manufacturing 30%' }),
    source('ism', .5, ismAt, { sourceId: 'services', role: 'Services 70%' })]
  const ismResult = combine([ism], ismAt)
  const ismPoint = { chartAt: ismAt, result: ismResult }
  const sectorRoof = buildContextRelationships([ismPoint], new Map(), new Map([[ism.sourceId, sectors]])).episodes[0]
  assert.equal(sectorRoof.kind, 'ism-sectors'); assert.equal(sectorRoof.direction, ism.usdDirection)
  assert.deepEqual(sectorRoof.sources.map(s => s.usdDirection), ['weaker', 'stronger'])
  assert.equal(buildContextRelationships([ismPoint], new Map(), new Map([[ism.sourceId, [sectors[0]]]])).episodes.length, 0)
  assert.equal(buildContextRelationships([ismPoint], new Map(), new Map([[ism.sourceId, [sectors[0], { ...sectors[1], chartAt: ismAt + day }]]])).episodes.length, 0,
    'A later Services publication cannot produce an earlier roof')

  const claimsTimes = [at, at + 7 * day, at + 14 * day]
  const weakNfp = source('nfp', -1, at - day, { strength: 'weak' })
  const claimPoints = claimsTimes.map((time, i) => {
    const c = source('claims', 1, time, { traits: { kind: 'claims', confirmed: i === 2, streak: i + 1 } })
    return { chartAt: time, result: combine([weakNfp, c], time), latest: c }
  })
  const claimBefore = new Map(claimPoints.map(p => [p.chartAt, atomicBefore]))
  const claimsRoof = buildContextRelationships(claimPoints, claimBefore, new Map()).episodes.find(e => e.kind === 'weekly-labor')
  assert.ok(claimsRoof); assert.equal(claimsRoof.sources.length, 4)
  assert.equal(claimsRoof.sources.filter(s => s.role?.includes('Confirmation only')).length, 2)
  assert.equal(claimsRoof.after.members.length, 2, 'Three confirmations still form one Claims vote')

  const input = { events: [...history, ...latestRows], settings, families, asOf: Date.UTC(2018, 7, 1) }
  const timeline = buildContextTimeline(input)
  assert.ok(timeline.relationships.episodes.some(e => e.kind === 'ism-sectors'))
  for (const episode of timeline.relationships.episodes) assert.ok(episode.sources.every(s => s.chartAt <= episode.chartAt))
  const cutoff = latestRows.find(e => e.event_id === '840040003').release_at
  const chartCutoff = cutoff + 3 * 3600000
  const truncated = buildContextTimeline({ ...input, events: input.events.filter(e => e.release_at <= cutoff), asOf: cutoff })
  assert.deepEqual(truncated.relationships.episodes.filter(e => e.chartAt <= chartCutoff), timeline.relationships.episodes.filter(e => e.chartAt <= chartCutoff),
    'Removing every future publication leaves all earlier roofs unchanged')
  assert.deepEqual(truncated.relationships.fresh.filter(e => e.chartAt <= chartCutoff), timeline.relationships.fresh.filter(e => e.chartAt <= chartCutoff))
  assert.equal(buildContextTimeline({ ...input, families: [] }).relationships.episodes.length, 0)
  assert.equal(buildContextTimeline({ ...input, families: ['us-cpi'] }).relationships.episodes.length, 0)
  assert.deepEqual(buildContextTimeline({ ...input, events: input.events.map(e => ({ ...e, forecast: -999 })) }), timeline)
  console.log('✓ Replacement effects, same-time atomicity, expiry, non-stacking domains, ISM/Claims roofs, disabled inputs and future-removal chronology')
} finally { await server.close() }
