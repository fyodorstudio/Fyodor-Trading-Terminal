import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ root: rootDir, server: { middlewareMode: true } })
const dom = new Window({ url: 'http://localhost:5173' })
const globals = ['window', 'document', 'HTMLElement', 'HTMLDialogElement', 'Node', 'navigator', 'DOMException', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT', 'fetch']
const previous = Object.fromEntries(globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of globals.slice(0, 8)) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : dom[key] })
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = await import('react-dom/client')
const { act } = React
const roots = []
const utc = { mode: 'utc', utcOffsetMinutes: 0 }
const anchor = Math.floor(Date.UTC(2026, 9, 1, 12) / 1000)
const fixtureClockOffset = anchor * 1000 - Date.now()
const event = (overrides = {}) => ({ value_id: 'a', event_id: '840030005', server_time_seconds: anchor,
  release_at: anchor * 1000, period_seconds: Date.UTC(2026, 8, 1) / 1000, revision: 0,
  currency: 'USD', country_code: 'US', country_name: 'United States', name: 'CPI m/m', event_code: 'cpi',
  importance: 'high', unit: 1, multiplier: 0, digits: 1, time_mode: 0, impact: 'none',
  actual: 0.3, forecast: 0.4, previous: 0.1, revised_previous: 0.2, ...overrides })
const bars = [anchor - 3600, anchor, anchor + 3600].map((time) => ({ time, open: 1, high: 2, low: .5, close: 1.5 }))
const source = (instance = 'A', revision = 1) => ({ instance_id: instance, last_update_at: revision, event_count: 2,
  status: 'live', server_utc_offset_seconds: 0, window_from_server_seconds: anchor - 14 * 86400,
  window_to_server_seconds: anchor + 60 * 86400 })
const nativeProps = (element) => element[Object.getOwnPropertyNames(element).find((key) => key.startsWith('__reactProps$'))]
const change = async (element, target) => {
  assert.ok(element)
  await act(async () => {
    const props = nativeProps(element)
    if (props) props.onChange({ target })
    else { // Happy DOM's select proxy exposes only option indices as own keys.
      element.value = target.value
      element.dispatchEvent(new dom.Event('change', { bubbles: true }))
    }
  })
}
const click = async (element) => { assert.ok(element); await act(async () => element.click()) }
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done }); return { promise, resolve } }
function mount(Component, props) {
  const container = document.createElement('div'); document.body.appendChild(container)
  const root = createRoot(container); roots.push(root)
  return { container, render: async (next = props) => act(async () => root.render(React.createElement(Component, next))) }
}

try {
  const data = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { useInspector } = await server.ssrLoadModule('./src/inspector/useInspector.ts')
  const { InspectorPanel } = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  const { InspectorChartMarkers } = await server.ssrLoadModule('./src/inspector/InspectorChartMarkers.tsx')
  const { useMt5EconomicCalendar } = await server.ssrLoadModule('./src/economic-calendar/mt5-calendar/use-mt5-economic-calendar.ts')
  const { ActivityLogContext } = await server.ssrLoadModule('./src/system-observability/activity-log/activity-log-context.ts')
  const { calendarDisplayRange } = await server.ssrLoadModule('./src/economic-calendar/calendar-dock/calendar-display-range.ts')
  const { useBottomDockSize, inspectorDockHeightKey } = await server.ssrLoadModule('./src/workspace-docking/bottom-dock/useBottomDockSize.ts')
  const { BottomDockPanel } = await server.ssrLoadModule('./src/workspace-docking/bottom-dock/BottomDockPanel.tsx')
  const preferences = data.defaultInspectorPreferences()
  assert.equal(data.inspectorFamilies.length, 21)
  assert.equal(data.inspectorCategories.length, 4)
  const categoryIds = data.inspectorCategories.flatMap((category) => category.families)
  assert.equal(new Set(categoryIds).size, 21, 'Every family belongs to exactly one category')
  assert.deepEqual([...categoryIds].sort(), data.inspectorFamilies.map((family) => family.id).sort())
  const originalFamilies = ['ecb', 'ecb-president', 'fomc', 'fed-chair', 'euro-inflation', 'german-inflation', 'us-cpi', 'pce', 'ppi']
  localStorage.setItem(data.inspectorStorageKey, JSON.stringify({ families: originalFamilies, showSymbols: false, symbols: { 'us-cpi': 'moon' } }))
  const upgraded = data.readInspectorPreferences()
  assert.equal(upgraded.families.length, 21, 'The old all-enabled default expands once')
  assert.equal(upgraded.showSymbols, false)
  assert.equal(upgraded.symbols['us-cpi'], 'moon')
  localStorage.setItem(data.inspectorStorageKey, JSON.stringify({ ...upgraded, families: originalFamilies }))
  assert.equal(data.readInspectorPreferences().families.length, 9, 'An explicit current selection is not re-expanded on reload')
  localStorage.setItem(data.inspectorStorageKey, JSON.stringify({ families: ['us-cpi'], symbols: { jobs: 'moon' } }))
  assert.deepEqual(data.readInspectorPreferences().families, ['us-cpi'], 'Legacy custom selections stay exact')
  assert.equal(data.readInspectorPreferences().symbols.jobs, 'moon')
  localStorage.removeItem(data.inspectorStorageKey)
  assert.equal(data.supportsInspector('EURUSD.a'), true)
  assert.equal(data.supportsInspector('GBPUSD'), false)
  assert.equal(data.inspectorDelta(event()), .2, 'Decimal delta is exact and uses Previous, not revised Previous or Forecast')
  assert.equal(data.inspectorDelta(event({ actual: null })), null)
  assert.equal(data.inspectorDelta(event({ actual: 0, previous: 0 })), 0)
  assert.equal(data.formatInspectorValue(.2, event(), true), '+0.2 pp')
  assert.equal(data.formatInspectorValue(-.25, event({ event_id: '840050014' }), true), '-25 bp')
  const core = event({ value_id: 'b', event_id: '840030006', name: 'Core CPI m/m' })
  const wrongCountry = event({ value_id: 'wrong-country', country_code: 'EU' })
  const unmapped = event({ value_id: 'unmapped', event_id: '840999999' })
  const nextPublication = event({ value_id: 'next', release_at: (anchor + 86400) * 1000, server_time_seconds: anchor + 86400 })
  const nextPeriod = event({ value_id: 'other-period', period_seconds: Date.UTC(2026, 7, 1) / 1000 })
  const groups = data.groupInspectorReleases([event(), core, wrongCountry, unmapped, event(), nextPublication, nextPeriod])
  assert.equal(groups.length, 2)
  assert.equal(groups[0].events.length, 3, 'Periods retained as separate source rows; duplicate value IDs excluded')
  const statement = event({ value_id: 'statement', event_id: '840050002', name: 'FOMC Statement', actual: null, previous: null, revised_previous: null, period_seconds: 0, unit: 0 })
  const decision = event({ value_id: 'decision', event_id: '840050014', name: 'Fed Interest Rate Decision' })
  assert.equal(data.groupInspectorReleases([statement, decision]).length, 2, 'Same-time policy text stays separate from rate decisions')
  const pceReadings = [
    event({ value_id: 'pce-cm', event_id: '840010001', name: 'Core PCE Price Index m/m' }),
    event({ value_id: 'pce-cy', event_id: '840010002', name: 'Core PCE Price Index y/y' }),
    event({ value_id: 'pce-hm', event_id: '840010003', name: 'PCE Price Index m/m' }),
    event({ value_id: 'pce-hy', event_id: '840010004', name: 'PCE Price Index y/y' }),
  ]
  assert.deepEqual(data.groupInspectorReleases(pceReadings)[0].events.map((row) => row.event_id),
    ['840010003', '840010001', '840010004', '840010002'], 'PCE pairs monthly readings before annual readings')
  assert.deepEqual(pceReadings.map((row) => row.value_id), ['pce-cm', 'pce-cy', 'pce-hm', 'pce-hy'], 'Source input order is unchanged')
  const nextWeek = calendarDisplayRange('next-week', '2026-10-03', '', '', utc)
  assert.equal(data.filterInspectorReleases(groups, preferences, nextWeek).length, 0)
  assert.equal(data.buildInspectorMarkers(groups, preferences, bars, 'H1').length, 1, 'Future/out-of-candle publications never snap backward')
  assert.equal(data.buildInspectorMarkers(data.groupInspectorReleases([event({ time_mode: 1 })]), preferences, bars, 'H1').length, 0)
  assert.equal(data.buildInspectorMarkers(data.groupInspectorReleases([event({ chart_time_seconds: null })]), preferences, bars, 'H1').length, 0,
    'Known UTC without a broker clock profile cannot masquerade as native candle time')
  assert.equal(data.buildInspectorMarkers(groups, { ...preferences, showSymbols: false }, bars, 'H1').length, 0)
  assert.equal(data.buildInspectorMarkers(groups, preferences, [bars[0]], 'H1').length, 0, 'Gaps are not filled with nearest bars')
  const h4 = [bars[1]]
  const inH4 = data.groupInspectorReleases([event({ release_at: (anchor + 7200) * 1000, server_time_seconds: anchor + 7200 })])
  assert.equal(data.buildInspectorMarkers(inH4, preferences, h4, 'H4').length, 1)
  console.log('✓ Inspector family identity, delta arithmetic, grouping, range and containing-candle checks')

  const newFamilyIds = categoryIds.filter((id) => !originalFamilies.includes(id))
  const newFamilies = data.inspectorFamilies.filter((family) => newFamilyIds.includes(family.id))
  const allExpandedRows = newFamilies.flatMap((family) => family.events.map((event_id) => event({
    value_id: `new-${event_id}`, event_id, country_code: family.country, currency: family.currency, name: event_id,
  })))
  const expandedGroups = data.groupInspectorReleases(allExpandedRows)
  assert.equal(expandedGroups.reduce((count, group) => count + group.events.length, 0), allExpandedRows.length)
  assert.equal(new Set(expandedGroups.map((group) => group.familyId)).size, 12)
  const euroLabor = expandedGroups.filter((group) => group.familyId === 'euro-labor')
  assert.equal(euroLabor.length, 2, 'Euro-area unemployment stays separate from employment at the same time')
  assert.equal(euroLabor.find((group) => group.label === 'Euro-area unemployment').events.length, 1)
  assert.equal(data.groupInspectorReleases([event({ event_id: '276500001', country_code: 'EU', currency: 'EUR' })]).length, 0,
    'German PMI cannot leak into euro-area PMI by ID alone')
  assert.equal(data.groupInspectorReleases([event({ event_id: '840010009' }), event({ event_id: '840010001', value_id: 'monthly-pce' })]).length, 2,
    'Quarterly PCE in GDP stays separate from monthly PCE')
  const payroll = event({ value_id: 'payroll', event_id: '840030016', name: 'Nonfarm Payrolls', unit: 4, multiplier: 1, digits: 0, actual: 150, previous: 100 })
  const unemployment = event({ value_id: 'unemployment', event_id: '840030015', name: 'Unemployment Rate', actual: 4.2, previous: 4.1 })
  const hours = event({ value_id: 'hours', event_id: '840030020', name: 'Average Weekly Hours', unit: 3, actual: 34.2, previous: 34.3 })
  const pmi = event({ value_id: 'pmi', event_id: '840040001', name: 'ISM Manufacturing PMI', unit: 0, actual: 49.3, previous: 48.7 })
  const missingPmi = { ...pmi, actual: null, previous: null, revised_previous: null }
  assert.equal(data.isInspectorCommentary(missingPmi), false)
  assert.equal(data.isInspectorCommentary(statement), true)
  assert.equal(data.formatInspectorValue(data.inspectorDelta(payroll), payroll, true), '+50k')
  assert.equal(data.formatInspectorValue(data.inspectorDelta(unemployment), unemployment, true), '+0.1 pp')
  assert.equal(data.formatInspectorValue(data.inspectorDelta(hours), hours, true), '-0.1 h')
  assert.equal(data.formatInspectorValue(data.inspectorDelta(pmi), pmi, true), '+0.6 pts')
  console.log('✓ Expanded family mappings, preference migration, release separation and mixed-unit deltas')

  let view
  const events = [event(), core, statement, event({ value_id: 'tentative', event_id: '840030001', name: 'PPI m/m', time_mode: 1 })]
  function App({ symbol = 'EURUSD', events: readings = events, panel = true }) {
    const inspector = useInspector({ events: readings, symbol, bars, timeframe: 'H1', timeDisplay: utc, clockOffsetMs: fixtureClockOffset })
    React.useEffect(() => { view = inspector }, [inspector])
    return panel ? React.createElement(InspectorPanel, { view: inspector, symbol, source: source(), error: null, timeDisplay: utc }) : null
  }
  const app = mount(App, {})
  await app.render()
  await click([...app.container.querySelectorAll('.inspector-release')].find((button) => button.textContent.includes('US CPI')))
  assert.deepEqual([...app.container.querySelectorAll('th')].map((el) => el.textContent), ['Series', 'Actual', 'Previous', 'A−P'])
  assert.match(app.container.querySelector('tbody').textContent, /\+0.2 pp/)
  assert.match(app.container.querySelector('tbody').textContent, /Rev: 0.2%/)
  assert.doesNotMatch(app.container.querySelector('table').textContent, /Sum|Direction|Long|Short|Gross/)
  assert.equal(app.container.querySelectorAll('.inspector-shared-period').length, 1)
  assert.doesNotMatch(app.container.querySelector('tbody').textContent, /Period:/, 'Shared period is shown once above the table')
  assert.ok(app.container.querySelector('[aria-label="About A−P"]').getAttribute('aria-describedby'))
  await click([...app.container.querySelectorAll('button')].find((button) => button.textContent === 'Hide releases'))
  assert.equal(app.container.querySelector('nav').hidden, true)
  assert.ok(app.container.querySelector('.inspector-body.releases-collapsed'))
  assert.equal(app.container.querySelectorAll('tbody tr').length, 2, 'Full-width table keeps the selected readings')
  await click([...app.container.querySelectorAll('button')].find((button) => button.textContent === 'Show releases'))
  assert.equal(app.container.querySelector('nav').hidden, false)
  await app.render({ events: [event(), core, nextPeriod] })
  assert.equal(app.container.querySelectorAll('.inspector-shared-period').length, 0)
  assert.equal([...app.container.querySelectorAll('tbody td:first-child')].filter((cell) => cell.textContent.includes('Period:')).length, 3,
    'Mixed periods remain visible on every row')
  await app.render({ events: pceReadings })
  await click(app.container.querySelector('.inspector-release'))
  assert.deepEqual([...app.container.querySelectorAll('tbody td:first-child strong')].map((cell) => cell.textContent),
    ['PCE Price Index m/m', 'Core PCE Price Index m/m', 'PCE Price Index y/y', 'Core PCE Price Index y/y'])
  await app.render()
  await click([...app.container.querySelectorAll('.inspector-release')].find((button) => button.textContent.includes('US CPI')))
  const filters = () => [...app.container.querySelectorAll('button')].find((button) => button.textContent === 'Filters')
  filters().focus()
  await click(filters())
  assert.ok(document.querySelector('dialog[open]'), 'Native centered modal opens')
  const toggle = document.querySelector('.inspector-symbol-toggle input')
  await change(toggle, { checked: false })
  await click([...document.querySelectorAll('dialog button')].find((button) => button.textContent === 'Cancel'))
  assert.equal(view.preferences.showSymbols, true, 'Cancel discards draft')
  assert.equal(document.activeElement, filters(), 'Focus restores to Filters')
  await click(filters())
  await change(document.querySelector('.inspector-symbol-toggle input'), { checked: false })
  await click([...document.querySelectorAll('dialog button')].find((button) => button.textContent === 'Apply'))
  assert.equal(view.markers.length, 0)
  assert.equal(JSON.parse(localStorage.getItem(data.inspectorStorageKey)).showSymbols, false)
  await act(async () => view.applyPreferences(preferences))
  await click(filters())
  await change(document.querySelector('[aria-label="USD Inflation"]'), { checked: false })
  await click([...document.querySelectorAll('dialog button')].find((button) => button.textContent === 'Apply'))
  assert.equal(view.selectedRelease, null, 'Hidden selection cannot leave an unrelated table on screen')
  assert.equal(view.releases.length, 1)
  await click(app.container.querySelector('.inspector-release'))
  assert.match(app.container.querySelector('tbody').textContent, /Not applicable/)
  await act(async () => view.applyPreferences(preferences))
  await change(app.container.querySelector('[aria-label="Inspector date range"]'), { value: 'next-week' })
  assert.equal(view.releases.length, 0)
  await change(app.container.querySelector('[aria-label="Inspector date range"]'), { value: 'custom' })
  await change(app.container.querySelector('[aria-label="Inspector range start"]'), { value: '2026-10-02' })
  await change(app.container.querySelector('[aria-label="Inspector range end"]'), { value: '2026-10-01' })
  assert.equal(view.range, null)
  assert.match(app.container.textContent, /Choose a valid date range/)
  await change(app.container.querySelector('[aria-label="Inspector range start"]'), { value: '2026-10-01' })
  assert.equal(view.releases.length, 3)
  const id = view.releases.find((release) => release.familyId === 'us-cpi').id
  await act(async () => view.selectRelease(id))
  await app.render({ panel: false })
  assert.ok(view.markers.length, 'Closing the panel keeps marker state active')
  await app.render({ events: [event({ actual: .5 }), core] })
  assert.equal(view.selectedRelease.events[0].actual, .5, 'Feed updates refresh the selected release by identity')
  await app.render({ symbol: 'GBPUSD' })
  assert.equal(view.releases.length, 0)
  assert.equal(view.markers.length, 0)
  assert.match(app.container.textContent, /currently supports EURUSD/)
  console.log('✓ Mounted Inspector selection, filter Apply/Cancel, persistence, ranges, live updates and pair isolation')

  const jobsRows = [unemployment, payroll, hours]
  await app.render({ events: [...jobsRows, pmi] })
  await click([...app.container.querySelectorAll('.inspector-release')].find((button) => button.textContent.includes('Jobs report')))
  assert.deepEqual([...app.container.querySelectorAll('tbody td:first-child strong')].map((cell) => cell.textContent),
    ['Nonfarm Payrolls', 'Unemployment Rate', 'Average Weekly Hours'])
  assert.match(app.container.querySelector('tbody').textContent, /\+50k/)
  assert.match(app.container.querySelector('tbody').textContent, /\+0.1 pp/)
  assert.match(app.container.querySelector('tbody').textContent, /-0.1 h/)
  await click(filters())
  for (const currency of ['EUR', 'USD']) for (const category of ['Monetary policy', 'Inflation', 'Labor / wages', 'Growth / activity']) {
    assert.ok(document.querySelector(`[aria-label="${currency} ${category}"]`))
  }
  await change(document.querySelector('[aria-label="USD Labor / wages"]'), { checked: false })
  await click([...document.querySelectorAll('dialog button')].find((button) => button.textContent === 'Cancel'))
  assert.ok(view.selectedRelease, 'Cancel preserves the selected jobs report')
  await click(filters())
  await change(document.querySelector('[aria-label="USD Labor / wages"]'), { checked: false })
  await click([...document.querySelectorAll('dialog button')].find((button) => button.textContent === 'Apply'))
  assert.equal(view.selectedRelease, null, 'Applying the labor filter clears its selected report')
  assert.deepEqual(view.releases.map((release) => release.familyId), ['ism-manufacturing'])
  assert.equal(data.readInspectorPreferences().families.includes('jobs'), false)
  await act(async () => view.applyPreferences(preferences))
  await app.render({ events: [missingPmi] })
  await click(app.container.querySelector('.inspector-release'))
  assert.doesNotMatch(app.container.querySelector('tbody').textContent, /Not applicable/)
  assert.match(app.container.textContent, /Awaiting actual/)
  await app.render({ events: [pmi] })
  assert.match(app.container.querySelector('tbody').textContent, /\+0.6 pts/)
  console.log('✓ Mounted four-category filters, jobs table units, missing PMI readings and incoming actuals')

  await app.render({ events: [event(), decision] })
  const subscriptions = new Set()
  let coordinate = 120
  const scale = { timeToCoordinate: () => coordinate, width: () => 500,
    subscribeVisibleLogicalRangeChange: (fn) => subscriptions.add(fn), subscribeSizeChange: (fn) => subscriptions.add(fn),
    unsubscribeVisibleLogicalRangeChange: (fn) => subscriptions.delete(fn), unsubscribeSizeChange: (fn) => subscriptions.delete(fn) }
  let picked = null
  const clusterMarkers = data.buildInspectorMarkers(data.groupInspectorReleases([event(), decision]), preferences, bars, 'H1')
  const chart = mount(InspectorChartMarkers, { chartApi: { timeScale: () => scale }, markers: clusterMarkers,
    timeDisplay: utc, onSelectRelease: (id) => { picked = id; view.selectRelease(id) } })
  await chart.render()
  await click(chart.container.querySelector('.inspector-chart-symbol'))
  const choices = chart.container.querySelectorAll('.inspector-marker-popup button')
  assert.equal(choices.length, 3)
  await click(choices[1])
  assert.equal(picked, clusterMarkers[0].release.id, 'Cluster choice selects the exact release')
  const selectedId = view.selectedRelease.id
  assert.match(app.container.querySelector('table').getAttribute('aria-label'), /Fed rate decision/)
  await click(chart.container.querySelector('.inspector-chart-symbol'))
  assert.ok(chart.container.querySelector('.inspector-marker-popup'))
  await act(async () => { coordinate = -60; for (const update of subscriptions) update() })
  assert.equal(chart.container.querySelector('.inspector-chart-symbol'), null)
  assert.equal(chart.container.querySelector('.inspector-marker-popup'), null)
  assert.equal(view.selectedRelease.id, selectedId, 'Panning out closes the chooser without clearing the selected table')
  await act(async () => { coordinate = 120; for (const update of subscriptions) update() })
  assert.ok(chart.container.querySelector('.inspector-chart-symbol'))
  assert.equal(chart.container.querySelector('.inspector-marker-popup'), null, 'Panning back does not reopen an old chooser')
  await click(chart.container.querySelector('.inspector-chart-symbol'))
  await act(async () => { coordinate = 600; for (const update of subscriptions) update() })
  await act(async () => { coordinate = 120; for (const update of subscriptions) update() })
  assert.equal(chart.container.querySelector('.inspector-marker-popup'), null, 'Right-edge exit also clears expansion')
  await click(chart.container.querySelector('.inspector-chart-symbol'))
  await act(async () => { coordinate = null; for (const update of subscriptions) update() })
  await act(async () => { coordinate = 120; for (const update of subscriptions) update() })
  assert.equal(chart.container.querySelector('.inspector-marker-popup'), null, 'Unavailable coordinates cannot retain expansion')
  console.log('✓ Mounted chart selection, off-screen collapse, closed re-entry and selected-table preservation')

  let dock
  function DockApp({ activeWindow = 'inspector' }) {
    const size = useBottomDockSize(activeWindow)
    React.useEffect(() => { dock = size }, [size])
    return React.createElement('div', { style: { height: size.height } }, React.createElement(BottomDockPanel, {
      activeWindow, activityCount: 0, selectedSymbol: 'EURUSD', hasResearchSelection: false,
      onSelectWindow: () => {}, onClose: () => {}, resizeHandle: size.resizeHandle,
    }, null))
  }
  dom.innerHeight = 1000
  const dockApp = mount(DockApp, {})
  await dockApp.render()
  assert.equal(dock.height, 380)
  const handle = dockApp.container.querySelector('[role="separator"]')
  assert.equal(handle.getAttribute('aria-label'), 'Resize Inspector dock')
  let captured = null
  handle.setPointerCapture = (id) => { captured = id }
  handle.hasPointerCapture = (id) => captured === id
  handle.releasePointerCapture = () => { captured = null }
  const pointer = async (handler, clientY) => act(async () => nativeProps(handle)[handler]({
    button: 0, pointerId: 7, clientY, currentTarget: handle, preventDefault: () => {},
  }))
  await pointer('onPointerDown', 600)
  await pointer('onPointerMove', 540)
  assert.equal(dock.height, 440)
  assert.equal(captured, 7, 'Drag captures the pointer across the chart boundary')
  await pointer('onPointerUp', 540)
  assert.equal(captured, null)
  assert.equal(localStorage.getItem(inspectorDockHeightKey), '440')
  await act(async () => handle.dispatchEvent(new dom.KeyboardEvent('keydown', { bubbles: true, key: 'ArrowUp' })))
  assert.equal(dock.height, 464)
  await act(async () => { dom.innerHeight = 500; dom.dispatchEvent(new dom.Event('resize')) })
  assert.equal(dock.height, 260, 'Small windows retain chart space by clamping the dock')
  assert.equal(localStorage.getItem(inspectorDockHeightKey), '464', 'Viewport clamping preserves the preferred height')
  await act(async () => { dom.innerHeight = 1000; dom.dispatchEvent(new dom.Event('resize')) })
  assert.equal(dock.height, 464)
  await dockApp.render({ activeWindow: 'notebook' })
  assert.equal(dock.height, 258, 'Existing docks keep their current height')
  assert.equal(dockApp.container.querySelector('[role="separator"]'), null)
  await dockApp.render()
  assert.equal(dock.height, 464)
  const reopenedDock = mount(DockApp, {})
  await reopenedDock.render()
  assert.equal(dock.height, 464, 'New mounts restore the saved Inspector height')
  console.log('✓ Mounted Inspector dock pointer/keyboard resizing, viewport limits and saved height')

  const requests = []
  globalThis.fetch = (_url, options) => { const req = { ...deferred(), signal: options.signal }; requests.push(req); return req.promise }
  let feed
  const activity = { appendActivity: () => {}, entries: [], clearActivity: () => {} }
  function Feed({ health = source(), enabled = true }) {
    const calendar = useMt5EconomicCalendar(true, health, enabled)
    React.useEffect(() => { feed = calendar }, [calendar])
    return null
  }
  function FeedApp(props) { return React.createElement(ActivityLogContext.Provider, { value: activity }, React.createElement(Feed, props)) }
  const calendar = mount(FeedApp, {})
  await calendar.render()
  await act(async () => requests[0].resolve({ ok: true, json: async () => ({ source: source(), events: [event()] }) }))
  assert.equal(feed.events.length, 1)
  await calendar.render({ health: source('B') })
  assert.equal(feed.events.length, 0, 'Old publisher readings disappear immediately on generation change')
  await calendar.render({ health: source('C') })
  assert.equal(requests[1].signal.aborted, true)
  await act(async () => requests[2].resolve({ ok: true, json: async () => ({ source: source('C'), events: [core] }) }))
  await act(async () => requests[1].resolve({ ok: true, json: async () => ({ source: source('B'), events: [event()] }) }))
  assert.equal(feed.events[0].value_id, 'b', 'Late canceled response cannot overwrite the current generation')
  await calendar.render({ health: source('C'), enabled: false })
  assert.equal(feed.events.length, 0)
  console.log('✓ Mounted calendar publisher generation and cancellation checks')
  const storageRequests = []
  globalThis.fetch = (url, options) => {
    const req = { ...deferred(), url, signal: options.signal }
    storageRequests.push(req); return req.promise
  }
  const respond = async (req, body, ok = true) => act(async () => req.resolve({ ok, status: ok ? 200 : 503, json: async () => body }))
  const stored = (row) => ({ ...row, release_at: (row.server_time_seconds - 10800) * 1000,
    chart_time_seconds: row.server_time_seconds, availability: 'observed' })
  const storedHealth = (id = 'Broker-A', revision = 1) => ({ revision, collector_error: null,
    sources: [{ id, publisher_status: 'live', server_now: anchor, instance_id: 'A' }] })
  const page = (rows, revision = 1, next_cursor = null, id = 'Broker-A') => ({ source_id: id,
    timestamp_convention: 'trade_server_time', time_basis: 'chart', revision, events: rows,
    coverage: { EUR: { missing: [] }, USD: { missing: [] } }, next_cursor })
  let storedView
  function StoredApp({ brokerId = 'Broker-A', liveEvents = [event(), core], chartBars = bars, symbol = 'EURUSD' }) {
    const inspector = useInspector({ events: liveEvents, symbol, bars: chartBars, timeframe: 'H1',
      timeDisplay: { mode: 'fixed-offset', utcOffsetMinutes: 420 }, clockOffsetMs: fixtureClockOffset,
      brokerId, brokerOffsetSeconds: 10800 })
    React.useEffect(() => { storedView = inspector }, [inspector])
    return React.createElement(InspectorPanel, { view: inspector, symbol, source: source(), error: null, timeDisplay: utc })
  }
  const storageApp = mount(StoredApp, {})
  await storageApp.render()
  await respond(storageRequests[0], storedHealth())
  const rawRow = stored(event({ actual: .008, previous: .001, digits: 2,
    actual_raw_scaled_1e6: '8000', previous_raw_scaled_1e6: '1000' }))
  await respond(storageRequests[1], page([rawRow], 1, { after_time: anchor, after_id: 'a' }))
  assert.equal(storedView.releases.length, 0, 'Pages publish only when a complete snapshot is ready')
  await respond(storageRequests[2], page([stored(core)]))
  assert.equal(storedView.releases.length, 1)
  assert.equal(storedView.releases[0].events.length, 2)
  assert.equal(storedView.releases[0].events[0].actual, .008, 'Stored values and timing are authoritative')
  assert.equal(data.inspectorDelta(storedView.releases[0].events[0]), .007, 'Raw integers retain precision beyond metadata digits')
  assert.ok(storageApp.container.textContent.includes('Broker time'))
  assert.equal(storedView.markers.length, 1)
  await storageApp.render({ liveEvents: [] })
  assert.equal(storedView.markers.length, 1, 'Publisher restarts and empty live windows cannot remove stored symbols')
  await act(async () => { storedView.setRangePreset('custom'); storedView.setCustomFrom('2015-01-01'); storedView.setCustomTo('2015-01-31') })
  assert.equal(storedView.releases.length, 0, 'Old-range data disappears before the next response')
  await respond(storageRequests[3], storedHealth())
  const historicRequest = storageRequests[4]
  const query = new URL('http://localhost' + historicRequest.url).searchParams
  assert.equal(Number(query.get('from_server_seconds')), Date.UTC(2015, 0, 1) / 1000, 'Dates query raw broker midnights')
  assert.equal(Number(query.get('to_server_seconds')), Date.UTC(2015, 1, 1) / 1000, 'End date is inclusive in UI and exclusive in API')
  assert.equal(query.get('time_basis'), 'chart', 'Range dates refer to the native broker candle clock')
  const historic = { ...stored(event({ server_time_seconds: Date.UTC(2015, 0, 15, 15, 30) / 1000 })),
    chart_time_seconds: Date.UTC(2015, 0, 15, 14, 30) / 1000 }
  await respond(historicRequest, page([historic, { ...historic, value_id: 'b', event_id: core.event_id }]))
  assert.equal(storedView.releases[0].events.length, 2, 'Archive readings group using established UTC identity')
  assert.equal(storedView.markers.length, 0)
  const historicBars = [14, 15].map((hour) => ({ ...bars[0], time: Date.UTC(2015, 0, 15, hour) / 1000 }))
  await storageApp.render({ liveEvents: [], chartBars: historicBars })
  assert.equal(storedView.markers.length, 1, 'History places symbols as soon as the containing candles load')
  assert.equal(storedView.markers[0].time, historicBars[0].time, 'Winter history uses native broker time, not UTC or export summer time')
  await click(storageApp.container.querySelector('.inspector-release'))
  assert.ok(storageApp.container.querySelector('table'))
  assert.ok(storageApp.container.textContent.includes('broker time'))
  assert.match(storageApp.container.querySelector('.inspector-detail-heading').textContent, /14:30/)
  const historicId = storedView.selectedRelease.id
  const winterRefresh = { ...historic, server_time_seconds: historic.server_time_seconds - 3600 }
  assert.equal(data.groupInspectorReleases([winterRefresh])[0].id, historicId,
    'Retrieval-offset changes preserve the selected release identity')
  const archiveChart = mount(InspectorChartMarkers, { chartApi: { timeScale: () => scale }, markers: storedView.markers,
    timeDisplay: { mode: 'fixed-offset', utcOffsetMinutes: 420 }, onSelectRelease: storedView.selectRelease })
  await archiveChart.render()
  assert.match(archiveChart.container.querySelector('.inspector-chart-symbol').title, /14:30.*broker time/,
    'Chart tooltip and table use the same native broker clock regardless of appearance offset')
  await act(async () => { storedView.setCustomFrom('2016-01-01'); storedView.setCustomTo('2016-01-31') })
  const obsolete = storageRequests[5]
  await storageApp.render({ brokerId: 'Broker-B' })
  assert.equal(obsolete.signal.aborted, true)
  await respond(storageRequests[6], storedHealth('Broker-B'))
  await respond(storageRequests[7], page([], 1, null, 'Broker-B'))
  await respond(obsolete, storedHealth())
  assert.equal(storedView.releases.length, 0, 'Canceled responses cannot cross broker identities')
  await storageApp.render({ brokerId: 'Broker-A' })
  await respond(storageRequests[8], storedHealth())
  await respond(storageRequests[9], page([historic], 1, { after_time: anchor, after_id: 'a' }))
  await respond(storageRequests[10], page([], 2))
  assert.equal(storedView.releases.length, 0, 'Mixed revisions cannot be published')
  await respond(storageRequests[11], page([], 2))
  assert.equal(storedView.storage.error, null)
  await storageApp.render({ symbol: 'GBPUSD' })
  assert.equal(storedView.releases.length, 0)
  assert.equal(storedView.storage.events.length, 0)
  console.log('✓ Mounted stored Inspector paging, broker clock, precise delta, cancellation and snapshot consistency')

  const { useStoredCalendar } = await server.ssrLoadModule('./src/inspector/useStoredCalendar.ts')
  const originalTimeout = window.setTimeout
  let pollCallback
  let polled
  window.setTimeout = (callback) => { pollCallback = callback; return 0 }
  function PollApp({ enabled = true }) {
    const state = useStoredCalendar('Broker-A', { from: anchor * 1000, to: (anchor + 86400) * 1000 }, enabled)
    React.useEffect(() => { polled = state }, [state])
    return null
  }
  const pollingApp = mount(PollApp, {})
  try {
    let start = storageRequests.length
    await pollingApp.render()
    await respond(storageRequests[start], storedHealth())
    await respond(storageRequests[start + 1], page([rawRow]))
    assert.equal(polled.events.length, 1)
    start = storageRequests.length
    await act(async () => { void pollCallback() })
    await respond(storageRequests[start], storedHealth())
    assert.equal(storageRequests.length, start + 1, 'Unchanged data does not refetch the release range')
    start = storageRequests.length
    await act(async () => { void pollCallback() })
    await respond(storageRequests[start], {}, false)
    assert.equal(polled.events.length, 1, 'An outage preserves the completed snapshot for this range')
    assert.ok(polled.error.includes('503'))
    start = storageRequests.length
    await act(async () => { void pollCallback() })
    await respond(storageRequests[start], storedHealth())
    assert.equal(polled.error, null, 'A healthy poll clears a temporary outage')
    start = storageRequests.length
    await act(async () => { void pollCallback() })
    const expired = storedHealth()
    expired.sources[0].coverage = { USD: { covered: [], missing: [[anchor, anchor + 86400]] } }
    await respond(storageRequests[start], expired)
    await respond(storageRequests[start + 1], { ...page([rawRow]), coverage: { USD: { missing: [[anchor, anchor + 86400]] } } })
    assert.equal(polled.coverage.USD.missing.length, 1, 'Coverage expiration refreshes even without a data revision')
    await pollingApp.render({ enabled: false })
    assert.equal(polled.events.length, 0)
    console.log('✓ Mounted storage polling skips unchanged data, preserves readings through outages and refreshes expired coverage')
  } finally { window.setTimeout = originalTimeout }
} finally {
  await act(async () => { for (const root of roots) root.unmount() })
  await server.close()
  await dom.happyDOM.close()
  for (const [key, descriptor] of Object.entries(previous)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
}
