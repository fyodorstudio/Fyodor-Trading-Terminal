import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { reading, history, withMonths, raw, settings, ids } from './fixtures.mjs'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'), server: { middlewareMode: true, hmr: false } })
try {
  const { assessRetailScore } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/RETAIL/assessment/retail-score.ts')
  const { supportsRetailScore } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/RETAIL/assessment/retail-features.ts')
  const { retailScoreVersion, retailSignals, retailSeriesIds } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/RETAIL/policy/retail-policy.ts')
  const { groupInspectorReleases } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { scoringSignalBinding, prepareScoringSignalHistory, scoringSignalModel } = await server.ssrLoadModule('./src/scatter-plot/inspection/scoring-signal-model.ts')
  const select = values => groupInspectorReleases(reading(2026, 6, values))[0]
  const flat = withMonths([.2, .2, .2])
  const hot = select([1, 1, 1, 1, 3]), cool = select([.1, .1, .1, .1, 3])
  const hotScore = assessRetailScore(hot, flat), coolScore = assessRetailScore(cool, flat)
  assert.equal(retailScoreVersion, 'retail-eurusd-demand-pace-v1')
  assert.deepEqual([...retailSeriesIds], ids)
  assert.deepEqual(retailSignals.map(s => s.weight), [60, 25, 15])
  assert.equal(hotScore.label, 'EURUSD Short'); assert.equal(hotScore.strength, 'strong')
  assert.equal(coolScore.label, 'EURUSD Long'); assert.equal(coolScore.strength, 'strong')
  assert.match(coolScore.explanation, /growing.*below.*recent pace/)
  assert.equal(hotScore.total, hotScore.readings.reduce((sum, r) => sum + r.points * r.weight, 0) / 100)
  const contraction = select([-.1, -.1, -.1, -.1, 3]), contractionHistory = withMonths([-1, -2, -3])
  const contractionScore = assessRetailScore(contraction, contractionHistory)
  assert.equal(contractionScore.label, 'EURUSD Long')
  assert.deepEqual(contractionScore.readings.map(r => r.value), [-.1, -.1, -.1])
  assert.match(contractionScore.explanation, /fell.*smaller contraction/)
  assert.equal(assessRetailScore(select([0, 0, 0, 0, 3]), contractionHistory).label, 'Uncomputed')
  assert.equal(assessRetailScore(select(), flat).label, 'Uncomputed')
  const headlineBoom = select([4, 5, -.2, -.2, 100])
  assert.equal(assessRetailScore(headlineBoom, flat, settings).label, 'EURUSD Long', 'A headline boom need not outweigh underlying weakness')
  const tied = assessRetailScore(select([-.2, .2, .25, .2, 3]), flat, settings)
  assert.deepEqual(tied.readings.map(r => r.points), [1, 0, -4])
  assert.equal(tied.total, 0); assert.equal(tied.tieBreak.id, 'control-pace')
  assert.equal(tied.label, 'EURUSD Short'); assert.equal(tied.strength, 'weak')
  const conflict = assessRetailScore(select([.2, .2, .25, .05, 3]), flat, settings)
  assert.equal(conflict.label, 'EURUSD Short'); assert.equal(conflict.strength, 'weak')
  const broadOnly = { ...cool, events: cool.events.filter(e => e.event_id === '840020021') }
  assert.equal(assessRetailScore(broadOnly, flat).label, 'EURUSD Long')
  assert.equal(assessRetailScore(broadOnly, flat).strength, 'weak')
  const headlineOnly = { ...hot, events: hot.events.filter(e => e.event_id === '840020010') }
  assert.equal(assessRetailScore(headlineOnly, flat).label, 'Uncomputed')
  assert.equal(assessRetailScore(null, flat), null)
  for (const patch of [{ familyId: 'gdp' }, { currency: 'EUR' }, { country: 'EU' }]) assert.equal(supportsRetailScore({ ...cool, ...patch }), false)
  console.log('✓ Retail underlying priority, growing-but-slowing bias, contraction floor, conflicts, ties, reduced inputs and no fabricated direction')

  const future = reading(2026, 7, [99, 99, 99, 99, 99])
  assert.deepEqual(assessRetailScore(cool, [...flat, ...cool.events, ...future]), coolScore)
  assert.deepEqual(assessRetailScore(cool, [...flat, ...flat]), coolScore)
  const noise = e => ({ ...e, forecast: -1e9, forecast_raw_scaled_1e6: 'bad' })
  assert.deepEqual(assessRetailScore({ ...cool, events: cool.events.map(noise) }, flat.map(noise)), coolScore)
  const changeControl = patch => ({ ...cool, events: cool.events.map(e => e.event_id === '840020012' ? { ...e, ...patch } : e) })
  const revised = changeControl({ revised_previous: .5, revised_previous_raw_scaled_1e6: raw(.5) })
  const revisedScore = assessRetailScore(revised, flat)
  assert.equal(revisedScore.readings[0].value, -.2)
  assert.equal(revisedScore.readings[0].inputs.baseline, .3)
  assert.match(revisedScore.readings[0].inputs.baselineLabel, /nearest month revised/)
  assert.equal(assessRetailScore(changeControl({ revised_previous: .5, revised_previous_raw_scaled_1e6: 'bad' }), flat).readings[0].points, null)
  const zeroRevision = assessRetailScore(changeControl({ revised_previous: 0, revised_previous_raw_scaled_1e6: '0' }), flat)
  assert.equal(zeroRevision.readings[0].value, -.033333333333, 'An explicitly supplied zero revision must be used')
  const early = groupInspectorReleases(reading(2015, 4, [1, 1, 1, 1, 3]))[0]
  assert.equal(assessRetailScore(early, history, settings).label, 'Uncomputed', 'Manual limits retain history gate')
  assert.equal(assessRetailScore({ ...cool, timingUncertain: true }, flat).label, 'Uncomputed')
  const drop = flat.filter(e => e.event_id !== '840020012' || e.period_seconds !== Date.UTC(2026, 4, 1) / 1000)
  assert.equal(assessRetailScore(cool, drop).readings[0].points, null)
  const duplicateHistory = [...flat, { ...flat.find(e => e.event_id === '840020012' && e.period_seconds === Date.UTC(2026, 5, 1) / 1000), value_id: 'ambiguous-history' }]
  assert.equal(assessRetailScore(cool, duplicateHistory).readings[0].points, null)
  for (const patch of [{ unit: 0 }, { multiplier: 1 }, { actual: null }, { actual: NaN }, { actual_raw_scaled_1e6: 'broken' },
    { actual_raw_scaled_1e6: '9007199254740993' }, { availability: 'not-returned-by-latest-query' }, { country_code: 'CA' }, { period_seconds: 0 }])
    assert.equal(assessRetailScore(changeControl(patch), flat).readings[0].points, null)
  const duplicate = { ...cool, events: [...cool.events, { ...cool.events.find(e => e.event_id === '840020012'), value_id: 'ambiguous-current' }] }
  assert.equal(assessRetailScore(duplicate, flat).readings[0].points, null)
  assert.equal(assessRetailScore(changeControl({ period_seconds: Date.UTC(2026, 5, 1) / 1000 }), flat).label, 'Uncomputed')
  const supportOnlyChange = { ...cool, events: cool.events.map(e => ['840020011', '840020025'].includes(e.event_id) ? { ...e, actual: 100, actual_raw_scaled_1e6: raw(100) } : e) }
  const changed = assessRetailScore(supportOnlyChange, flat)
  for (const key of ['readings', 'total', 'direction', 'strength', 'changeSize']) assert.deepEqual(changed[key], coolScore[key])
  assert.throws(() => assessRetailScore(cool, flat, { 'control-pace': [1, 1, 2] }), RangeError)
  console.log('✓ Revision/native/reference/continuity gates, supporting-only readings, forecast exclusion and strictly earlier calibration')

  const binding = scoringSignalBinding('retail'), events = [...flat, ...cool.events, ...future]
  const signalHistory = prepareScoringSignalHistory(events, Date.UTC(2026, 8, 1), binding)
  for (const definition of retailSignals) {
    const model = scoringSignalModel(signalHistory, binding, definition.id, cool.id)
    const score = coolScore.readings.find(r => r.id === definition.id)
    for (const key of ['value', 'points', 'size', 'sampleCount', 'limits', 'reason', 'inputs']) assert.deepEqual(model.inspection.signal[key], score[key])
    const custom = scoringSignalModel(signalHistory, binding, definition.id, cool.id, settings)
    assert.equal(custom.inspection.signal.points, assessRetailScore(cool, events, settings).readings.find(r => r.id === definition.id).points)
    const truncated = signalHistory.filter(entry => entry.release.releaseAt <= cool.releaseAt)
    assert.deepEqual(scoringSignalModel(truncated, binding, definition.id, cool.id).inspection.signal, model.inspection.signal)
  }
  console.log('✓ Automatic/custom Scatter Plot parity and future-removal replay for every Retail signal')
} finally { await server.close() }
