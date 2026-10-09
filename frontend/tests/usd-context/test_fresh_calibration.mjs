import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false } })
try {
  const load = p => server.ssrLoadModule('./src/' + p + '.ts')
  const { combineContext } = await load('scoring-system/context/usd/combine-context')
  const { updateFreshNews, freshNewsAt } = await load('scoring-system/relationships/fresh-news')
  const { compareSourceSupport } = await load('scoring-system/relationships/compare-source-support')
  const { buildContextRelationships } = await load('scoring-system/relationships/build-relationships')
  const at = Date.UTC(2025, 0, 20, 12), day = 86400000
  const source = (family, value, points, limits, clock) => ({ family, sourceId: `${family}/${clock}`, sourceLabel: family,
    chartAt: clock, releaseAt: clock, total: points, coverage: 1, reduced: false, tie: false,
    usdDirection: points > 0 ? 'stronger' : points < 0 ? 'weaker' : 'uncomputed', strength: 'moderate',
    reason: '', explanation: '', changeSize: null, comparisonBasis: 'release:feature:100',
    calibrationBasis: JSON.stringify(limits), components: [{ id: 'feature', value, points, limits, weight: 100 }] })
  const combine = (sources, clock) => combineContext(Object.fromEntries(sources.map(s => [s.family, s])), sources.map(s => s.family), clock)
  const old = source('claims', .25, 2, [.1, .3, .4], at - 7 * day)
  const driftOnly = source('claims', .25, 3, [.1, .2, .3], at)
  const before = combine([old], at - 1), after = combine([driftOnly], at)
  const latest = new Map(); updateFreshNews(latest, before, after, at)
  const effect = latest.get('claims')
  assert.equal(effect.change, 0, 'An unchanged feature cannot become fresh news because quantile boundaries moved')
  assert.equal(effect.calibrationChange, .1)
  assert.equal(effect.memoryRenewal, .1)
  assert.equal(effect.replacementChange, .2)
  assert.equal(freshNewsAt(latest, at).direction, 'uncomputed')
  const actualChange = source('claims', .35, 4, [.1, .2, .3], at)
  updateFreshNews(latest, before, combine([actualChange], at), at)
  const real = latest.get('claims')
  assert.equal(real.change, .1)
  assert.equal(real.calibrationChange, .1)
  assert.ok(Math.abs(real.replacementChange - real.change - real.calibrationChange - real.memoryRenewal - real.availabilityChange) < 1e-12)
  // Older feature is larger even though its original magnitude was smaller.
  const oldLarger = source('claims', .4, 1, [.5, .6, .7], at - day)
  const newSmaller = source('claims', .3, 3, [.1, .2, .3], at)
  updateFreshNews(latest, combine([oldLarger], at - 1), combine([newSmaller], at), at)
  assert.equal(latest.get('claims').change, -.1, 'Common calibration respects feature deterioration despite a rising raw magnitude score')
  assert.equal(freshNewsAt(latest, at).direction, 'weaker')
  const unknown = { ...driftOnly, components: undefined, calibrationBasis: undefined }
  assert.equal(compareSourceSupport(old, unknown).previousAtCurrentCalibration, null)
  const tiedLimits = source('claims', .3, 4, [.2, .2, .2], at)
  assert.equal(compareSourceSupport(old, tiedLimits).previousAtCurrentCalibration, 4, 'Automatic tied quantiles remain valid')
  const missing = { ...driftOnly, components: [{ ...driftOnly.components[0], limits: null }] }
  assert.equal(compareSourceSupport(old, missing).previousAtCurrentCalibration, null)
  const changedStage = { ...actualChange, comparisonBasis: 'revision:feature:100' }
  updateFreshNews(latest, before, combine([changedStage], at), at)
  assert.equal(latest.get('claims').change, 0, 'A changed comparison definition is not a comparable economic update')
  const oldRetail = source('retail', .25, 2, [.1, .3, .4], at - day)
  const newRetail = source('retail', .25, 3, [.1, .2, .3], at)
  const bothBefore = combine([old, oldRetail], at - 1), bothAfter = combine([driftOnly, newRetail], at)
  const relationships = buildContextRelationships([{ chartAt: at, result: bothAfter, latest: driftOnly, update: 'Claims + Retail' }],
    new Map([[at, bothBefore]]), new Map())
  assert.equal(relationships.episodes.filter(e => e.kind === 'fresh-news').length, 0,
    'Calibration drift across two economic domains still cannot qualify a fresh roof')
  console.log('✓ Common-calibration support changes, no drift-only Roof, opposite raw-score counterexample, exact decomposition and provenance gates')
} finally { await server.close() }
