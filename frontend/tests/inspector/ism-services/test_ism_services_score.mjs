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
const choose = (element, value) => React.act(async () => {
  assert.ok(element); element.value = value; element.dispatchEvent(new dom.Event('change', { bubbles: true }))
})
const click = (element) => React.act(async () => { assert.ok(element); element.click() })
const input = (element, value) => React.act(async () => {
  assert.ok(element)
  Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype, 'value').set.call(element, String(value))
  element.dispatchEvent(new dom.Event('input', { bubbles: true })); element.dispatchEvent(new dom.Event('change', { bubbles: true }))
})

try {
  const { assessIsmServicesScore, supportsIsmServicesScore, ismServicesSignals, ismServicesSeriesIds, ismServicesScoreVersion } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/ISM-SERVICES/assessment/ism-services-score.ts')
  const { groupInspectorReleases, defaultInspectorPreferences, inspectorStorageKey, readInspectorPreferences } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { IsmServicesScore } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/ISM-SERVICES/ui/IsmServicesScore.tsx')
  const { InspectorPanel } = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  const { inspectorScoringBinding } = await server.ssrLoadModule('./src/inspector/scoring/scoring-registry.ts')
  const { scoringSignalBinding, prepareScoringSignalHistory, scoringSignalModel } = await server.ssrLoadModule('./src/scatter-plot/inspection/scoring-signal-model.ts')
  const { ScatterPlotDock } = await server.ssrLoadModule('./src/scatter-plot/index.ts')
  const { ismServicesSignalSettings, cpiSignalSettings, nfpSignalSettings, pceSignalSettings } = await server.ssrLoadModule('./src/inspector/scoring/shared/core/signal-magnitude-settings.ts')
  const { magnitudeFamilies } = await server.ssrLoadModule('./src/inspector/magnitude/magnitude-families.ts')
  const { exportWorkspace, restoreWorkspace, parseWorkspaceSnapshot } = await server.ssrLoadModule('./src/workspace-portability/workspace-snapshot.ts')
  assert.equal(ismServicesScoreVersion, 'ism-services-eurusd-activity-change-v1')
  assert.deepEqual(ismServicesSignals.map((s) => s.weight), [35, 25, 25, 15])
  const raw = (value) => value === null ? null : String(Math.round(value * 1e6))
  const reading = (year, month, values = [55, 55, 55, 55, 55]) => {
    const at = Date.UTC(year, month + 1, 5, 14), period = Date.UTC(year, month, 1) / 1000
    return ismServicesSeriesIds.map((id, i) => ({ value_id: `${period}:${id}`, event_id: id, name: id,
      currency: 'USD', country_code: 'US', country_name: 'United States', event_code: id,
      server_time_seconds: at / 1000 + 10800, chart_time_seconds: at / 1000 + 10800, release_at: at,
      period_seconds: period, revision: 0, time_mode: 0, importance: 'high', impact: 'none', availability: 'observed',
      unit: 0, multiplier: 0, digits: 1, actual: values[i], previous: 55, forecast: 999, revised_previous: null,
      actual_raw_scaled_1e6: raw(values[i]), previous_raw_scaled_1e6: raw(55) }))
  }
  const history = Array.from({ length: 132 }, (_, i) => reading(2015 + Math.floor(i / 12), i % 12,
    [55, 51 + (i % 5), 51 + ((i + 1) % 5), 51 + ((i + 2) % 5), 51 + ((i + 3) % 5)])).flat()
  const withMonths = (value = 55) => [...history, ...[3, 4, 5].flatMap((month) => reading(2026, month, [value, value, value, value, value]))]
  const select = (values) => groupInspectorReleases(reading(2026, 6, values))[0]
  const coolHistory = withMonths(), cool = select([55, 53, 53, 53, 53])
  const coolScore = assessIsmServicesScore(cool, coolHistory)
  assert.equal(coolScore.label, 'EURUSD Long'); assert.equal(coolScore.strength, 'strong')
  assert.deepEqual(coolScore.readings.map((r) => r.value), [-2, -2, -2, -2])
  assert.match(coolScore.headlineContext, /expansion.*no directional vote/)
  assert.match(coolScore.explanation, /below the recent pace.*still rising/)
  assert.equal(coolScore.readings[0].state, 'Orders rising')
  assert.equal(coolScore.total, coolScore.readings.reduce((sum, r) => sum + r.points * r.weight, 0) / 100)
  const flatHistory = withMonths()
  assert.equal(assessIsmServicesScore(select([55, 57, 57, 57, 57]), flatHistory).label, 'EURUSD Short')
  assert.equal(assessIsmServicesScore(select([55, 55, 55, 55, 55]), flatHistory).label, 'Uncomputed')
  const rebounding = assessIsmServicesScore(select([49, 49, 49, 49, 49]), withMonths(45))
  assert.deepEqual(rebounding.readings.map((r) => r.value), [-1, -1, -1, -1])
  assert.equal(rebounding.label, 'EURUSD Long'); assert.match(rebounding.explanation, /below 50/)
  assert.equal(rebounding.readings[0].inputs.baseline, 50)
  assert.equal(assessIsmServicesScore(select([50, 50, 50, 50, 50]), withMonths(45)).label, 'Uncomputed')
  const cross50 = assessIsmServicesScore(select([51, 51, 51, 51, 51]), withMonths(45))
  assert.equal(cross50.label, 'EURUSD Short'); assert.equal(cross50.readings[0].value, 1)
  const demandOnly = assessIsmServicesScore(select([55, 55, 57, 55, 57]), flatHistory)
  assert.equal(demandOnly.supportingGroups, 1); assert.equal(demandOnly.strength, 'moderate')
  const tieSettings = Object.fromEntries(ismServicesSignals.map((s) => [s.id, [.6, 1.6, 2.6]]))
  const manual = Object.fromEntries(ismServicesSignals.map((s) => [s.id, [1, 2, 3]]))
  const tied = assessIsmServicesScore(select([55, 52.5, 55.5, 55.5, 57.5]), flatHistory, manual)
  assert.deepEqual(tied.readings.map((r) => r.points), [1, 3, -3, 1])
  // 35 + 75 - 75 + 15 = 50: conflicting components must weaken agreement.
  assert.equal(tied.total, .5); assert.equal(tied.strength, 'weak')
  // A true integer-weight cancellation: orders +1, activity -2, labor 0, prices +1.
  const canceled = assessIsmServicesScore(select([55, 55, 55.5, 55.5, 53.5]), flatHistory, manual)
  assert.equal(canceled.total, 0); assert.equal(canceled.tieBreak.id, 'orders')
  assert.equal(canceled.label, 'EURUSD Short'); assert.equal(canceled.strength, 'weak')
  const noDemand = { ...cool, events: cool.events.filter((e) => !['840040007', '840040009'].includes(e.event_id)) }
  assert.equal(assessIsmServicesScore(noDemand, coolHistory).label, 'Uncomputed')
  assert.match(assessIsmServicesScore(noDemand, coolHistory).explanation, /No usable demand/)
  const oneDemand = { ...cool, events: cool.events.filter((e) => e.event_id === '840040007') }
  assert.equal(assessIsmServicesScore(oneDemand, coolHistory).label, 'EURUSD Long')
  assert.equal(assessIsmServicesScore(oneDemand, coolHistory).strength, 'weak')
  const withoutHeadline = { ...cool, events: cool.events.filter((e) => e.event_id !== '840040003') }
  assert.deepEqual(assessIsmServicesScore(withoutHeadline, coolHistory).readings, coolScore.readings)
  assert.equal(assessIsmServicesScore(withoutHeadline, coolHistory).strength, 'strong')
  const headlineChanged = { ...cool, events: cool.events.map((e) => e.event_id === '840040003' ? {...e, actual: 40, actual_raw_scaled_1e6: raw(40)} : e) }
  assert.deepEqual(assessIsmServicesScore(headlineChanged, coolHistory).readings, coolScore.readings)
  assert.equal(assessIsmServicesScore(headlineChanged, coolHistory).label, coolScore.label)
  assert.match(assessIsmServicesScore(headlineChanged, coolHistory).headlineContext, /contraction/)
  console.log('✓ ISM demand priority, no headline double count, contraction rebounds, expansion cooling, grouped evidence, conflicts and ties')

  assert.equal(assessIsmServicesScore(null, history), null)
  for (const patch of [{familyId: 'gdp'}, {currency: 'EUR'}, {country: 'EU'}]) assert.equal(supportsIsmServicesScore({...cool, ...patch}), false)
  const future = reading(2026, 7, [99, 99, 99, 99, 99])
  assert.deepEqual(assessIsmServicesScore(cool, [...coolHistory, ...cool.events, ...future]), coolScore)
  assert.deepEqual(assessIsmServicesScore(cool, [...coolHistory, ...coolHistory]), coolScore)
  const noise = (e) => ({...e, forecast: -1e9, forecast_raw_scaled_1e6: 'bad', previous: 1, previous_raw_scaled_1e6: 'bad'})
  assert.deepEqual(assessIsmServicesScore({...cool, events: cool.events.map(noise)}, coolHistory.map(noise)), coolScore)
  const mutateOrders = (patch) => ({...cool, events: cool.events.map((e) => e.event_id === '840040007' ? {...e, ...patch} : e)})
  const revised = mutateOrders({revised_previous: 52, revised_previous_raw_scaled_1e6: raw(52)})
  assert.equal(assessIsmServicesScore(revised, coolHistory).readings[0].value, -1)
  assert.match(assessIsmServicesScore(revised, coolHistory).readings[0].inputs.baselineLabel, /nearest month revised/)
  for (const patch of [{unit: 1}, {multiplier: 1}, {actual: null}, {actual: NaN}, {actual_raw_scaled_1e6: 'broken'},
    {actual: 101, actual_raw_scaled_1e6: raw(101)}, {actual: -1, actual_raw_scaled_1e6: raw(-1)},
    {actual_raw_scaled_1e6: '9007199254740993'}, {availability: 'not-returned-by-latest-query'}, {country_code: 'CA'}, {period_seconds: 0},
    {revised_previous: 101, revised_previous_raw_scaled_1e6: raw(101)}, {revised_previous: 52, revised_previous_raw_scaled_1e6: 'bad'}])
    assert.equal(assessIsmServicesScore(mutateOrders(patch), coolHistory).readings[0].points, null)
  const early = groupInspectorReleases(reading(2015, 4))[0]
  assert.equal(assessIsmServicesScore(early, history, manual).label, 'Uncomputed')
  assert.equal(assessIsmServicesScore({...cool, timingUncertain: true}, coolHistory).label, 'Uncomputed')
  const missingMonth = coolHistory.filter((e) => e.event_id !== '840040007' || e.period_seconds !== Date.UTC(2026, 4, 1)/1000)
  assert.equal(assessIsmServicesScore(cool, missingMonth).readings[0].points, null)
  assert.equal(assessIsmServicesScore(cool, missingMonth).readings[0].state, 'Orders rising', 'A missing comparison does not hide a valid current level')
  const invalidPast = coolHistory.map((e) => e.event_id === '840040007' && e.period_seconds === Date.UTC(2026, 4, 1)/1000 ? {...e, actual: 101, actual_raw_scaled_1e6: raw(101)} : e)
  assert.equal(assessIsmServicesScore(cool, invalidPast).readings[0].points, null)
  const ordersRow = cool.events.find((e) => e.event_id === '840040007')
  assert.equal(assessIsmServicesScore({...cool, events: [...cool.events, {...ordersRow, value_id: 'ambiguous'}]}, coolHistory).readings[0].points, null)
  assert.equal(assessIsmServicesScore(mutateOrders({period_seconds: Date.UTC(2026,5,1)/1000}), coolHistory).label, 'Uncomputed')
  assert.throws(() => assessIsmServicesScore(cool, coolHistory, {orders: [1,1,2]}), RangeError)
  console.log('✓ ISM native index domains, source/reference gates, revisions, continuity, no forecasts and earlier-only calibration')

  const binding = scoringSignalBinding('ism-services'), events = [...coolHistory, ...cool.events, ...future]
  const now = Date.UTC(2026, 9, 1), signalHistory = prepareScoringSignalHistory(events, now, binding)
  assert.ok(signalHistory.some((entry) => entry.release.releaseAt > cool.releaseAt), 'Later context must be present to test its exclusion from earlier calibration')
  for (const definition of ismServicesSignals) {
    const model = scoringSignalModel(signalHistory, binding, definition.id, cool.id)
    const score = coolScore.readings.find((row) => row.id === definition.id)
    for (const key of ['value', 'points', 'size', 'sampleCount', 'limits', 'reason', 'inputs']) assert.deepEqual(model.inspection.signal[key], score[key])
    const manual = scoringSignalModel(signalHistory, binding, definition.id, cool.id, tieSettings)
    assert.equal(manual.inspection.signal.points, assessIsmServicesScore(cool, events, tieSettings).readings.find((row) => row.id === definition.id).points)
    const truncated = signalHistory.filter((entry) => entry.release.releaseAt <= cool.releaseAt)
    assert.deepEqual(scoringSignalModel(truncated, binding, definition.id, cool.id).inspection.signal, model.inspection.signal)
  }
  assert.equal(inspectorScoringBinding('EURUSD.a', cool).familyId, 'ism-services')
  assert.equal(inspectorScoringBinding('GBPUSD', cool), null)
  const app = mount(IsmServicesScore, { release: cool, events, history: {} }); await app.render()
  assert.equal(app.container.querySelector('[aria-label="ISM Services pair direction"]').textContent, 'EURUSD Long')
  assert.equal(app.container.querySelectorAll('details').length, 0)
  assert.equal(app.container.querySelectorAll('tbody tr').length, 4)
  const prefs = { ...defaultInspectorPreferences(), detailView: 'scoring' }
  let saved, opened
  const view = { supported: true, selectedRelease: cool, preferences: prefs, brokerId: null, now: cool.releaseAt + 1000, brokerTime: false,
    releases: [cool], allReleases: groupInspectorReleases(events), range: { from: cool.releaseAt - 86400000, to: cool.releaseAt + 86400000 },
    storage: { coverage: {}, loading: false, error: null, source: null }, magnitudeHistory: { rows: {}, loading: false, error: null, coverageMissing: false }, selectRelease() {},
    rangeDates: { from: '2026-08-01', to: '2026-08-31' }, rangePreset: 'custom', setRangePreset() {},
    customFrom: '2026-08-01', customTo: '2026-08-31', setCustomFrom() {}, setCustomTo() {}, selectCustomRange() {},
    applyPreferences(next) { saved = next }, brokerOffsetSeconds: 0 }
  const props = { view, symbol: 'EURUSD.a', source: null, error: null, timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 }, onOpenScatter(release) { opened = release } }
  const panel = mount(InspectorPanel, props); await panel.render()
  const dropdown = panel.container.querySelector('[aria-label="Inspector view"]')
  assert.equal(dropdown.value, 'scoring'); assert.equal(dropdown.querySelector('[value="scoring"]').disabled, false)
  assert.equal(panel.container.querySelector('[aria-label="ISM Services pair direction"]').textContent, 'EURUSD Long')
  assert.equal(panel.container.querySelectorAll('.inspector-scoring-view').length, 1, 'Flat full view has no extra scrolling wrapper')
  assert.equal(dropdown.querySelector('[value="scoring-v2"]'), null)
  await choose(dropdown, 'scatter'); assert.equal(opened.id, cool.id); assert.equal(dropdown.value, 'scoring'); assert.equal(saved, undefined)
  await choose(dropdown, 'table'); assert.equal(saved.detailView, 'table')
  await panel.render({ ...props, view: { ...view, preferences: { ...prefs, detailView: 'scoring-v3' } } })
  assert.equal(panel.container.querySelector('[aria-label="Inspector view"]').value, 'table', 'CPI-only saved versions stay isolated')
  await panel.render({ ...props, symbol: 'GBPUSD', view: { ...view, supported: false } })
  assert.equal(panel.container.querySelector('[aria-label="ISM Services pair direction"]'), null)
  localStorage.setItem(inspectorStorageKey, JSON.stringify(prefs))
  assert.equal(readInspectorPreferences().detailView, 'scoring')

  const paths = []
  globalThis.fetch = async (url) => {
    paths.push(String(url))
    if (url === '/storage-api/health') return { ok: true, json: async () => ({ revision: 1, collector_error: null,
      sources: [{ id: 'test-broker', publisher_status: 'live', server_now: now / 1000 }] }) }
    const params = new URL(url, 'http://localhost').searchParams
    assert.equal(params.get('currency'), 'USD'); assert.equal(params.get('time_basis'), 'chart')
    assert.deepEqual(params.get('event_ids').split(',').sort(), [...ismServicesSeriesIds].sort())
    return { ok: true, json: async () => ({ source_id: 'test-broker', revision: 1, timestamp_convention: 'trade_server_time', time_basis: 'chart',
      event_ids: ismServicesSeriesIds, events, coverage: { USD: { missing: [] } }, next_cursor: null }) }
  }
  const stored = mount(IsmServicesScore, { release: cool, events: [], brokerId: 'test-broker', history: {} }); await stored.render()
  assert.equal(stored.container.querySelector('[aria-label="ISM Services pair direction"]').textContent, 'EURUSD Long')
  const target = { brokerId: 'test-broker', familyId: 'ism-services', releaseId: cool.id, at: cool.releaseAt }
  const dock = mount(ScatterPlotDock, { brokerId: 'test-broker', clockOffsetMs: now - Date.now(), target }); await dock.render()
  const requestsBeforeEdits = paths.length
  await choose(dock.container.querySelector('[aria-label="Scatter Plot Measure"]'), 'signal')
  assert.equal(dock.container.querySelector('[aria-label="Scatter Plot Signal"]').options.length, 4)
  assert.equal(dock.container.querySelector('.scatter-plot-inspection time').textContent, new Date(cool.releaseAt).toISOString().slice(0, 10))
  const beforePreview = app.container.textContent
  await choose(dock.container.querySelector('[aria-label="Signal magnitude mode"]'), 'custom')
  for (const [index, name] of ['Small', 'Medium', 'Large'].entries()) await input(dock.container.querySelector(`[aria-label="${name} signal upper boundary"]`), (index + 1) * .001)
  assert.equal(app.container.textContent, beforePreview, 'Unsaved preview never updates scorer')
  await React.act(async () => dock.container.querySelector('[aria-label="Scoring signal boundaries"]').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.deepEqual(ismServicesSignalSettings.read(), { 'orders': [.001, .002, .003] })
  assert.match(app.container.textContent, /manual override boundaries/)
  assert.deepEqual(cpiSignalSettings.read(), {}); assert.deepEqual(nfpSignalSettings.read(), {}); assert.deepEqual(pceSignalSettings.read(), {})
  assert.deepEqual(magnitudeFamilies.find((family) => family.familyId === 'ism-services').settings.read(), {})
  assert.equal(paths.length, requestsBeforeEdits, 'Scoring signal mode reuses ISM Services inventory')
  const workspace = exportWorkspace()
  assert.deepEqual(JSON.parse(workspace.entries[ismServicesSignalSettings.key]), { 'orders': [.001, .002, .003] })
  assert.throws(() => parseWorkspaceSnapshot(JSON.stringify({ ...workspace, entries: { [ismServicesSignalSettings.key]: JSON.stringify({ wrong: [1, 2, 3] }) } })))
  await React.act(async () => ismServicesSignalSettings.save('orders', null))
  assert.equal(app.container.textContent, beforePreview)
  await React.act(async () => restoreWorkspace(workspace))
  assert.match(app.container.textContent, /manual override boundaries/)
  await click([...dock.container.querySelectorAll('button')].find((button) => button.textContent === 'Use automatic'))
  assert.equal(app.container.textContent, beforePreview)
  console.log('✓ ISM Services chart/scorer parity, full flat Inspector view, saved-view isolation, scoped fetching, preview/apply/reset and workspace/live updates')
} finally {
  await React.act(async () => { for (const root of roots) root.unmount() })
  await dom.happyDOM.abort(); dom.close()
  for (const key of keys) {
    if (previous[key]) Object.defineProperty(globalThis, key, previous[key])
    else delete globalThis[key]
  }
  await server.close()
}
