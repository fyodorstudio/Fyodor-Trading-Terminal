import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { reading, history, flat, settings, raw, week, start } from './fixtures.mjs'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'), server: { middlewareMode: true, hmr: false } })
try {
  const { assessClaimsScore } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/CLAIMS/assessment/claims-score.ts')
  const { groupInspectorReleases } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { scoringSignalBinding, prepareScoringSignalHistory, scoringSignalModel } = await server.ssrLoadModule('./src/scatter-plot/inspection/scoring-signal-model.ts')
  const release = values => groupInspectorReleases(reading(52, values))[0]
  const assess = values => assessClaimsScore(release(values), flat, settings)
  const low = release([180, 1.78, 180]), lowScore = assessClaimsScore(low, flat, settings)
  assert.equal(lowScore.label, 'EURUSD Short'); assert.equal(lowScore.total, 3)
  assert.equal(lowScore.strength, 'strong'); assert.equal(lowScore.supportingGroups, 2)
  assert.deepEqual(lowScore.readings.map(r => r.value), [20, 20, 20])
  assert.equal(assess([220, 1.82, 220]).label, 'EURUSD Long')
  assert.equal(assess([180, 1.8, 180]).strength, 'moderate', 'Two initial-claims signals are one group')
  assert.equal(assess([200, 1.8, 200]).label, 'Uncomputed')
  const tie = assess([205, 1.805, 195])
  assert.equal(tie.total, 0); assert.equal(tie.label, 'EURUSD Short')
  assert.equal(tie.tieBreak.id, 'initial-trend'); assert.equal(tie.strength, 'weak')
  const missing = { ...low, events: low.events.filter(e => e.event_id !== '840140003') }
  assert.equal(assessClaimsScore(missing, flat, settings).label, 'EURUSD Short')
  assert.equal(assessClaimsScore(missing, flat, settings).strength, 'weak')
  const onlyContinuing = { ...low, events: low.events.filter(e => e.event_id === '840140002') }
  assert.equal(assessClaimsScore(onlyContinuing, flat, settings).label, 'EURUSD Short')
  assert.equal(assessClaimsScore(onlyContinuing, flat, settings).strength, 'weak')
  assert.equal(assessClaimsScore({ ...low, events: [] }, flat).label, 'Uncomputed')
  for (const patch of [{ familyId: 'jobs' }, { country: 'CA' }, { currency: 'EUR' }]) assert.equal(assessClaimsScore({ ...low, ...patch }, flat), null)
  console.log('✓ Inverse USD direction, native million/thousand conversion, unequal votes, overlap-aware evidence, tie and missing-data policies')

  const change = (id, patch) => ({ ...low, events: low.events.map(e => e.event_id === id ? { ...e, ...patch } : e) })
  const revised = assessClaimsScore(change('840140002', { revised_previous: 1.84, revised_previous_raw_scaled_1e6: raw(1.84) }), flat, settings)
  assert.equal(revised.readings[1].value, 30); assert.equal(revised.readings[1].inputs.baseline, 1810)
  const zeroRevision = assessClaimsScore(change('840140001', { revised_previous: 0, revised_previous_raw_scaled_1e6: '0' }), flat, settings)
  assert.equal(zeroRevision.readings[2].value, -30)
  assert.equal(assessClaimsScore(change('840140001', { revised_previous: 210, revised_previous_raw_scaled_1e6: 'broken' }), flat).readings[2].points, null)
  const previousNoise = low.events.map(e => ({ ...e, previous: 99999, previous_raw_scaled_1e6: raw(99999) }))
  assert.deepEqual(assessClaimsScore({ ...low, events: previousNoise }, flat, settings), lowScore, 'Previous cannot fabricate weekly history')
  const lastInitial = flat.find(e => e.event_id === '840140001' && e.period_seconds === (start + 51 * week) / 1000)
  assert.equal(assessClaimsScore(low, flat.filter(e => e !== lastInitial), settings).readings[2].points, null)
  assert.equal(assessClaimsScore(low, [...flat, { ...lastInitial, value_id: 'ambiguous' }], settings).readings[2].points, null)
  // A later malformed revision for the same reference cannot silently fall back.
  assert.equal(assessClaimsScore(low, [...flat, { ...lastInitial, value_id: 'latest-invalid', release_at: low.releaseAt - 1000, actual: null }], settings).readings[2].points, null)
  assert.equal(assessClaimsScore(change('840140002', { period_seconds: low.events[0].period_seconds }), flat).readings[1].points, null)
  const wrongAverage = assessClaimsScore(change('840140003', { period_seconds: low.events[0].period_seconds - week / 1000 }), flat)
  assert.equal(wrongAverage.readings[0].points, null); assert.equal(wrongAverage.readings[2].points, null)
  for (const patch of [{ unit: 1 }, { multiplier: 2 }, { actual: -1 }, { actual: NaN }, { actual: null },
    { actual_raw_scaled_1e6: 'bad' }, { actual_raw_scaled_1e6: '9007199254740993' },
    { actual: 1e308, actual_raw_scaled_1e6: null }, { period_seconds: 0 },
    { period_seconds: low.releaseAt / 1000 }, { period_seconds: low.events[0].period_seconds + 1 },
    { availability: 'not-returned-by-latest-query' }, { country_code: 'CA' }, { time_mode: 1 }])
    assert.equal(assessClaimsScore(change('840140001', patch), flat).readings[2].points, null)
  const duplicate = { ...low, events: [...low.events, { ...low.events[0], value_id: 'duplicate-current' }] }
  assert.equal(assessClaimsScore(duplicate, flat).readings[2].points, null)
  assert.equal(assessClaimsScore({ ...low, timingUncertain: true }, flat).label, 'Uncomputed')
  assert.equal(assessClaimsScore(groupInspectorReleases(reading(10))[0], history, settings).label, 'Uncomputed', 'Manual cutoffs retain the history gate')
  assert.deepEqual(assessClaimsScore(low, [...flat, ...flat], settings), lowScore)
  assert.deepEqual(assessClaimsScore(low, [...flat, ...reading(53, [999, 99, 999]), ...low.events], settings), lowScore)
  const forecastNoise = e => ({ ...e, forecast: -1e12, forecast_raw_scaled_1e6: 'bad', impact: 'negative' })
  assert.deepEqual(assessClaimsScore({ ...low, events: low.events.map(forecastNoise) }, flat.map(forecastNoise), settings), lowScore)
  assert.throws(() => assessClaimsScore(low, flat, { 'initial-week': [1, 1, 2] }), RangeError)
  console.log('✓ Consecutive weekly references, lagged continuing claims, revision/zero handling, ambiguity/native/timing gates, no future/forecast inputs')

  const binding = scoringSignalBinding('claims'), events = [...history, ...low.events, ...reading(53)]
  const prepared = prepareScoringSignalHistory(events, low.releaseAt + week, binding)
  for (const definition of binding.signals) {
    const model = scoringSignalModel(prepared, binding, definition.id, low.id)
    const score = assessClaimsScore(low, events).readings.find(r => r.id === definition.id)
    for (const key of ['value', 'points', 'size', 'sampleCount', 'limits', 'reason', 'inputs']) assert.deepEqual(model.inspection.signal[key], score[key])
    const custom = scoringSignalModel(prepared, binding, definition.id, low.id, settings)
    assert.equal(custom.inspection.signal.points, assessClaimsScore(low, events, settings).readings.find(r => r.id === definition.id).points)
    assert.deepEqual(scoringSignalModel(prepared.filter(p => p.release.releaseAt <= low.releaseAt), binding, definition.id, low.id).inspection.signal, model.inspection.signal)
  }
  console.log('✓ Scorer/Scatter automatic and custom magnitude parity, thousands axis and historical replay')
} finally { await server.close() }
