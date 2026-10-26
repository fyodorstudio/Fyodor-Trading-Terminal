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
const at = Date.parse('2026-10-15T06:45:00Z'), period = Date.parse('2026-09-01T00:00:00Z') / 1000
const row = (event_id, name, extra = {}) => ({ value_id: event_id, event_id, name, currency: 'EUR', country_code: 'FR', country_name: 'France', event_code: event_id,
  server_time_seconds: at / 1000, chart_time_seconds: at / 1000, release_at: at, period_seconds: period, revision: 0,
  importance: 'high', unit: 1, multiplier: 0, digits: 1, time_mode: 0, impact: 'none', actual: null, previous: .1, revised_previous: null, forecast: .2,
  ...extra })
const readings = [row('250010001', 'CPI m/m'), row('250010002', 'CPI y/y'), row('250010003', 'HICP m/m'), row('250010004', 'HICP y/y')]
try {
  const data = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { groupInspectorDays, selectedInspectorRelease } = await server.ssrLoadModule('./src/inspector/releases/group-days.ts')
  const { dayGroups } = await server.ssrLoadModule('./src/alert/model/alert-day-model.ts')
  const { highlightRequest } = await server.ssrLoadModule('./src/alert/highlights/highlight-model.ts')
  const { InspectorChartMarkers } = await server.ssrLoadModule('./src/inspector/InspectorChartMarkers.tsx')
  const { InspectorReadingsTable } = await server.ssrLoadModule('./src/inspector/readings/InspectorReadingsTable.tsx')
  const groups = data.groupInspectorReleases(readings), release = groups[0]
  assert.equal(groups.length, 1)
  assert.equal(release.label, 'French CPI / HICP')
  assert.equal(release.country, 'FR')
  assert.equal(release.familyIds.length, 2, 'Original CPI and HICP filter identities survive')
  assert.deepEqual(release.events.map(event => event.name), ['CPI m/m', 'HICP m/m', 'CPI y/y', 'HICP y/y'])
  assert.ok(release.events.every(event => readings.includes(event)), 'Raw readings retain their identity and values')
  for (const identity of release.sourceReleaseIds) assert.equal(selectedInspectorRelease(groups, groups, identity, { mode: 'utc' }), release)
  const preferences = data.defaultInspectorPreferences('EURUSD'), range = { from: at - 86400000, to: at + 86400000 }
  const hicpFamily = data.inspectorFamilies.find(family => family.events.includes('250010003')).id
  const filtered = data.filterInspectorReleases(groups, { ...preferences, families: [hicpFamily] }, range)
  assert.equal(filtered.length, 1); assert.equal(filtered[0].events.length, 2)
  assert.ok(filtered[0].events.every(event => event.name.startsWith('HICP')), 'CPI-only/HICP-only saved selections remain effective')
  assert.equal(data.filterInspectorReleases(groups, { ...preferences, families: [] }, range).length, 0)
  assert.equal(dayGroups(readings, [], '2026-10-15', 'Pepperstone-Demo', { families: [hicpFamily], currency: 'all' })[0].release.events.length, 2)
  const daily = groupInspectorDays(groups, [hicpFamily], range, { mode: 'utc' }, { brokerId: null, brokerOffsetSeconds: 0 })
  assert.equal(daily[0].daily.sections[0].releaseCount, 1)
  assert.equal(daily[0].events.length, 2)
  const request = highlightRequest(release, 'fixture')
  assert.equal(request.value_ids.length, 4); assert.equal(request.event_ids.length, 4, 'Pin captures the entire package')
  assert.equal(data.groupInspectorReleases(readings.map(event => ({ ...event, time_mode: 1 }))).length, 4, 'Unverified hours are not merged by apparent proximity')
  const later = readings.map((event, i) => i === 3 ? { ...event, release_at: at + 60000, chart_time_seconds: at / 1000 + 60 } : event)
  assert.equal(data.groupInspectorReleases(later).length, 2, 'Different publication times remain distinct')
  const otherPeriod = readings.map((event, i) => i === 3 ? { ...event, period_seconds: period - 31 * 86400 } : event)
  assert.equal(data.groupInspectorReleases(otherPeriod).length, 2, 'Different reference periods remain distinct')
  const germany = ['276010020', '276010021', '276010022', '276010023'].map(id => row(id, id, { country_code: 'DE' }))
  assert.equal(data.groupInspectorReleases([...readings, ...germany]).length, 2, 'Simultaneous French and German packages stay separate')
  const revised = data.groupInspectorReleases([...readings, { ...readings[0], value_id: 'revision', revision: 1, actual: .4 }])[0]
  assert.equal(revised.events.length, 5, 'Revision/value identities remain on individual rows')
  const bars = [at / 1000 - 2700, at / 1000 + 900].map(time => ({ time, open: 1, high: 2, low: .5, close: 1.5 }))
  const markers = data.buildInspectorMarkers(groups, preferences, bars, 'H1')
  assert.equal(markers.length, 1, 'One chart icon for the complete package')
  const listeners = new Set(), sizes = new Set()
  const scale = { getVisibleRange: () => ({ from: bars[0].time, to: bars[1].time }), width: () => 500,
    timeToCoordinate: () => 100, subscribeVisibleLogicalRangeChange: fn => listeners.add(fn), unsubscribeVisibleLogicalRangeChange: fn => listeners.delete(fn),
    subscribeSizeChange: fn => sizes.add(fn), unsubscribeSizeChange: fn => sizes.delete(fn) }
  let selected = null
  function App() {
    const [show, setShow] = React.useState(false)
    return React.createElement(React.Fragment, null,
      React.createElement(InspectorChartMarkers, { chartApi: { timeScale: () => scale }, markers, timeDisplay: { mode: 'utc' }, onSelectRelease: id => { selected = id; setShow(true) } }),
      show && React.createElement(InspectorReadingsTable, { release, timeDisplay: { mode: 'utc' }, sharedPeriod: period }))
  }
  await React.act(async () => root.render(React.createElement(App)))
  assert.equal(node.querySelectorAll('.inspector-chart-symbol').length, 1)
  await React.act(async () => node.querySelector('.inspector-chart-symbol').click())
  assert.equal(selected, release.id)
  assert.equal(node.querySelectorAll('tr[data-series-id]').length, 4)
  assert.equal(node.querySelector('.inspector-publication-heading'), null, 'Same-publication series use one flat CPI-style table')
  assert.equal(node.querySelector('.inspector-marker-popup'), null)
  await React.act(async () => root.render(null)); assert.equal(listeners.size, 0); assert.equal(sizes.size, 0)
  console.log('✓ French CPI/HICP: one release/icon/table, all four original series, exact country/time/period boundaries, revisions, family filters, legacy selections, day counts and complete pins')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
