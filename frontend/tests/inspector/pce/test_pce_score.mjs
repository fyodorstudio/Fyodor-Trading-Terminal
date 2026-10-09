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
  const { assessPceScore, supportsPceScore, pceSignals, pceSeriesIds, pceScoreVersion } = await server.ssrLoadModule('./src/scoring-system/PAIR/EURUSD/USD/PCE/assessment/pce-score.ts')
  const { groupInspectorReleases, defaultInspectorPreferences, inspectorStorageKey, readInspectorPreferences } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { PceScore } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/PCE/ui/PceScore.tsx')
  const { InspectorPanel } = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  const { inspectorScoringBinding } = await server.ssrLoadModule('./src/inspector/scoring/scoring-registry.ts')
  const { scoringSignalBinding, prepareScoringSignalHistory, scoringSignalModel } = await server.ssrLoadModule('./src/scatter-plot/inspection/scoring-signal-model.ts')
  const { ScatterPlotDock } = await server.ssrLoadModule('./src/scatter-plot/index.ts')
  const { pceSignalSettings, cpiSignalSettings, nfpSignalSettings } = await server.ssrLoadModule('./src/scoring-system/shared/core/signal-magnitude-settings.ts')
  const { magnitudeFamilies } = await server.ssrLoadModule('./src/inspector/magnitude/magnitude-families.ts')
  const { exportWorkspace, restoreWorkspace, parseWorkspaceSnapshot } = await server.ssrLoadModule('./src/workspace-portability/workspace-snapshot.ts')
  assert.equal(pceScoreVersion, 'pce-eurusd-inflation-change-v1')
  assert.deepEqual(pceSignals.map((signal) => signal.weight), [45, 30, 15, 10])
  const raw = (value) => value === null ? null : String(Math.round(value * 1e6))
  const reading = (year, month, values = [.2, 3, .2, 3], prior = [.2, 3, .2, 3]) => {
    const at = Date.UTC(year, month + 1, 28, 12, 30), period = Date.UTC(year, month, 1) / 1000
    return pceSeriesIds.map((id, i) => ({ value_id: `${period}:${id}`, event_id: id, name: id,
      currency: 'USD', country_code: 'US', country_name: 'United States', event_code: id,
      server_time_seconds: at / 1000 + 10800, chart_time_seconds: at / 1000 + 10800, release_at: at,
      period_seconds: period, revision: 0, time_mode: 0, importance: 'high', impact: 'none', availability: 'observed',
      unit: 1, multiplier: 0, digits: 1, actual: values[i], previous: prior[i], forecast: 999, revised_previous: null,
      actual_raw_scaled_1e6: raw(values[i]), previous_raw_scaled_1e6: raw(prior[i]) }))
  }
  const history = Array.from({ length: 132 }, (_, i) => reading(2015 + Math.floor(i / 12), i % 12,
    [.1 + (i % 4) * .1, 3 + (i % 3) * .1, .1 + ((i + 1) % 4) * .1, 3 + (i % 3) * .1],
    [.2, 3 + ((i + 2) % 3) * .1, .2, 3 + ((i + 2) % 3) * .1])).flat()
  const withMonths = (core, headline) => [...history, ...[3, 4, 5].flatMap((month, i) => reading(2026, month, [core[i], 3, headline[i], 3]))]
  const select = (values, prior) => groupInspectorReleases(reading(2026, 6, values, prior))[0]
  const coolHistory = withMonths([.4, .2, 0], [.6, .5, -.4])
  const cool = select([.2, 2.5, .1, 3], [.0, 2.6, -.4, 3.1])
  const coolScore = assessPceScore(cool, coolHistory)
  assert.equal(coolScore.label, 'EURUSD Long'); assert.equal(coolScore.strength, 'strong')
  assert.deepEqual(coolScore.readings.map((row) => row.value), [0, -.1, -.133333333333, -.1])
  assert.match(coolScore.targetContext, /above.*2%.*no directional vote/)
  assert.equal(coolScore.total, coolScore.readings.reduce((sum, row) => sum + row.points * row.weight, 0) / 100)
  const flatHistory = withMonths([.2, .2, .2], [.2, .2, .2])
  const hot = select([.4, 3.3, .4, 3.3], [.2, 3, .2, 3])
  assert.equal(assessPceScore(hot, flatHistory).label, 'EURUSD Short')
  assert.equal(assessPceScore(hot, flatHistory).strength, 'strong')
  assert.equal(assessPceScore(select([.2, 3, .2, 3]), flatHistory).label, 'Uncomputed', 'High unchanged levels cannot invent a vote')
  const monthlyOnly = assessPceScore(select([.4, 3, .4, 3]), flatHistory)
  assert.equal(monthlyOnly.supportingGroups, 1); assert.equal(monthlyOnly.strength, 'moderate', 'Core and headline of the same horizon are not separate confirmations')
  const conflict = assessPceScore(select([.4, 2.9, .4, 2.9], [.2, 3, .2, 3]), flatHistory,
    Object.fromEntries(pceSignals.map((s) => [s.id, [.3, .6, .9]])))
  assert.equal(conflict.label, 'EURUSD Short'); assert.equal(conflict.strength, 'weak')
  assert.match(conflict.strengthReason, /Conflicting/)
  const tieSettings = Object.fromEntries(pceSignals.map((s) => [s.id, [.11, .2, .3]]))
  const tied = assessPceScore(select([.15, 3.1, .3, 3]), flatHistory, tieSettings)
  assert.deepEqual(tied.readings.map((row) => row.points), [-1, 1, 1, 0])
  assert.equal(tied.total, 0); assert.equal(tied.tieBreak.id, 'core-pace'); assert.equal(tied.label, 'EURUSD Long'); assert.equal(tied.strength, 'weak')
  const belowTarget = assessPceScore(select([.2, 3, .2, 1.9], [.2, 3, .2, 1.9]), flatHistory)
  assert.equal(belowTarget.label, 'Uncomputed'); assert.match(belowTarget.targetContext, /below.*no directional vote/)
  const annualOnly = { ...cool, events: cool.events.filter((event) => event.event_id === '840010002') }
  assert.equal(assessPceScore(annualOnly, coolHistory).label, 'EURUSD Long')
  assert.equal(assessPceScore(annualOnly, coolHistory).strength, 'weak')
  const headlineOnly = { ...cool, events: cool.events.filter((event) => ['840010003', '840010004'].includes(event.event_id)) }
  assert.equal(assessPceScore(headlineOnly, coolHistory).label, 'Uncomputed')
  assert.match(assessPceScore(headlineOnly, coolHistory).explanation, /headline alone/)
  console.log('✓ PCE core priority, monthly/annual grouping, headline rebounds, weighted conflicts/ties, target context and honest reduced-data biases')

  assert.equal(assessPceScore(null, history), null)
  for (const patch of [{ familyId: 'gdp' }, { currency: 'EUR' }, { country: 'EU' }]) assert.equal(supportsPceScore({ ...cool, ...patch }), false)
  const future = reading(2026, 7, [99, 99, 99, 99])
  assert.deepEqual(assessPceScore(cool, [...coolHistory, ...cool.events, ...future]), coolScore)
  assert.deepEqual(assessPceScore(cool, [...coolHistory, ...coolHistory]), coolScore)
  const noise = (event) => ({ ...event, forecast: -1e9, forecast_raw_scaled_1e6: 'bad' })
  assert.deepEqual(assessPceScore({ ...cool, events: cool.events.map(noise) }, coolHistory.map(noise)), coolScore)
  const revised = { ...cool, events: cool.events.map((event) => ({ ...event, revised_previous: event.event_id === '840010001' ? .1 :
    event.event_id === '840010002' ? event.actual : null, revised_previous_raw_scaled_1e6: event.event_id === '840010001' ? raw(.1) :
      event.event_id === '840010002' ? raw(event.actual) : null })) }
  const revisedScore = assessPceScore(revised, coolHistory)
  assert.equal(revisedScore.readings[1].value, 0, 'Annual level changed only through revision is not fresh annual cooling')
  assert.equal(revisedScore.readings[1].inputs.baselineLabel, 'Revised Previous core PCE y/y')
  assert.equal(revisedScore.readings[0].value, -.033333333333, 'Prior three-month average incorporates revised nearest month')
  assert.match(revisedScore.readings[0].inputs.baselineLabel, /nearest month revised/)
  const invalidRevision = { ...revised, events: revised.events.map((event) => ({ ...event, revised_previous_raw_scaled_1e6: 'bad' })) }
  assert.equal(assessPceScore(invalidRevision, coolHistory).readings[0].points, null)
  assert.equal(assessPceScore(invalidRevision, coolHistory).readings[1].points, null)
  const early = groupInspectorReleases(reading(2015, 4, [.3, 3.1, .3, 3.1]))[0]
  assert.equal(assessPceScore(early, history, tieSettings).label, 'Uncomputed', 'Overrides retain the 24-observation gate')
  assert.equal(assessPceScore({ ...cool, timingUncertain: true }, coolHistory).label, 'Uncomputed')
  const drop = coolHistory.filter((event) => event.event_id !== '840010001' || event.period_seconds !== Date.UTC(2026, 4, 1) / 1000)
  assert.equal(assessPceScore(cool, drop).readings[0].points, null, 'Missing prior reference months cannot be skipped or filled with Previous')
  const mutateCore = (patch) => ({ ...cool, events: cool.events.map((event) => event.event_id === '840010001' ? { ...event, ...patch } : event) })
  for (const patch of [{ unit: 0 }, { multiplier: 1 }, { actual: null }, { actual: NaN }, { actual_raw_scaled_1e6: 'broken' },
    { actual_raw_scaled_1e6: '9007199254740993' }, { availability: 'not-returned-by-latest-query' }, { country_code: 'CA' }, { period_seconds: 0 }])
    assert.equal(assessPceScore(mutateCore(patch), coolHistory).readings[0].points, null)
  const coreRow = cool.events.find((event) => event.event_id === '840010001')
  const duplicated = { ...cool, events: [...cool.events, { ...coreRow, value_id: 'ambiguous' }] }
  assert.equal(assessPceScore(duplicated, coolHistory).readings[0].points, null)
  const mismatched = mutateCore({ period_seconds: Date.UTC(2026, 5, 1) / 1000 })
  assert.equal(assessPceScore(mismatched, coolHistory).label, 'Uncomputed')
  const wrongPrevious = { ...cool, events: cool.events.map((event) => event.event_id === '840010002' ? { ...event, previous_raw_scaled_1e6: 'bad' } : event) }
  assert.equal(assessPceScore(wrongPrevious, coolHistory).readings[1].points, null)
  assert.throws(() => assessPceScore(cool, coolHistory, { 'core-pace': [1, 1, 2] }), RangeError)
  console.log('✓ Native/source/reference/duplicate gates, continuity, earlier-only calibration, forecast exclusion, explicit revision handling and minimum history')

  const binding = scoringSignalBinding('pce'), events = [...coolHistory, ...cool.events, ...future]
  const now = Date.UTC(2026, 8, 1), signalHistory = prepareScoringSignalHistory(events, now, binding)
  for (const definition of pceSignals) {
    const model = scoringSignalModel(signalHistory, binding, definition.id, cool.id)
    const score = coolScore.readings.find((row) => row.id === definition.id)
    for (const key of ['value', 'points', 'size', 'sampleCount', 'limits', 'reason', 'inputs']) assert.deepEqual(model.inspection.signal[key], score[key])
    const manual = scoringSignalModel(signalHistory, binding, definition.id, cool.id, tieSettings)
    assert.equal(manual.inspection.signal.points, assessPceScore(cool, events, tieSettings).readings.find((row) => row.id === definition.id).points)
    const truncated = signalHistory.filter((entry) => entry.release.releaseAt <= cool.releaseAt)
    assert.deepEqual(scoringSignalModel(truncated, binding, definition.id, cool.id).inspection.signal, model.inspection.signal)
  }
  assert.equal(inspectorScoringBinding('EURUSD.a', cool).familyId, 'pce')
  assert.equal(inspectorScoringBinding('GBPUSD', cool), null)
  const app = mount(PceScore, { release: cool, events, history: {} }); await app.render()
  assert.equal(app.container.querySelector('[aria-label="PCE pair direction"]').textContent, 'EURUSD Long')
  assert.equal(app.container.querySelector('[aria-label="How this scorer works"]'),null)
  assert.equal(app.container.querySelector('[aria-label="PCE component scores"]').closest('details'), null)
  assert.equal(app.container.querySelectorAll('[aria-label="PCE component scores"] tbody tr').length, 4)
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
  assert.equal(panel.container.querySelector('[aria-label="PCE pair direction"]').textContent, 'EURUSD Long')
  assert.equal(panel.container.querySelectorAll('.inspector-scoring-view').length, 1, 'Inspector mounts standalone scoring; publication context belongs to Raycaster')
  assert.equal(dropdown.querySelector('[value="scoring-v2"]'), null)
  await choose(dropdown, 'scatter'); assert.equal(opened.id, cool.id); assert.equal(dropdown.value, 'scoring'); assert.equal(saved, undefined)
  await choose(dropdown, 'table'); assert.equal(saved.detailView, 'table')
  await panel.render({ ...props, view: { ...view, preferences: { ...prefs, detailView: 'scoring-v3' } } })
  assert.equal(panel.container.querySelector('[aria-label="Inspector view"]').value, 'scoring', 'Saved version choices migrate to the latest family scorer')
  await panel.render({ ...props, symbol: 'GBPUSD', view: { ...view, supported: false } })
  assert.equal(panel.container.querySelector('[aria-label="PCE pair direction"]'), null)
  localStorage.setItem(inspectorStorageKey, JSON.stringify(prefs))
  assert.equal(readInspectorPreferences().detailView, 'scoring')

  const paths = []
  globalThis.fetch = async (url) => {
    paths.push(String(url))
    if (url === '/storage-api/health') return { ok: true, json: async () => ({ revision: 1, collector_error: null,
      sources: [{ id: 'test-broker', publisher_status: 'live', server_now: now / 1000 }] }) }
    const params = new URL(url, 'http://localhost').searchParams
    assert.equal(params.get('currency'), 'USD'); assert.equal(params.get('time_basis'), 'chart')
    assert.deepEqual(params.get('event_ids').split(',').sort(), [...pceSeriesIds].sort())
    return { ok: true, json: async () => ({ source_id: 'test-broker', revision: 1, timestamp_convention: 'trade_server_time', time_basis: 'chart',
      event_ids: pceSeriesIds, events, coverage: { USD: { missing: [] } }, next_cursor: null }) }
  }
  const stored = mount(PceScore, { release: cool, events: [], brokerId: 'test-broker', history: {} }); await stored.render()
  assert.equal(stored.container.querySelector('[aria-label="PCE pair direction"]').textContent, 'EURUSD Long')
  const target = { brokerId: 'test-broker', familyId: 'pce', releaseId: cool.id, at: cool.releaseAt }
  const dock = mount(ScatterPlotDock, { brokerId: 'test-broker', clockOffsetMs: now - Date.now(), target }); await dock.render()
  const requestsBeforeEdits = paths.length
  await choose(dock.container.querySelector('[aria-label="Scatter Plot Measure"]'), 'signal')
  assert.equal(dock.container.querySelector('[aria-label="Scatter Plot Signal"]').options.length, 4)
  assert.equal(dock.container.querySelector('.scatter-plot-inspection time').textContent, new Date(cool.releaseAt).toISOString().slice(0, 10))
  await choose(dock.container.querySelector('[aria-label="Scatter Plot Signal"]'),'core-annual')
  const beforePreview = app.container.textContent
  await choose(dock.container.querySelector('[aria-label="Signal magnitude mode"]'), 'custom')
  for (const [index, name] of ['Small', 'Medium', 'Large'].entries()) await input(dock.container.querySelector(`[aria-label="${name} signal upper boundary"]`), (index + 1) * .001)
  assert.equal(app.container.textContent, beforePreview, 'Unsaved preview never updates scorer')
  await React.act(async () => dock.container.querySelector('[aria-label="Scoring signal boundaries"]').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.deepEqual(pceSignalSettings.read(), { 'core-annual': [.001, .002, .003] })
  assert.notEqual(app.container.textContent, beforePreview)
  assert.deepEqual(cpiSignalSettings.read(), {}); assert.deepEqual(nfpSignalSettings.read(), {})
  assert.deepEqual(magnitudeFamilies.find((family) => family.familyId === 'pce').settings.read(), {})
  assert.equal(paths.length, requestsBeforeEdits, 'Scoring signal mode reuses PCE inventory')
  const workspace = exportWorkspace()
  assert.deepEqual(JSON.parse(workspace.entries[pceSignalSettings.key]), { 'core-annual': [.001, .002, .003] })
  assert.throws(() => parseWorkspaceSnapshot(JSON.stringify({ ...workspace, entries: { [pceSignalSettings.key]: JSON.stringify({ wrong: [1, 2, 3] }) } })))
  await React.act(async () => pceSignalSettings.save('core-annual', null))
  assert.equal(app.container.textContent, beforePreview)
  await React.act(async () => restoreWorkspace(workspace))
  assert.notEqual(app.container.textContent, beforePreview)
  await click([...dock.container.querySelectorAll('button')].find((button) => button.textContent === 'Use automatic'))
  assert.equal(app.container.textContent, beforePreview)
  console.log('✓ PCE chart/scorer parity, Inspector result and optional details, saved-view isolation, scoped fetching, preview/apply/reset and workspace/live updates')
} finally {
  await React.act(async () => { for (const root of roots) root.unmount() })
  await dom.happyDOM.abort(); dom.close()
  for (const key of keys) {
    if (previous[key]) Object.defineProperty(globalThis, key, previous[key])
    else delete globalThis[key]
  }
  await server.close()
}
