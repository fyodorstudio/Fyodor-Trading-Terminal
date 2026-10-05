import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const server = await createServer({ root: rootDir, server: { middlewareMode: true } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT', 'fetch']
const previous = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys.slice(0, 7)) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const roots = []
const mount = (Component, props) => {
  const container = document.createElement('div'); document.body.appendChild(container)
  const root = createRoot(container); roots.push(root)
  return { container, render: (next = props) => React.act(async () => root.render(React.createElement(Component, next))) }
}

try {
  const { assessCpiScoreV2, cpiScoreV2Version, supportsCpiV2 } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/CPI/assessment/cpi-score-v2.ts')
  const { groupInspectorReleases, defaultInspectorPreferences, inspectorStorageKey, readInspectorPreferences } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { assessCpiMagnitudeScore } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/CPI/assessment/cpi-magnitude-score.ts')
  const { magnitudeDistribution } = await server.ssrLoadModule('./src/inspector/magnitude/magnitude-distribution.ts')
  const { exportWorkspace, restoreWorkspace } = await server.ssrLoadModule('./src/workspace-portability/workspace-snapshot.ts')
  assert.equal(cpiScoreV2Version, 'cpi-eurusd-level-trend-v2')
  const ids = ['840030005', '840030006', '840030007', '840030008']
  const raw = (value) => value === null ? null : String(Math.round(value * 1e6))
  const reading = (year, referenceMonth, values, prior) => {
    const at = Date.UTC(year, referenceMonth + 1, 12, 12, 30)
    const period = Date.UTC(year, referenceMonth, 1) / 1000
    return ids.map((id, i) => ({ value_id: `${period}:${id}`, event_id: id, name: id,
      currency: 'USD', country_code: 'US', country_name: 'United States', event_code: id,
      server_time_seconds: at / 1000 + 10800, chart_time_seconds: at / 1000 + 10800, release_at: at,
      period_seconds: period, revision: 0, time_mode: 0, importance: 'high', impact: 'none', availability: 'observed',
      unit: 1, multiplier: 0, digits: 1, actual: values[i], previous: prior[i], forecast: 999, revised_previous: -999,
      actual_raw_scaled_1e6: raw(values[i]), previous_raw_scaled_1e6: raw(prior[i]),
    }))
  }
  // Synthetic earlier history exercises the independent derived calibration.
  // The final four core months and latest readings reconstruct the discussed
  // August case, without conditioning the scorer on EURUSD price outcomes.
  const history = []
  for (let i = 0; i < 138; i++) {
    const year = 2015 + Math.floor(i / 12), month = i % 12
    history.push(...reading(year, month, [.1 + (i % 4) * .1, .1 + ((i + 1) % 4) * .1, 3, 3 + (i % 3) * .1],
      [.2, .2, 3, 3 + ((i + 2) % 3) * .1]))
  }
  const replace = (month, values, prior) => {
    const period = Date.UTC(2026, month, 1) / 1000
    for (let i = history.length - 1; i >= 0; i--) if (history[i].period_seconds === period) history.splice(i, 1)
    history.push(...reading(2026, month, values, prior))
  }
  replace(3, [.6, .4, 3, 2.8], [.3, .3, 3.1, 2.9])
  replace(4, [.5, .2, 2.9, 2.7], [.6, .4, 3, 2.8])
  replace(5, [-.4, 0, 2.8, 2.6], [.5, .2, 2.9, 2.7])
  const augustEvents = reading(2026, 6, [.1, .2, 2.7, 2.5], [-.4, 0, 2.8, 2.6])
  const selected = groupInspectorReleases(augustEvents)[0]
  const score = assessCpiScoreV2(selected, history)
  assert.equal(score.label, 'EURUSD Long')
  assert.deepEqual(score.readings.map((row) => row.value), [-.066666666667, -.066666666667, -.1, -.133333333333])
  assert.ok(score.readings.every((row) => row.points < 0 && row.sampleCount >= 24))
  assert.equal(score.total, score.readings.reduce((sum, row) => sum + row.points * row.weight, 0) / 100)
  const limits = [.1, .2, .5]
  const v1History = { rows: Object.fromEntries(augustEvents.map((e) => [e.value_id,
    { mode: 'custom', distribution: magnitudeDistribution([], e.actual - e.previous, limits) }])), partial: false, message: null, error: null }
  const original = assessCpiMagnitudeScore(selected, v1History)
  assert.equal(original.label, 'EURUSD Short'); assert.equal(original.total, 3)
  assert.equal(assessCpiScoreV2(null, history), null)
  for (const change of [{ familyId: 'jobs' }, { country: 'EU' }, { currency: 'EUR' }])
    assert.equal(supportsCpiV2({ ...selected, ...change }), false)

  const noisyFuture = reading(2026, 7, [50, 50, 50, 50], [-50, -50, -50, -50])
  assert.deepEqual(assessCpiScoreV2(selected, [...history, ...augustEvents, ...noisyFuture]), score, 'Current and future releases never calibrate magnitudes')
  assert.deepEqual(assessCpiScoreV2(selected, [...history, ...history]), score, 'Repeated inventory copies do not add history samples')
  const noise = (e) => ({ ...e, forecast: -1e9, forecast_raw_scaled_1e6: '-1000000000000000', revised_previous: 1e9 })
  assert.deepEqual(assessCpiScoreV2({ ...selected, events: selected.events.map(noise) }, history.map(noise)), score,
    'Forecasts and revised-previous fields never affect v2')
  const veryEarly = groupInspectorReleases(reading(2015, 4, [.1, .1, 3, 3], [.2, .2, 3.1, 3.1]))[0]
  assert.equal(assessCpiScoreV2(veryEarly, history).label, 'Uncomputed', 'Insufficient calibration history cannot invent a bias')
  const missingMonth = history.filter((e) => !(e.period_seconds === Date.UTC(2026, 4, 1) / 1000 && e.event_id === '840030006'))
  assert.equal(assessCpiScoreV2(selected, missingMonth).label, 'Uncomputed', 'A missing month cannot be replaced by an older month')
  const juneCore = history.find((e) => e.event_id === '840030006' && e.period_seconds === Date.UTC(2026, 5, 1) / 1000)
  assert.equal(assessCpiScoreV2(selected, [...history, { ...juneCore, value_id: 'ambiguous' }]).label, 'Uncomputed', 'Duplicate monthly observations invalidate the window')
  const revision = { ...juneCore, value_id: 'june-core-revision', revision: 1, actual: .3, actual_raw_scaled_1e6: '300000' }
  const laterRevision = { ...revision, release_at: selected.releaseAt + 86400000 }
  assert.deepEqual(assessCpiScoreV2(selected, [...history, laterRevision]), score, 'Later publications revising an older reference month remain excluded')
  const earlierRevision = { ...revision, release_at: selected.releaseAt - 86400000 }
  assert.equal(assessCpiScoreV2(selected, [...history, earlierRevision]).readings[0].value, .033333333333,
    'A revision published before the selected release replaces the older month observation')
  assert.equal(assessCpiScoreV2(selected, history.map((e) => e === juneCore ? { ...e, availability: 'not-returned-by-latest-query' } : e)).label,
    'Uncomputed', 'Retired historical observations cannot fill missing months')
  for (const change of [{ unit: 0 }, { multiplier: 1 }, { actual: null }, { actual_raw_scaled_1e6: 'bad' },
    { currency: 'EUR' }, { country_code: 'EU' }, { availability: 'not-returned-by-latest-query' }, { time_mode: 1 },
    { release_at: selected.releaseAt + 1 }, { period_seconds: 0 }, { period_seconds: Date.UTC(2026, 7, 1) / 1000 }]) {
    const invalid = { ...selected, events: selected.events.map((e) => e.event_id === '840030006' ? { ...e, ...change } : e) }
    assert.equal(assessCpiScoreV2(invalid, history).label, 'Uncomputed', JSON.stringify(change))
  }
  assert.equal(assessCpiScoreV2({ ...selected, timingUncertain: true }, history).label, 'Uncomputed')
  assert.equal(assessCpiScoreV2({ ...selected, events: [...selected.events, { ...augustEvents[0], value_id: 'duplicate' }] }, history).label, 'Uncomputed')
  const noPrevious = { ...selected, events: selected.events.map((e) => e.event_id === '840030008' ? { ...e, previous: null } : e) }
  assert.equal(assessCpiScoreV2(noPrevious, history).label, 'Uncomputed')

  // Rising and persistently high actuals must still be able to yield Short.
  const hotHistory = history.filter((e) => e.period_seconds < Date.UTC(2026, 3, 1) / 1000)
  hotHistory.push(...reading(2026, 3, [.3, .3, 3, 3], [.2, .2, 2.9, 2.9]),
    ...reading(2026, 4, [.4, .4, 3.1, 3.1], [.3, .3, 3, 3]), ...reading(2026, 5, [.5, .5, 3.2, 3.2], [.4, .4, 3.1, 3.1]))
  const hot = groupInspectorReleases(reading(2026, 6, [.6, .6, 3.3, 3.3], [.5, .5, 3.2, 3.2]))[0]
  assert.equal(assessCpiScoreV2(hot, hotHistory).label, 'EURUSD Short')
  const flatHistory = history.filter((e) => e.period_seconds < Date.UTC(2026, 3, 1) / 1000)
  for (const m of [3, 4, 5]) flatHistory.push(...reading(2026, m, [.4, .4, 3, 3], [.4, .4, 3, 3]))
  const flatHigh = groupInspectorReleases(reading(2026, 6, [.4, .4, 3, 3], [.4, .4, 3, 3]))[0]
  const highScore = assessCpiScoreV2(flatHigh, flatHistory)
  assert.equal(highScore.label, 'EURUSD Short', 'Unchanged but persistently high core levels retain pressure')
  assert.equal(highScore.readings[1].points, 0)
  const flatLowHistory = flatHistory.map((e) => e.period_seconds >= Date.UTC(2026, 3, 1) / 1000 && e.event_id === '840030006' ?
    { ...e, actual: .2, actual_raw_scaled_1e6: '200000' } : e)
  const allZero = { ...flatHigh, events: flatHigh.events.map((e) => e.event_id === '840030006' ? { ...e, actual: .2, actual_raw_scaled_1e6: '200000' } : e) }
  assert.equal(assessCpiScoreV2(allZero, flatLowHistory).label, 'Uncomputed', 'All-zero evidence does not invent Long or Short')
  const tieHistory = flatHistory.map((e) => e.period_seconds >= Date.UTC(2026, 3, 1) / 1000 && e.event_id === '840030006' ?
    { ...e, actual: .3, actual_raw_scaled_1e6: '300000' } : e)
  const tie = groupInspectorReleases(reading(2026, 6, [.35, .3, 3, 2.5], [.4, .3, 3, 2.65]))[0]
  const tieScore = assessCpiScoreV2(tie, tieHistory)
  assert.equal(tieScore.total, 0, 'Integer percentage weights preserve exact cancellation')
  assert.equal(tieScore.tieBreak.id, 'pressure')
  assert.equal(tieScore.label, 'EURUSD Short', 'Core pressure resolves cancellation without a Mixed label')
  console.log('✓ V2 August Long vs v1 Short; actual levels/trends, no forecasts or future calibration, reference-month continuity and data gates')

  const { CpiScoreV2 } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/CPI/ui/CpiScoreV2.tsx')
  let requests = 0
  globalThis.fetch = async () => { requests++; throw new Error('Unexpected fetch') }
  const table = mount(CpiScoreV2, { release: selected, brokerId: null, events: history })
  await table.render()
  assert.equal(requests, 0)
  assert.equal(table.container.querySelector('[aria-label="CPI v2 pair direction"]').textContent, 'EURUSD Long')
  assert.equal(table.container.querySelector('details, summary'), null, 'V2 presents its score details without a collapse control')
  assert.equal(table.container.querySelectorAll('[aria-label="CPI v2 component scores"] tbody tr').length, 4)

  const { InspectorPanel } = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  const prefs = { ...defaultInspectorPreferences(), detailView: 'scoring-v2' }
  let saved
  const view = { selectedRelease: selected, preferences: prefs, supported: true, now: Date.UTC(2026, 9, 1),
    brokerTime: false, brokerId: null, brokerOffsetSeconds: 0, range: { from: selected.releaseAt - 1000, to: selected.releaseAt + 1000 },
    rangePreset: 'custom', rangeDates: { from: '2026-08-12', to: '2026-08-12' }, customFrom: '2026-08-12', customTo: '2026-08-12',
    releases: [selected], allReleases: groupInspectorReleases([...history, ...augustEvents]), magnitudeHistory: v1History,
    storage: { loading: false, error: null, coverage: {}, source: null }, selectRelease() {}, selectCustomRange() {},
    applyPreferences(next) { saved = next }, setRangePreset() {}, setCustomFrom() {}, setCustomTo() {},
  }
  let opened
  const props = { view, symbol: 'EURUSD.a', source: null, error: null, timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 }, onOpenScatter(r) { opened = r } }
  const panel = mount(InspectorPanel, props)
  await panel.render()
  const select = panel.container.querySelector('[aria-label="Inspector view"]')
  assert.equal(select.value, 'scoring-v2')
  assert.equal(panel.container.querySelector('[aria-label="CPI v2 pair direction"]').textContent, 'EURUSD Long')
  await React.act(async () => { select.value = 'scatter'; select.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.equal(opened.id, selected.id); assert.equal(select.value, 'scoring-v2'); assert.equal(saved, undefined)
  await React.act(async () => { select.value = 'scoring'; select.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.equal(saved.detailView, 'scoring')
  const nfp = { ...selected, familyId: 'jobs', label: 'US Jobs report / NFP' }
  await panel.render({ ...props, view: { ...view, selectedRelease: nfp, releases: [nfp] } })
  assert.equal(panel.container.querySelector('[aria-label="Inspector view"]').value, 'table')
  assert.equal(panel.container.querySelector('option[value="scoring-v2"]'), null, 'V2 is offered exclusively for USD CPI')
  assert.equal(panel.container.querySelector('[aria-label="CPI v2 pair direction"]'), null)
  localStorage.setItem(inspectorStorageKey, JSON.stringify(prefs))
  assert.equal(readInspectorPreferences().detailView, 'scoring-v2')
  const snapshot = exportWorkspace()
  localStorage.clear(); restoreWorkspace(snapshot)
  assert.equal(readInspectorPreferences().detailView, 'scoring-v2', 'V2 selection survives workspace export/restore')

  const paths = []
  globalThis.fetch = async (url) => {
    paths.push(url)
    if (url === '/storage-api/health') return { ok: true, json: async () => ({ revision: 1, sources: [{ id: 'test-broker', publisher_status: 'live', server_now: 1 }], collector_error: null }) }
    const params = new URL(url, 'http://localhost').searchParams
    assert.equal(params.get('time_basis'), 'chart'); assert.equal(params.get('currency'), 'USD')
    assert.equal(params.get('event_ids'), '840030005,840030006,840030008')
    return { ok: true, json: async () => ({ source_id: 'test-broker', revision: 1, timestamp_convention: 'trade_server_time', time_basis: 'chart',
      event_ids: ['840030005', '840030006', '840030008'], events: history, coverage: {}, next_cursor: null }) }
  }
  const stored = mount(CpiScoreV2, { release: selected, brokerId: 'test-broker', events: [] })
  await stored.render()
  await React.act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)) })
  assert.ok(paths.some((p) => p.startsWith('/storage-api/calendar?')))
  assert.equal(stored.container.querySelector('[aria-label="CPI v2 pair direction"]').textContent, 'EURUSD Long')
  console.log('✓ Flat score presentation, CPI-only selector, scatter navigation, saved view/workspace portability and independent scoped history loading')
} finally {
  await React.act(async () => { for (const root of roots) root.unmount() })
  await dom.happyDOM.abort(); dom.close()
  for (const key of keys) {
    if (previous[key]) Object.defineProperty(globalThis, key, previous[key])
    else delete globalThis[key]
  }
  await server.close()
}
