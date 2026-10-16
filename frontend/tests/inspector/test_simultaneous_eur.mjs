import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node, navigator: dom.navigator,
  localStorage: dom.localStorage, IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const { createRoot } = await import('react-dom/client')
const node = document.createElement('div'); document.body.append(node); const root = createRoot(node)
const at = Date.parse('2026-10-16T09:00:00Z'), period = Date.parse('2026-09-01T00:00:00Z') / 1000
const display = { mode: 'fixed-offset', utcOffsetMinutes: 420 }, clockOffsetMs = at - Date.now()
const row = (event_id, name, country_code = 'IT', extra = {}) => ({ value_id: event_id, event_id, name, currency: 'EUR', country_code,
  country_name: country_code, event_code: event_id, server_time_seconds: at / 1000, chart_time_seconds: at / 1000, release_at: at,
  period_seconds: period, revision: 0, importance: 'medium', unit: 1, multiplier: 0, digits: 1, time_mode: 0, impact: 'none',
  actual: null, previous: .1, revised_previous: .2, forecast: .3, ...extra })
const readings = [row('380010025', 'CPI FOI excl. Tobacco m/m'), row('380010026', 'CPI FOI excl. Tobacco y/y'),
  row('380010001', 'CPI m/m'), row('380010002', 'CPI y/y'), row('380010003', 'HICP m/m'), row('380010004', 'HICP y/y'),
  row('999030011', 'CPI m/m', 'EU'), row('999030010', 'CPI y/y', 'EU'), row('999030013', 'Core CPI m/m', 'EU'), row('999030012', 'Core CPI y/y', 'EU')]
const bars = [at / 1000 - 3600, at / 1000, at / 1000 + 3600].map(time => ({ time, open: 1, high: 2, low: .5, close: 1.5 }))
const listeners = new Set(), sizes = new Set()
const scale = { getVisibleRange: () => ({ from: bars[0].time, to: bars[2].time }), width: () => 500, timeToCoordinate: () => 100,
  subscribeVisibleLogicalRangeChange: fn => listeners.add(fn), unsubscribeVisibleLogicalRangeChange: fn => listeners.delete(fn),
  subscribeSizeChange: fn => sizes.add(fn), unsubscribeSizeChange: fn => sizes.delete(fn) }
const chartApi = { timeScale: () => scale }
try {
  const data = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { groupSimultaneousEurReleases: group } = await server.ssrLoadModule('./src/inspector/releases/simultaneous-eur-releases.ts')
  const { selectedInspectorRelease } = await server.ssrLoadModule('./src/inspector/releases/group-days.ts')
  const { useInspector } = await server.ssrLoadModule('./src/inspector/useInspector.ts')
  const { InspectorPanel } = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  const { InspectorChartMarkers } = await server.ssrLoadModule('./src/inspector/InspectorChartMarkers.tsx')
  const sources = data.groupInspectorReleases(readings), combined = group(sources)[0]
  assert.equal(sources.length, 7, 'Original country/family publications remain distinct')
  assert.equal(group(sources).length, 1)
  assert.equal(combined.label, 'EUR inflation')
  assert.equal(combined.events.length, readings.length)
  assert.ok(combined.events.every(event => readings.includes(event)), 'Raw readings, revisions and blanks retain their identity')
  for (const source of sources) assert.equal(selectedInspectorRelease([combined], sources, source.id, display), combined)
  const preferences = data.defaultInspectorPreferences('EURUSD'), range = { from: at - 60000, to: at + 60000 }
  const italy = sources.find(source => source.events[0].event_id === '380010001')
  const filtered = data.filterInspectorReleases([combined], { ...preferences, families: [italy.familyId] }, range)
  const italianCpi = sources.filter(source => source.familyId === italy.familyId).flatMap(source => source.events)
  assert.deepEqual(filtered[0].events, italianCpi, 'Existing family filters exclude hidden countries/series')
  assert.equal(data.filterInspectorReleases([combined], { ...preferences, families: [] }, range).length, 0)
  const us = row('840030005', 'US CPI m/m', 'US', { currency: 'USD' })
  assert.equal(group(data.groupInspectorReleases([...readings, us])).length, 2, 'USD never joins the EUR table')
  for (const extra of [{ time_mode: 1 }, { time_mode: 3, actual: .4 }, { release_at: at + 60000, chart_time_seconds: at / 1000 + 60 },
    { chart_time_seconds: at / 1000 + 3600 }, { release_at: null, chart_time_seconds: null }]) {
    const separate = data.groupInspectorReleases([row('380010001', 'CPI m/m'), row('999030011', 'CPI m/m', 'EU', extra)])
    assert.equal(group(separate).length, 2, 'Only identical verified publication and chart clocks join')
  }
  const policy = row('999010003', 'ECB rate', 'EU')
  assert.equal(group(data.groupInspectorReleases([...readings, policy])).length, 2, 'Policy stages retain their existing grouping')
  const revision = { ...readings[0], value_id: 'revision', revision: 1, actual: .4, period_seconds: period - 31 * 86400 }
  assert.ok(group(data.groupInspectorReleases([...readings, revision]))[0].events.includes(revision), 'Different reference periods stay attached to their rows')
  let view
  function App() {
    const inspector = useInspector({ events: readings, symbol: 'EURUSD', bars, timeframe: 'H1', timeDisplay: display, clockOffsetMs })
    React.useEffect(() => { view = inspector }, [inspector])
    return React.createElement(React.Fragment, null,
      React.createElement(InspectorChartMarkers, { chartApi, markers: inspector.markers, timeDisplay: display, onSelectRelease: inspector.selectRelease }),
      React.createElement(InspectorPanel, { view: inspector, symbol: 'EURUSD', source: null, error: null, timeDisplay: display }))
  }
  await React.act(async () => root.render(React.createElement(App)))
  assert.equal(view.allReleases.length, 7)
  assert.equal(view.releases.length, 1, 'Production hook groups the seven publications')
  assert.equal(node.querySelectorAll('.inspector-chart-symbol').length, 1)
  const stable = view.releases
  await React.act(async () => root.render(React.createElement(App)))
  assert.equal(view.releases, stable, 'Unchanged data does not rebuild the grouping')
  await React.act(async () => node.querySelector('.inspector-chart-symbol').click())
  assert.equal(node.querySelector('.inspector-marker-popup'), null, 'One click opens the complete table without a seven-item chooser')
  assert.equal(node.querySelectorAll('tr[data-series-id]').length, readings.length)
  assert.match(node.querySelector('tr[data-series-id="380010001"]').textContent, /IT/)
  assert.match(node.querySelector('tr[data-series-id="999030011"]').textContent, /EU/)
  await React.act(async () => view.applyPreferences({ ...view.preferences, families: [italy.familyId] }, 'preview'))
  assert.equal(node.querySelectorAll('tr[data-series-id]').length, italianCpi.length)
  await React.act(async () => view.applyPreferences({ ...preferences, symbolGrouping: 'day' }, 'preview'))
  assert.ok(view.selectedRelease.daily, 'An open combined selection resolves when switching to By day')
  assert.equal(view.releases[0].events.length, readings.length)
  await React.act(async () => view.applyPreferences(preferences, 'preview'))
  assert.equal(view.selectedRelease.events.length, readings.length)
  await React.act(async () => root.render(null))
  assert.equal(listeners.size, 0); assert.equal(sizes.size, 0)
  console.log('✓ Simultaneous EUR: seven publications, one icon/table, original countries/values/periods, filters, exact clocks, independent USD/policy, stable renders and daily selection')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
