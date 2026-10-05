import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'),
  server: { middlewareMode: true, hmr: false } })
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
const change = (element, value) => React.act(async () => {
  assert.ok(element)
  const props = element[Object.getOwnPropertyNames(element).find((key) => key.startsWith('__reactProps$'))]
  if (props?.onChange) props.onChange({ target: { value: String(value) } })
  else { element.value = value; element.dispatchEvent(new dom.Event('change', { bubbles: true })) }
})
const click = (element) => React.act(async () => { assert.ok(element); element.click() })
const requests = []
globalThis.fetch = (url, options = {}) => new Promise((resolve) => requests.push({ url: String(url), signal: options.signal, resolve }))
const respond = (request, body) => React.act(async () => { assert.ok(request); request.resolve({ ok: true, json: async () => body }) })
const at = Date.UTC(2026, 9, 1, 12), now = at + 1000, clockOffsetMs = now - Date.now()

try {
  const { ppiMagnitudeFamily: family, cpiMagnitudeFamily, nfpMagnitudeFamily } = await server.ssrLoadModule('./src/inspector/magnitude/magnitude-families.ts')
  const { ppiRevisedComparison } = await server.ssrLoadModule('./src/inspector/grading/ppi-grading.ts')
  const { gradeFamilyReading } = await server.ssrLoadModule('./src/inspector/grading/reading-grading.ts')
  const { groupInspectorReleases, inspectorDelta, inspectorRevisedDelta } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { familyMagnitudeHistory } = await server.ssrLoadModule('./src/inspector/magnitude/family-magnitude-history.ts')
  const { ppiScatterModel } = await server.ssrLoadModule('./src/scatter-plot/PAIR/EURUSD/USD/PPI/ppi-scatter-adapter.ts')
  const { ScatterPlotDock } = await server.ssrLoadModule('./src/scatter-plot/index.ts')
  const { scatterReleaseTarget } = await server.ssrLoadModule('./src/scatter-plot/navigation/scatter-release-target.ts')
  const { useInspector } = await server.ssrLoadModule('./src/inspector/useInspector.ts')
  const { InspectorPanel } = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  const { exportWorkspace, parseWorkspaceSnapshot, restoreWorkspace } = await server.ssrLoadModule('./src/workspace-portability/workspace-snapshot.ts')
  const ids = family.seriesIds
  assert.deepEqual(ids, ['840030001', '840030002', '840030003', '840030004'])
  const values = [[.5, .7, .5], [.1, .5, .3], [4, 3.4, null], [3.8, 3.9, null]]
  const release = (time) => ids.map((id, index) => {
    const [actual, previous, revised_previous] = values[index]
    return { value_id: `${time}-${id}`, event_id: id, name: family.readingRules[id].name, currency: 'USD', country_code: 'US', country_name: 'United States',
      event_code: id, server_time_seconds: time / 1000 + 10800, chart_time_seconds: time / 1000 + 10800, release_at: time,
      period_seconds: 0, revision: 0, time_mode: 0, importance: 'high', impact: 'none', availability: 'observed',
      unit: 1, multiplier: 0, digits: 1, actual, previous, revised_previous, forecast: 999,
      actual_raw_scaled_1e6: String(Math.round(actual * 1e6)), previous_raw_scaled_1e6: String(Math.round(previous * 1e6)),
      revised_previous_raw_scaled_1e6: revised_previous === null ? null : String(Math.round(revised_previous * 1e6)) }
  })
  const current = release(at), events = [...release(at - 31 * 86400000), ...current]
  const selected = groupInspectorReleases(current)[0]
  assert.equal(inspectorDelta(current[0]), -.2); assert.equal(inspectorRevisedDelta(current[0]), 0)
  assert.equal(ppiRevisedComparison(current[0], 'ppi').grade, 'unchanged')
  assert.equal(ppiRevisedComparison(current[1], 'ppi').delta, -.2)
  assert.equal(ppiRevisedComparison(current[2], 'ppi'), null)
  for (const overrides of [{ revised_previous: null }, { revised_previous: NaN }, { currency: 'EUR' },
    { country_code: 'EU' }, { event_id: '840030005' }]) assert.equal(ppiRevisedComparison({ ...current[0], ...overrides }, 'ppi'), null)
  assert.equal(ppiRevisedComparison(current[0], 'us-cpi'), null)
  assert.equal(ppiRevisedComparison({ ...current[0], revised_previous: .7, revised_previous_raw_scaled_1e6: '700000' }, 'ppi').delta, -.2,
    'A supplied revision equal to Previous still has a comparison')
  assert.equal(ppiRevisedComparison({ ...current[0], revised_previous: 0, revised_previous_raw_scaled_1e6: '0' }, 'ppi').grade, 'higher')
  assert.equal(ppiRevisedComparison({ ...current[0], actual: null }, 'ppi').grade, 'missing')
  assert.equal(ppiRevisedComparison({ ...current[0], revised_previous_raw_scaled_1e6: 'invalid' }, 'ppi').delta, null)
  assert.equal(inspectorRevisedDelta({ ...current[0], actual_raw_scaled_1e6: '500001' }), .000001)
  for (const [index, expected] of ['lower', 'lower', 'higher', 'lower'].entries()) {
    assert.equal(gradeFamilyReading(current[index], 'ppi', family).grade, expected)
  }
  const settings = Object.fromEntries(ids.map((id) => [id, [.1, .2, .4]]))
  for (const id of ids) {
    const model = ppiScatterModel(events, now, id, selected.id, settings)
    const history = familyMagnitudeHistory(events, selected, family, settings, now)
    assert.equal(model.deltaUnit, 'pp'); assert.equal(model.points.length, 2)
    assert.deepEqual(history[current.find((row) => row.event_id === id).value_id].distribution, model.inspection.distribution)
  }
  const changedRevisions = events.map((row) => ({ ...row, revised_previous: 100, revised_previous_raw_scaled_1e6: '100000000' }))
  const originalModel = ppiScatterModel(events, now, ids[0], selected.id, settings)
  const revisedModel = ppiScatterModel(changedRevisions, now, ids[0], selected.id, settings)
  assert.deepEqual(originalModel.points, revisedModel.points)
  assert.deepEqual(originalModel.inspection, revisedModel.inspection, 'Revised comparisons never change raw A−P dots, counts or magnitudes')

  function InspectorApp({ rows = current, configured = false }) {
    const view = useInspector({ events: rows, symbol: 'EURUSD', bars: [], timeframe: 'H1',
      timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 }, clockOffsetMs })
    const history = { rows: familyMagnitudeHistory(events, view.selectedRelease, family, configured ? settings : {}, now),
      partial: false, message: null, error: null }
    return React.createElement(InspectorPanel, { view: { ...view, magnitudeHistory: history }, symbol: 'EURUSD',
      source: null, error: null, timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 }, onOpenScatter: () => {} })
  }
  const inspector = mount(InspectorApp, {})
  await inspector.render(); await click(inspector.container.querySelector('.inspector-release'))
  assert.equal(inspector.container.querySelectorAll('.inspector-table-scroll tbody tr').length, 4)
  assert.equal(inspector.container.querySelectorAll('td.inspector-graded-delta .inspector-secondary-reading').length, 2)
  assert.equal(inspector.container.querySelectorAll('[aria-label="Magnitude undefined"]').length, 4)
  assert.equal(inspector.container.querySelector('option[value="scatter"]').disabled, false)
  assert.equal(inspector.container.querySelector('option[value="scoring"]').disabled, true)
  await inspector.render({ configured: true })
  const rendered = [...inspector.container.querySelectorAll('.inspector-table-scroll tbody tr')]
  assert.match(rendered[0].children[3].textContent, /-0.2 pp.*Lower.*A−RevP: 0 pp.*Unchanged/)
  assert.match(rendered[0].lastElementChild.textContent, /Medium.*A−RevP: Unchanged/)
  assert.match(rendered[1].lastElementChild.textContent, /Large.*A−RevP: Medium/)
  assert.equal(rendered[2].querySelector('.inspector-secondary-reading'), null)
  await click(inspector.container.querySelector('[aria-label="Hide histogram"]'))
  assert.equal(inspector.container.querySelector('.magnitude-histogram'), null)
  assert.match(rendered[0].lastElementChild.textContent, /Medium.*A−RevP: Unchanged/)
  await inspector.render({ configured: true, rows: current.map((row) => ({ ...row, revised_previous: null })) })
  assert.equal(inspector.container.querySelector('.inspector-secondary-reading'), null)
  assert.equal(requests.length, 0)

  const target = scatterReleaseTarget(selected, 'Broker-A', now)
  assert.equal(target.familyId, 'ppi')
  const dock = mount(ScatterPlotDock, { brokerId: 'Broker-A', clockOffsetMs, target })
  await dock.render()
  const health = { revision: 1, collector_error: null, sources: [{ id: 'Broker-A', publisher_status: 'live' }] }
  await respond(requests[0], health)
  const params = new URL('http://localhost' + requests[1].url).searchParams
  assert.equal(params.get('currency'), 'USD'); assert.deepEqual(params.get('event_ids').split(',').sort(), ids.slice().sort())
  await respond(requests[1], { source_id: 'Broker-A', revision: 1, timestamp_convention: 'trade_server_time', time_basis: 'chart',
    event_ids: ids, events, coverage: { USD: { missing: [] } }, next_cursor: null })
  assert.equal(dock.container.querySelector('[aria-label="Scatter Plot Family"]').value, 'PPI')
  assert.equal(dock.container.querySelector('[aria-label="Scatter Plot Series"]').options.length, 4)
  assert.equal(dock.container.querySelector('[aria-label="Magnitude mode"]').value, 'undefined')
  await change(dock.container.querySelector('[aria-label="Magnitude mode"]'), 'custom')
  for (const [label, value] of [['Small', .1], ['Medium', .2], ['Large', .4]]) {
    await change(dock.container.querySelector(`[aria-label="${label} upper boundary"]`), value)
  }
  await click([...dock.container.querySelectorAll('button')].find((button) => button.textContent === 'Freeze'))
  assert.deepEqual(family.settings.read()[ids[0]], [.1, .2, .4])
  assert.deepEqual(cpiMagnitudeFamily.settings.read(), {}); assert.deepEqual(nfpMagnitudeFamily.settings.read(), {})
  const saved = parseWorkspaceSnapshot(JSON.stringify(exportWorkspace()))
  await React.act(async () => { family.settings.save(ids[0], null); restoreWorkspace(saved) })
  assert.deepEqual(family.settings.read()[ids[0]], [.1, .2, .4], 'PPI settings participate in workspace backup/restore')
  console.log('✓ PPI-only optional revised delta, precision/zero/missing/scope gates, sign colors, shared manual magnitudes, undoubled N, histogram hiding, scoped scatter/freeze/navigation and workspace restore')
} finally {
  await React.act(async () => roots.forEach((root) => root.unmount()))
  await server.close(); await dom.happyDOM.abort(); dom.close()
  for (const key of keys) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key] }
}
