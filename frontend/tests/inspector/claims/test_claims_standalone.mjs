import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { reading, flat, raw, week, start } from './fixtures.mjs'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'), server: { middlewareMode: true, hmr: false } })
try {
  const { assessClaimsStandalone } = await server.ssrLoadModule('./src/scoring-system/PAIR/EURUSD/USD/CLAIMS/assessment/claims-standalone-score.ts')
  const { groupInspectorReleases } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { claimsStandaloneFeatures } = await server.ssrLoadModule('./src/scoring-system/PAIR/EURUSD/USD/CLAIMS/assessment/claims-standalone-features.ts')
  const release = values => groupInspectorReleases(reading(52, values))[0]
  const limits = Object.fromEntries(['initial-change', 'continuing-change', 'initial-trend', 'continuing-trend'].map(id => [id, [5, 10, 20]]))
  const target = release([180, 1.78, 180])
  assert.deepEqual(assessClaimsStandalone(target, flat, 'release', limits).readings.map(r => r.value), [20, 20])
  assert.equal(assessClaimsStandalone(target, flat, 'release', limits).total, 3)
  assert.deepEqual(assessClaimsStandalone(target, flat, 'trend', limits).readings.map(r => r.value), [20, 5])
  assert.equal(assessClaimsStandalone(target, flat, 'trend', limits).total, 2.2)
  const conflict = assessClaimsStandalone(release([190, 1.82, 190]), flat, 'release', limits)
  assert.equal(conflict.total, 0); assert.equal(conflict.label, 'No net bias'); assert.equal(conflict.tieBreak, null)
  const narrow = assessClaimsStandalone(release([190, 1.82, 190]), flat, 'release', limits, 61)
  assert.equal(narrow.direction, 'short'); assert.equal(narrow.strength, 'weak')
  const zero = assessClaimsStandalone(release([200, 1.8, 200]), flat, 'release', limits)
  assert.equal(zero.total, 0); assert.match(zero.explanation, /unchanged/)
  const revisedHistory = flat.map(row => row.event_id === '840140002' && row.period_seconds === (start + 50 * week) / 1000 ?
    { ...row, revised_previous: 1.7, revised_previous_raw_scaled_1e6: raw(1.7) } : row)
  const revised = assessClaimsStandalone(target, revisedHistory, 'trend', limits)
  assert.equal(revised.readings[1].inputs.actual, 1770, 'Intervening revision updates the older week inside the latest mean')
  assert.equal(revised.readings[1].value, 30)
  const future = [...revisedHistory, ...reading(53, [999, 9, 999])]
  assert.deepEqual(assessClaimsStandalone(target, future, 'trend', limits), revised)
  const badRevision = { ...target, events: target.events.map(row => row.event_id === '840140001' ?
    { ...row, revised_previous: 0, revised_previous_raw_scaled_1e6: 'bad' } : row) }
  assert.equal(assessClaimsStandalone(badRevision, flat, 'release', limits).readings[0].points, null)
  const zeroRevision = { ...target, events: target.events.map(row => row.event_id === '840140001' ?
    { ...row, revised_previous: 0, revised_previous_raw_scaled_1e6: '0' } : row) }
  assert.equal(assessClaimsStandalone(zeroRevision, flat, 'release', limits).readings[0].value, -180)
  const missing = flat.filter(row => !(row.event_id === '840140002' && row.period_seconds === (start + 49 * week) / 1000))
  assert.equal(assessClaimsStandalone(target, missing, 'trend', limits).readings[1].points, null)
  const duplicate = [...flat, { ...flat.find(row => row.event_id === '840140002' && row.period_seconds === (start + 49 * week) / 1000), value_id: 'duplicate' }]
  assert.equal(assessClaimsStandalone(target, duplicate, 'trend', limits).readings[1].points, null)
  const noAverage = { ...target, events: target.events.filter(row => row.event_id !== '840140003') }
  assert.equal(assessClaimsStandalone(noAverage, flat, 'release', limits).total, 3, 'Weekly score does not depend on the reported average')
  assert.equal(assessClaimsStandalone(noAverage, flat, 'trend', limits).readings[0].points, null)
  const forecastNoise = rows => rows.map(row => ({ ...row, forecast: -1e12, forecast_raw_scaled_1e6: 'bad', impact: 'negative' }))
  assert.deepEqual(assessClaimsStandalone({ ...target, events: forecastNoise(target.events) }, forecastNoise(flat), 'release', limits), assessClaimsStandalone(target, flat, 'release', limits))
  assert.equal(claimsStandaloneFeatures(target, flat, 'trend')['continuing-trend'].observations.length, 8)
  assert.throws(() => assessClaimsStandalone(target, flat, 'release', limits, 0), RangeError)
  console.log('PASS: independent weekly/trend calculations, revised windows, future/forecast isolation, zero/cancellation/narrow lead and missing/ambiguity gates')
} finally { await server.close() }
