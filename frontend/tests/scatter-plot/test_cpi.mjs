import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
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
const click = (element) => { assert.ok(element); return React.act(async () => element.click()) }
const change = (element, value) => {
  assert.ok(element)
  return React.act(async () => {
    const props = element[Object.getOwnPropertyNames(element).find((key) => key.startsWith('__reactProps$'))]
    if (props?.onChange) props.onChange({ target: { value: String(value) } })
    else { element.value = String(value); element.dispatchEvent(new dom.Event('change', { bubbles: true })) }
  })
}

try {
  const { cpiReadingRules, gradeCpiReading, tallyCpiRelease } = await server.ssrLoadModule('./src/inspector/grading/cpi-grading.ts')
  const { cpiMagnitudeFamily, nfpMagnitudeFamily } = await server.ssrLoadModule('./src/inspector/magnitude/magnitude-families.ts')
  const { cpiScatterModel } = await server.ssrLoadModule('./src/scatter-plot/PAIR/EURUSD/USD/CPI/cpi-scatter-adapter.ts')
  const { nfpScatterModel } = await server.ssrLoadModule('./src/scatter-plot/PAIR/EURUSD/USD/NFP/nfp-scatter-adapter.ts')
  const { familyMagnitudeHistory, familyHistoryReleases } = await server.ssrLoadModule('./src/inspector/magnitude/family-magnitude-history.ts')
  const { groupInspectorReleases, inspectorDelta, inspectorCategories, inspectorStorageKey, readInspectorPreferences } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { useFamilyMagnitudeHistory } = await server.ssrLoadModule('./src/inspector/magnitude/useFamilyMagnitudeHistory.ts')
  const { FamilyMagnitudeCell } = await server.ssrLoadModule('./src/inspector/magnitude/FamilyMagnitudeCell.tsx')
  const { InspectorPanel } = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  const { useInspector } = await server.ssrLoadModule('./src/inspector/useInspector.ts')
  const { ScatterPlotDock } = await server.ssrLoadModule('./src/scatter-plot/index.ts')
  assert.equal(inspectorCategories.find((category) => category.id === 'inflation').families.includes('us-cpi'), true)
  const ids = Object.keys(cpiReadingRules), rateIds = ['840030005', '840030006', '840030007', '840030008', '840030033', '840030034']
  assert.equal(ids.length, 10)
  const day = 86400000, firstAt = Date.UTC(2015, 0, 16, 13, 30), selectedAt = Date.UTC(2015, 2, 24, 12, 30), now = selectedAt + 1000
  const clockOffsetMs = now - Date.now()
  const release = (at, delta, prefix = String(at), family = cpiMagnitudeFamily) => family.seriesIds.map((id) => ({
    value_id: `${prefix}-${id}`, event_id: id, name: family.readingRules[id].name, currency: 'USD', country_code: 'US', country_name: 'United States',
    event_code: id, server_time_seconds: at / 1000 + 10800, chart_time_seconds: at / 1000 + 10800, release_at: at,
    period_seconds: at / 1000 - 30 * 86400, revision: 0, time_mode: 0, importance: 'high', impact: 'none', availability: 'observed',
    unit: rateIds.includes(id) ? 1 : 0, multiplier: 0, digits: rateIds.includes(id) ? 1 : 3,
    actual: 10 + delta, previous: 10, forecast: 999, revised_previous: -999,
    actual_raw_scaled_1e6: String(Math.round((10 + delta) * 1e6)), previous_raw_scaled_1e6: '10000000',
  }))
  const first = release(firstAt, .1), second = release(firstAt + 30 * day, -.3), current = release(selectedAt, .2)
  current[2] = { ...current[2], actual: 10, actual_raw_scaled_1e6: '10000000' }
  current[3] = { ...current[3], actual: 9.9, actual_raw_scaled_1e6: '9900000' }
  const selected = groupInspectorReleases(current)[0], events = [...first, ...second, ...current]
  for (const id of ids) {
    const row = current.find((row) => row.event_id === id)
    assert.equal(gradeCpiReading({ ...row, actual: 10.2, actual_raw_scaled_1e6: '10200000' }, 'us-cpi').grade, 'higher')
    assert.equal(gradeCpiReading({ ...row, actual: 9.8, actual_raw_scaled_1e6: '9800000' }, 'us-cpi').grade, 'lower')
    assert.equal(gradeCpiReading({ ...row, actual: 10, actual_raw_scaled_1e6: '10000000' }, 'us-cpi').grade, 'unchanged')
    assert.equal(gradeCpiReading({ ...row, actual: null }, 'us-cpi').grade, 'missing')
    assert.equal(gradeCpiReading({ ...row, actual_raw_scaled_1e6: 'invalid' }, 'us-cpi').grade, 'missing')
    assert.equal(gradeCpiReading(row, 'jobs'), null)
    assert.equal(gradeCpiReading({ ...row, currency: 'EUR' }, 'us-cpi'), null)
    assert.equal(gradeCpiReading({ ...row, country_code: 'EU' }, 'us-cpi'), null)
  }
  assert.deepEqual(tallyCpiRelease(selected).counts, { higher: 8, lower: 1, unchanged: 1, missing: 0, unrated: 0 })
  assert.equal(inspectorDelta(current[0]), .2, 'Forecast and revised Previous never enter the comparator')
  const undefinedRows = familyMagnitudeHistory(events, selected, cpiMagnitudeFamily)
  for (const row of Object.values(undefinedRows)) { assert.equal(row.mode, 'undefined'); assert.equal(row.distribution, null) }
  const undefinedModel = cpiScatterModel(events, now, ids[0], null)
  assert.equal(undefinedModel.inspection.magnitudeMode, 'undefined'); assert.equal(undefinedModel.inspection.distribution, null)
  assert.equal(undefinedModel.inspection.quantile, undefined); assert.equal(undefinedModel.points.length, 3)
  assert.equal(undefinedModel.inspection.samples.length, 3)
  assert.equal(undefinedModel.inspection.earlierCount, 2)
  assert.equal(undefinedModel.deltaUnit, 'pp'); assert.equal(cpiScatterModel(events, now, '840030009', null).deltaUnit, 'pts')
  const nfpRows = release(selectedAt, .2, 'nfp', nfpMagnitudeFamily)
  assert.equal(nfpScatterModel(nfpRows, now, nfpMagnitudeFamily.seriesIds[0], null).inspection.magnitudeMode, 'undefined')
  const incomplete = release(selectedAt + day, .5, 'incomplete').slice(1)
  const duplicate = [...release(selectedAt + 2 * day, .5, 'duplicate'), { ...current[0], value_id: 'duplicate-copy', release_at: selectedAt + 2 * day,
    server_time_seconds: (selectedAt + 2 * day) / 1000 + 10800, chart_time_seconds: (selectedAt + 2 * day) / 1000 + 10800 }]
  assert.equal(cpiScatterModel([...events, ...incomplete, ...duplicate], selectedAt + 3 * day, ids[0], null).inspection.at, selectedAt)
  const settings = Object.fromEntries(ids.map((id) => [id, [.1, .2, .4]]))
  for (const id of ids) {
    const model = cpiScatterModel(events, now, id, null, settings), history = familyMagnitudeHistory(events, selected, cpiMagnitudeFamily, settings)
    assert.deepEqual(model.inspection.distribution, history[current.find((row) => row.event_id === id).value_id].distribution)
    assert.equal(model.inspection.samples.length, 3, 'Current usable publication enters the full dataset')
    assert.equal(model.inspection.quantile, undefined)
  }
  assert.equal(cpiScatterModel(current, now, ids[0], null, settings).inspection.distribution.currentSize, 'Medium', 'Inclusive decimal ties and zero earlier samples work')
  assert.equal(familyMagnitudeHistory(events, selected, nfpMagnitudeFamily)[current[0].value_id], undefined)
  const badUnit = { ...first[0], value_id: 'changed-unit', unit: 0 }
  const badRows = [badUnit, ...first.slice(1)]
  assert.equal(cpiScatterModel([...badRows, ...second, ...current], now, ids[0], null, settings).inspection.excluded, 1)
  assert.equal(familyHistoryReleases([...events, ...release(firstAt - 30 * day, 999), ...release(now + day, 999)], now, cpiMagnitudeFamily).length, 3)
  console.log('✓ CPI catalog, all reading rules, supplied-Previous arithmetic, native rate/index units, complete-release gate, history admission and Inspector/scatter parity')

  const requests = []
  globalThis.fetch = (url, options = {}) => new Promise((resolve) => requests.push({ url: String(url), signal: options.signal, resolve }))
  const respond = (request, body) => { assert.ok(request); return React.act(async () => request.resolve({ ok: true, status: 200, json: async () => body })) }
  const health = { revision: 1, collector_error: null, sources: [{ id: 'Broker-A', publisher_status: 'live', server_now: now / 1000 + 10800, instance_id: 'A' }] }
  const page = (rows, family) => ({ source_id: 'Broker-A', revision: 1, timestamp_convention: 'trade_server_time', time_basis: 'chart',
    event_ids: family.seriesIds, events: rows, coverage: { USD: { missing: [] } }, next_cursor: null })
  let historyView
  function HistoryApp() {
    const history = useFamilyMagnitudeHistory('Broker-A', selected, undefined, clockOffsetMs)
    React.useEffect(() => { historyView = history }, [history])
    return React.createElement('table', {}, React.createElement('tbody', {}, React.createElement('tr', {},
      React.createElement(FamilyMagnitudeCell, { event: current[0], history, grade: 'higher' }))))
  }
  const historyApp = mount(HistoryApp, {})
  await historyApp.render()
  assert.equal(requests.length, 0, 'Undefined Inspector magnitudes do not fetch a hidden P95 baseline')
  assert.equal(historyApp.container.querySelector('[aria-label="Magnitude undefined"]').textContent, '')
  assert.equal(historyApp.container.querySelector('.magnitude-histogram'), null)
  assert.doesNotMatch(historyApp.container.textContent, /Long|Short|Neutral/)

  // The actual Inspector table applies the CPI grade/color adapter, including unconfigured magnitudes.
  function InspectorApp({ history } = {}) {
    const view = useInspector({ events: current, symbol: 'EURUSD', bars: [], timeframe: 'H1', timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 }, clockOffsetMs })
    return React.createElement(InspectorPanel, { view: history ? { ...view, magnitudeHistory: history } : view, symbol: 'EURUSD', source: null, error: null, timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 } })
  }
  const inspector = mount(InspectorApp, {})
  const showView = async (label) => change(inspector.container.querySelector('[aria-label="Inspector view"]'), label === 'Table only' ? 'table' : 'scoring')
  await inspector.render(); await click(inspector.container.querySelector('.inspector-release'))
  assert.equal(inspector.container.querySelectorAll('.inspector-table-scroll td.inspector-grade-higher').length, 8)
  assert.equal(inspector.container.querySelectorAll('.inspector-table-scroll td.inspector-grade-lower').length, 1)
  assert.equal(inspector.container.querySelectorAll('.inspector-table-scroll td.inspector-grade-unchanged').length, 1)
  await showView('Scoring system')
  assert.equal(inspector.container.querySelector('[aria-label="CPI v4 standalone direction"]').textContent, 'Uncomputed')
  assert.equal(inspector.container.querySelectorAll('[aria-label="CPI v4 standalone component scores"] tbody tr').length, 4)
  assert.equal(inspector.container.querySelector('.inspector-cpi-index-score'), null, 'Retired index scorer is absent')
  await showView('Table only')
  assert.equal(inspector.container.querySelectorAll('[aria-label="Magnitude undefined"]').length, 10)

  const dock = mount(ScatterPlotDock, { brokerId: 'Broker-A', clockOffsetMs })
  await dock.render()
  assert.equal(requests.length, 1)
  const stale = requests[0]
  await change(dock.container.querySelector('[aria-label="Scatter Plot Family"]'), 'CPI')
  assert.equal(stale.signal.aborted, true, 'Switching families cancels the previous inventory')
  await respond(requests[1], health)
  const params = new URL('http://localhost' + requests[2].url).searchParams
  assert.deepEqual(params.get('event_ids').split(',').sort(), ids.slice().sort())
  assert.equal(params.get('currency'), 'USD'); assert.equal(Number(params.get('from_server_seconds')), Date.UTC(2015, 0, 1) / 1000)
  await respond(requests[2], page(events, cpiMagnitudeFamily)); await respond(stale, health)
  assert.equal(dock.container.querySelector('[aria-label="Scatter Plot Family"]').value, 'CPI')
  assert.equal(dock.container.querySelector('[aria-label="Scatter Plot Series"]').querySelectorAll('option').length, 10)
  assert.equal(dock.container.querySelector('.scatter-plot-inspection time').textContent, '2015-03-24')
  assert.equal(dock.container.querySelector('[aria-label="Magnitude mode"]').value, 'undefined')
  assert.equal(dock.container.querySelector('[data-threshold]'), null)
  assert.equal(dock.container.querySelector('[data-cutoff]'), null)
  assert.equal(dock.container.querySelectorAll('[data-point-id]').length, 3)
  assert.match(dock.container.querySelector('.scatter-plot-selected').getAttribute('class'), /higher/)
  await change(dock.container.querySelector('[aria-label="Magnitude mode"]'), 'custom')
  assert.equal(requests.length, 3, 'An uncommitted custom draft never changes Inspector history')
  for (const [label, value] of [['Small', .1], ['Medium', .2], ['Large', .4]]) await change(dock.container.querySelector(`[aria-label="${label} upper boundary"]`), value)
  assert.equal(dock.container.querySelector('[data-threshold]').dataset.threshold, '0.4', 'An initially Undefined series previews valid boundaries immediately')
  assert.equal(dock.container.querySelector('button[aria-pressed="true"]').textContent, 'Full range', 'First valid draft activates Boundary zoom by default')
  assert.deepEqual(cpiMagnitudeFamily.settings.read(), {}, 'Live preview is not persisted before Freeze')
  assert.equal(historyApp.container.querySelector('.magnitude-histogram'), null, 'Inspector continues using the saved configuration')
  assert.equal(requests.length, 3, 'Preview never activates Inspector inventory requests')
  const previewRange = { ...dock.container.querySelector('svg').dataset }
  await click([...dock.container.querySelectorAll('button')].find((button) => button.textContent === 'Freeze'))
  assert.deepEqual({ ...dock.container.querySelector('svg').dataset }, previewRange, 'Freezing the preview preserves its zoom and coordinates')
  assert.deepEqual(cpiMagnitudeFamily.settings.read()[ids[0]], [.1, .2, .4])
  assert.deepEqual(nfpMagnitudeFamily.settings.read(), {}, 'CPI configuration cannot leak into NFP')
  assert.equal(dock.container.querySelector('[data-threshold]').dataset.threshold, '0.4')
  assert.deepEqual([...dock.container.querySelectorAll('[data-cutoff]')].map((line) => Number(line.dataset.cutoff)), [.1, -.1, .2, -.2, .4, -.4])
  assert.equal(requests.length, 4, 'First configuration activates one bounded Inspector history query')
  await respond(requests[3], health)
  const inspectorParams = new URL('http://localhost' + requests[4].url).searchParams
  assert.equal(Number(inspectorParams.get('to_server_seconds')), (Math.floor(now / day) * day + 2 * day) / 1000)
  assert.deepEqual(inspectorParams.get('event_ids').split(',').sort(), ids.slice().sort())
  await respond(requests[4], page(events, cpiMagnitudeFamily))
  assert.deepEqual(historyView.rows[current[0].value_id].distribution, cpiScatterModel(events, now, ids[0], null, cpiMagnitudeFamily.settings.read()).inspection.distribution)
  assert.equal(historyApp.container.querySelector('.magnitude-size').textContent, 'Medium')
  assert.equal(Object.values(historyView.rows).filter(row => row.mode === 'undefined').length, 9,
    'Configuring one reading must leave the other nine series unconfigured')
  await inspector.render({ history: historyView })
  const toggleHistogram = (label) => [...inspector.container.querySelectorAll('button')].find((button) => button.textContent.trim() === label)
  assert.equal(inspector.container.querySelectorAll('.magnitude-histogram').length, 1)
  await showView('Scoring system')
  const summaryBeforeHide = inspector.container.querySelector('[aria-label="CPI v4 standalone component scores"]').textContent
  await showView('Table only')
  const cutoffsBeforeHide = cpiMagnitudeFamily.settings.read()
  const distributionBeforeHide = historyView.rows[current[0].value_id].distribution
  await click(toggleHistogram('Hide histogram'))
  assert.equal(inspector.container.querySelector('.inspector-magnitude-table'), null)
  assert.equal(inspector.container.querySelector('.magnitude-histogram'), null)
  assert.equal(inspector.container.querySelectorAll('.inspector-table-scroll thead th').length, 5)
  assert.equal(inspector.container.querySelector('.inspector-table-scroll thead th:last-child').textContent.trim(), 'Magnitude')
  assert.equal(inspector.container.querySelector('.inspector-magnitude-only .magnitude-size').textContent, 'Medium', 'Hiding the histogram retains the selected magnitude label')
  assert.ok(inspector.container.querySelector('.inspector-magnitude-only .magnitude-size').classList.contains('inspector-grade-higher'))
  assert.equal(inspector.container.querySelectorAll('.inspector-magnitude-only').length, 10)
  assert.equal(inspector.container.querySelectorAll('[aria-label="Magnitude undefined"]').length, 9, 'Undefined remains empty in magnitude-only mode')
  for (const row of inspector.container.querySelectorAll('.inspector-table-scroll tbody tr')) assert.equal(row.children.length, 5)
  await showView('Scoring system')
  assert.equal(inspector.container.querySelector('[aria-label="CPI v4 standalone component scores"]').textContent, summaryBeforeHide, 'Hiding histograms never changes the current scoring interpretation')
  await showView('Table only')
  assert.equal(JSON.parse(localStorage.getItem(inspectorStorageKey)).showHistograms, false)
  assert.equal(readInspectorPreferences().showHistograms, false, 'A fresh preference read preserves hidden histograms')
  assert.deepEqual(cpiMagnitudeFamily.settings.read(), cutoffsBeforeHide, 'Visibility never edits per-series boundaries')
  assert.deepEqual(historyView.rows[current[0].value_id].distribution, distributionBeforeHide, 'Visibility never changes calculation N or history')
  assert.equal(requests.length, 5, 'Toggling visibility performs no inventory query')
  const reloadedInspector = mount(InspectorApp, { history: historyView })
  await reloadedInspector.render(); await click(reloadedInspector.container.querySelector('.inspector-release'))
  assert.equal(reloadedInspector.container.querySelector('.magnitude-histogram'), null, 'A fresh Inspector mount restores hidden histograms')
  assert.equal(reloadedInspector.container.querySelector('.inspector-magnitude-only .magnitude-size').textContent, 'Medium', 'Reload keeps the magnitude visible')
  assert.ok([...reloadedInspector.container.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Show histogram'))
  await click(toggleHistogram('Show histogram'))
  assert.equal(inspector.container.querySelectorAll('.magnitude-histogram').length, 1)
  assert.equal(inspector.container.querySelectorAll('.inspector-table-scroll thead th').length, 5)
  assert.equal(readInspectorPreferences().showHistograms, true)
  assert.equal(inspector.container.querySelector('.inspector-magnitude-only'), null, 'Restoring histograms also restores their original cell layout')
  const requestCount = requests.length
  await change(dock.container.querySelector('[aria-label="Magnitude mode"]'), 'undefined')
  assert.equal(historyApp.container.querySelector('.magnitude-histogram'), null)
  assert.equal(historyApp.container.querySelector('[aria-label="Magnitude undefined"]').textContent, '')
  assert.equal(dock.container.querySelector('[data-cutoff]'), null)
  assert.deepEqual(cpiMagnitudeFamily.settings.read(), {})
  assert.equal(requests.length, requestCount, 'Undefined clears Inspector classification without refetching')
  await change(dock.container.querySelector('[aria-label="Magnitude mode"]'), 'custom')
  for (const [label, value] of [['Small', .1], ['Medium', .2], ['Large', .4]]) await change(dock.container.querySelector(`[aria-label="${label} upper boundary"]`), value)
  await click([...dock.container.querySelectorAll('button')].find((button) => button.textContent === 'Freeze'))
  assert.deepEqual(cpiMagnitudeFamily.settings.read()[ids[0]], [.1, .2, .4])
  await respond(requests[requestCount], health); await respond(requests[requestCount + 1], page(events, cpiMagnitudeFamily))
  await change(dock.container.querySelector('[aria-label="Small band color"]'), '#264653')
  const index = '840030009'
  await change(dock.container.querySelector('[aria-label="Scatter Plot Series"]'), index)
  assert.equal(dock.container.querySelector('[aria-label="Magnitude mode"]').value, 'undefined', 'Modes are independent per series')
  assert.match(dock.container.querySelector('.scatter-plot-inspection').textContent, /A−P\+0.2 pts.*SizeUndefined/)
  await React.act(async () => { cpiMagnitudeFamily.settings.save(index, [1, 2, 3]); nfpMagnitudeFamily.settings.save('840030016', [10, 20, 30]) })
  assert.equal(dock.container.querySelector('[data-threshold]').dataset.threshold, '3')
  assert.equal(dock.container.querySelector('[aria-label="Small band color"]').value, '#264653', 'CPI indexes and rates share colors across magnitude modes')
  await change(dock.container.querySelector('[aria-label="Scatter Plot Family"]'), 'NFP')
  let start = requests.length - 1
  await respond(requests[start], health); await respond(requests[start + 1], page(nfpRows, nfpMagnitudeFamily))
  assert.equal(dock.container.querySelector('[data-threshold]').dataset.threshold, '30')
  assert.equal(dock.container.querySelector('[aria-label="Small band color"]').value, '#264653', 'CPI and NFP share one saved palette')
  await change(dock.container.querySelector('[aria-label="Small band color"]'), '#e76f51')
  await change(dock.container.querySelector('[aria-label="Scatter Plot Family"]'), 'CPI')
  start = requests.length - 1
  await respond(requests[start], health); await respond(requests[start + 1], page(events, cpiMagnitudeFamily))
  assert.equal(dock.container.querySelector('[aria-label="Magnitude mode"]').value, 'custom', 'Family switching preserves separately saved modes')
  assert.equal(dock.container.querySelector('[aria-label="Small band color"]').value, '#e76f51', 'A color edited in NFP Custom also applies in CPI P95')
  await change(dock.container.querySelector('[aria-label="Scatter Plot Series"]'), index)
  assert.equal(dock.container.querySelector('[data-threshold]').dataset.threshold, '3', 'Family switching preserves custom boundaries')
  console.log('✓ CPI Inspector delta colors, empty Undefined cells, isolated settings, family cancellation, raw dots, mode drafts/apply, shared live histograms and native-unit guides')
} finally {
  for (const root of roots) await React.act(async () => root.unmount())
  await server.close(); await dom.happyDOM.abort(); dom.close()
  for (const key of keys) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key] }
}
