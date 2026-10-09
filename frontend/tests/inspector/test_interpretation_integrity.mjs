import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { history, nfp, cpi } from '../usd-context/fixtures.mjs'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false } })
try {
  const load = p => server.ssrLoadModule('./src/' + p + '.ts')
  const { groupInspectorReleases: group } = await load('inspector/inspector-data')
  const { calibrateHistoricalSignal: calibrate, usableSignal } = await load('scoring-system/shared/core/historical-release-signals')
  const { nfpV2Features } = await load('scoring-system/PAIR/EURUSD/USD/NFP/assessment/nfp-score-v2')
  const { monthlyComparison } = await load('scoring-system/PAIR/EURUSD/USD/NFP/assessment/monthly-comparison')
  const { cpiV3Features } = await load('scoring-system/PAIR/EURUSD/USD/CPI/assessment/cpi-score-v3')
  const { assessEurScore } = await load('scoring-system/PAIR/EURUSD/EUR/assessment/eur-score')

  const release = group(nfp(2018, 4, [20, 4.3, 62.3, .1, 34.2]))[0]
  const unemployment = release.events.find(e => e.event_id === '840030015')
  for (const revised_previous_raw_scaled_1e6 of ['bad', '9007199254740992']) {
    const patch = { revised_previous: null, revised_previous_raw_scaled_1e6 }
    assert.equal(monthlyComparison({ ...unemployment, ...patch }, history).value, null,
      'A populated invalid raw revision cannot silently restore stale Previous')
    const changed = { ...release, events: release.events.map(e => ({ ...e, ...patch })) }
    const features = nfpV2Features(changed, history).features
    assert.equal(features.hiring.value, null)
    assert.equal(features.wages.value, null)
    assert.equal(features.unemployment.value, null)
  }
  const revisedOnly = { ...unemployment, previous: null, previous_raw_scaled_1e6: null,
    revised_previous: 4.4, revised_previous_raw_scaled_1e6: '4400000' }
  assert.equal(monthlyComparison(revisedOnly, history, true).value, .1,
    'A verified valid revised baseline does not require the superseded Previous')
  assert.equal(monthlyComparison(revisedOnly, history.filter(e => e.event_id !== unemployment.event_id), true).value, null,
    'A valid supplied revision still cannot invent a missing reference month')

  const inflation = group(cpi(2018, 4, [.1, .1, 3]))[0]
  const badInflation = { ...inflation, events: inflation.events.map(e => ({ ...e,
    actual_raw_scaled_1e6: '9007199254740992', previous_raw_scaled_1e6: '9007199254740991' })) }
  assert.ok(Object.values(cpiV3Features(badInflation, history)).every(f => f.value === null),
    'CPI cannot accept unsafe raw rates even when the raw difference is small')
  assert.equal(usableSignal(Infinity).value, null, 'Invalid arithmetic is unavailable, never Extreme')
  assert.equal(usableSignal(NaN).value, null, 'NaN must not become a measured zero')
  assert.equal(calibrate({ value: Infinity, reason: '' }, Array(24).fill(.1)).points, null)
  const contaminated = calibrate({ value: .1, reason: '' }, [...Array(23).fill(.1), Infinity, NaN])
  assert.equal(contaminated.sampleCount, 23, 'Invalid samples do not satisfy the calibration minimum')
  assert.equal(contaminated.points, null)
  for (const value of [.05, .15, .3, 1]) {
    const samples = Array.from({ length: 30 }, (_, i) => .01 * (i + 1))
    assert.equal(calibrate({ value: -value, reason: '' }, samples).points,
      -calibrate({ value, reason: '' }, samples).points, 'Magnitude calibration is sign-symmetric')
  }

  const eurRow = (id, m, actual) => ({ value_id: `${id}/${m}`, event_id: id, event_code: id, name: id,
    currency: 'EUR', country_code: 'EU', country_name: 'Euro area', unit: 0, multiplier: 0, digits: 1,
    time_mode: 0, importance: 'high', impact: 'none', revision: 0,
    period_seconds: Date.UTC(2015, m, 1) / 1000, release_at: Date.UTC(2015, m + 1, 15),
    server_time_seconds: Date.UTC(2015, m + 1, 15) / 1000, actual, previous: 51, forecast: null, revised_previous: null })
  const eurHistory = Array.from({ length: 49 }, (_, m) => ['999500001', '999500002', '999500003']
    .filter(id => id !== '999500003' || m >= 36).map(id => eurRow(id, m, 51 + m % 3 * .2))).flat()
  const pmi = group(eurHistory).findLast(r => r.familyId === 'euro-pmi')
  const assessed = assessEurScore(pmi, eurHistory)
  assert.equal(assessed.readings.find(r => r.id === 'composite').points, null)
  assert.equal(assessed.readings.find(r => r.id === 'services').weight, 100,
    'A valid but uncalibrated composite must not hide a calibrated fallback sector')
  assert.equal(assessed.coverage, 1)
  assert.ok(assessed.readings.filter(r => r.weight > 0).length === 1, 'PMI still casts one vote')
  console.log('✓ Revision provenance, revised-only baselines, finite arithmetic, safe CPI precision and calibrated PMI fallback')
} finally { await server.close() }
