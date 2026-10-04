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
  const grading = await server.ssrLoadModule('./src/inspector/grading/nfp-grading.ts')
  const dates = await server.ssrLoadModule('./src/inspector/inspector-date-range.ts')
  const { calendarDisplayRange } = await server.ssrLoadModule('./src/inspector/calendar-display-range.ts')
  const { useBottomDockSize, inspectorDockHeightKey, bottomDockHeightKeys } = await server.ssrLoadModule('./src/workspace-docking/bottom-dock/useBottomDockSize.ts')
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
  const openDates = async () => click(app.container.querySelector('[aria-label="Inspector date range"]'))
  const presetButton = (name) => [...document.querySelectorAll('[aria-label="Date range presets"] button')].find((button) => button.textContent === name)
  await openDates()
  assert.equal(document.querySelectorAll('[aria-label="Inspector date range picker"] table').length, 2)
  assert.equal([...document.querySelectorAll('[aria-label="Inspector date range picker"] button')].some((button) => ['Apply', 'Cancel'].includes(button.textContent)), false)
  await click(presetButton('Next week'))
  assert.equal(view.releases.length, 0)
  assert.equal(document.querySelector('[aria-label="Inspector date range picker"]'), null)
  await openDates()
  const lastValid = view.range
  await change(document.querySelector('[aria-label="Inspector range start"]'), { value: '2026-10-02' })
  const beforeInvalid = view.range
  await change(document.querySelector('[aria-label="Inspector range end"]'), { value: '2026-10-01' })
  assert.deepEqual(view.range, beforeInvalid, 'Invalid edit keeps the last applied range')
  assert.ok(lastValid)
  assert.match(document.querySelector('[aria-label="Inspector date range picker"]').textContent, /End must be on or after Start/)
  await change(document.querySelector('[aria-label="Inspector range start"]'), { value: '2026-10-01' })
  assert.equal(view.releases.length, 3)
  await click(document.querySelector('[aria-label="Close date range picker"]'))
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

  await app.render()
  await openDates()
  await change(document.querySelector('[aria-label="Calendar month"]'), { value: '1' })
  await change(document.querySelector('[aria-label="Calendar year"]'), { value: '2015' })
  const appliedBeforeFirstDay = view.range
  await click(document.querySelector('[aria-label="Choose 2015-01-28"]'))
  assert.deepEqual(view.range, appliedBeforeFirstDay, 'A start-date click waits for a complete range')
  await click(document.querySelector('[aria-label="Choose 2015-01-09"]'))
  assert.equal(view.customFrom, '2015-01-09', 'Reverse calendar selection orders the dates')
  assert.equal(view.customTo, '2015-01-28')
  assert.equal(view.range.to, Date.UTC(2015, 0, 29), 'The displayed end date is included')
  assert.equal(document.querySelector('[aria-label="Inspector date range picker"]'), null)
  await openDates()
  await click(presetButton('Today'))
  assert.equal(view.range.to - view.range.from, 86400000)
  await openDates()
  await act(async () => document.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.equal(document.querySelector('[aria-label="Inspector date range picker"]'), null)
  assert.equal(document.activeElement, app.container.querySelector('[aria-label="Inspector date range"]'))
  await openDates()
  await act(async () => document.body.dispatchEvent(new dom.Event('pointerdown', { bubbles: true })))
  assert.equal(document.querySelector('[aria-label="Inspector date range picker"]'), null)
  assert.equal(dates.validInspectorDate('2026-02-30'), false)
  assert.equal(dates.validInspectorDate('2024-02-29'), true)
  assert.deepEqual(dates.inspectorRangeDates('this-month', '2024-02-15', '', ''), { from: '2024-02-01', to: '2024-02-29' })
  assert.deepEqual(dates.inspectorRangeDates('year-to-date', '2026-10-04', '', ''), { from: '2026-01-01', to: '2026-10-04' })
  await act(async () => { view.setRangePreset('custom'); view.setCustomFrom('2026-10-01'); view.setCustomTo('2026-10-01') })
  await openDates()
  await act(async () => document.querySelector('[aria-label="Choose 2026-10-01"]').dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
  assert.equal(document.activeElement.getAttribute('data-day'), '2026-10-02')
  await act(async () => document.activeElement.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'PageDown', bubbles: true })))
  assert.equal(document.activeElement.getAttribute('data-day'), '2026-11-01')
  await click(document.querySelector('[aria-label="Close date range picker"]'))
  console.log('✓ Mounted immediate date presets/ranges, reverse selection, year navigation, invalid edits and dismissal')

  const originalRect = HTMLElement.prototype.getBoundingClientRect
  const originalObserver = window.ResizeObserver
  const originalViewport = { width: window.innerWidth, height: window.innerHeight }
  const rectangle = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height })
  let dockRect = rectangle(300, 612, 1100, 288), buttonRect = rectangle(390, 620, 220, 28)
  let popupRect = rectangle(0, 0, 660, 360)
  const positionObservers = []
  window.ResizeObserver = class {
    constructor(callback) { this.callback = callback; this.nodes = []; this.disconnected = false; positionObservers.push(this) }
    observe(node) { this.nodes.push(node) }
    disconnect() { this.disconnected = true }
  }
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.matches('.inspector-panel')) return dockRect
    if (this.matches('[aria-label="Inspector date range"]')) return buttonRect
    if (this.matches('.inspector-date-popover')) return popupRect
    return originalRect.call(this)
  }
  try {
    window.innerWidth = 1400; window.innerHeight = 900
    await openDates()
    const positioned = () => document.querySelector('[aria-label="Inspector date range picker"]')
    assert.equal(positioned().style.left, '520px', 'Date picker centers over Inspector rather than the left-side date button')
    assert.equal(positioned().style.top, '248px', 'A bottom dock opens its picker above the header with a clear gap')
    const positionObserver = positionObservers.at(-1)
    assert.ok(positionObserver.nodes.includes(app.container.querySelector('.inspector-panel')))
    dockRect = rectangle(200, 292, 800, 608); buttonRect = rectangle(290, 300, 220, 28)
    await act(async () => positionObserver.callback())
    assert.equal(positioned().style.left, '270px', 'Dock size changes recenter an open picker without a window resize')
    assert.equal(positioned().style.top, '340px', 'Picker opens below when there is insufficient space above')
    window.innerWidth = 500; window.innerHeight = 300; popupRect = rectangle(0, 0, 468, 268)
    buttonRect = rectangle(60, 100, 220, 28)
    await act(async () => window.dispatchEvent(new dom.Event('resize')))
    assert.equal(positioned().style.left, '16px')
    assert.equal(positioned().style.top, '16px', 'A short viewport centers the capped, scrollable picker inside safe margins')
    await click(document.querySelector('[aria-label="Close date range picker"]'))
    assert.equal(positionObserver.disconnected, true, 'Closing the picker releases its geometry observer')
  } finally {
    HTMLElement.prototype.getBoundingClientRect = originalRect
    window.ResizeObserver = originalObserver
    window.innerWidth = originalViewport.width; window.innerHeight = originalViewport.height
  }
  console.log('✓ Mounted date picker dock centering, above/below placement, viewport limits and resize cleanup')

  await click(filters())
  const savedBeforeSearch = [...view.preferences.families]
  await change(document.querySelector('[aria-label="Search Inspector families"]'), { value: ' USD NFP ' })
  assert.equal(document.querySelectorAll('.inspector-family').length, 1)
  assert.ok(document.querySelector('[aria-label="US Jobs report / NFP"]'))
  await change(document.querySelector('[aria-label="US Jobs report / NFP"]'), { checked: false })
  await click(document.querySelector('[aria-label="Clear family search"]'))
  assert.equal(document.querySelectorAll('.inspector-family').length, 21)
  assert.equal(document.querySelector('[aria-label="US Jobs report / NFP"]').checked, false)
  await change(document.querySelector('[aria-label="Search Inspector families"]'), { value: 'no-matching-family' })
  assert.match(document.querySelector('dialog').textContent, /No families match/)
  await click([...document.querySelectorAll('dialog button')].find((button) => button.textContent === 'Apply'))
  assert.deepEqual(view.preferences.families, savedBeforeSearch.filter((id) => id !== 'jobs'), 'Search cannot discard hidden selections')
  await act(async () => view.applyPreferences(preferences))
  console.log('✓ Mounted family search, clearing, empty results and hidden-selection preservation')

  const jobsRows = [unemployment, payroll, hours]
  await app.render({ events: [...jobsRows, pmi] })
  await click([...app.container.querySelectorAll('.inspector-release')].find((button) => button.textContent.includes('Jobs report')))
  assert.deepEqual([...app.container.querySelectorAll('tbody td:first-child strong')].map((cell) => cell.textContent),
    ['Nonfarm Payrolls', 'Unemployment Rate', 'Average Weekly Hours'])
  assert.match(app.container.querySelector('tbody').textContent, /\+50k/)
  assert.match(app.container.querySelector('tbody').textContent, /\+0.1 pp/)
  assert.match(app.container.querySelector('tbody').textContent, /-0.1 h/)
  assert.match(app.container.querySelector('[aria-label="NFP reading tally"]').textContent, /1 Good.*2 Bad.*0 Unchanged.*3 readings/)
  assert.equal(app.container.querySelector('[aria-label="NFP majority direction"]').textContent, 'Incomplete')
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

  const snapshotValues = {
    '840030016': [29, 162], '840030015': [4.2, 4.1], '840030017': [61.8, 61.6],
    '840030018': [.1, .3], '840030019': [3, 3.1], '840030020': [34.4, 34.4],
    '840030023': [46, 127], '840030022': [-17, 35], '840030032': [9, 16], '840030024': [7.6, 7.7],
  }
  const gradedRows = Object.entries(grading.nfpReadingRules).map(([event_id, rule]) => event({
    value_id: event_id, event_id, name: rule.name, actual: snapshotValues[event_id][0], previous: snapshotValues[event_id][1],
    revised_previous: event_id === '840030016' ? 133 : null,
  }))
  await app.render({ events: gradedRows })
  await click(app.container.querySelector('.inspector-release'))
  assert.match(app.container.querySelector('[aria-label="NFP reading tally"]').textContent, /2 Good.*7 Bad.*1 Unchanged.*10 readings/)
  const majorityLabel = () => app.container.querySelector('[aria-label="NFP majority direction"]').textContent
  assert.equal(majorityLabel(), 'EURUSD Long')
  assert.match(app.container.querySelector('[aria-label="NFP reading tally"]').textContent, /NFP majority rule · Experimental/)
  assert.equal(app.container.querySelectorAll('td.inspector-grade-good').length, 2)
  assert.equal(app.container.querySelectorAll('td.inspector-grade-bad').length, 7)
  assert.equal(app.container.querySelectorAll('td.inspector-grade-unchanged').length, 1)
  assert.match(app.container.querySelector('td.inspector-grade-good').title, /Compared with supplied Previous/)
  assert.equal(grading.gradeNfpReading(gradedRows[0], 'us-cpi'), null)
  assert.equal(grading.gradeNfpReading({ ...gradedRows[0], country_code: 'EU' }, 'jobs'), null)
  assert.equal(grading.gradeNfpReading({ ...gradedRows[0], currency: 'EUR' }, 'jobs'), null)
  for (const [event_id, rule] of Object.entries(grading.nfpReadingRules)) {
    const row = event({ event_id, actual: 2, previous: 1 })
    assert.equal(grading.gradeNfpReading(row, 'jobs').grade, rule.goodWhen === 'higher' ? 'good' : 'bad')
    assert.equal(grading.gradeNfpReading({ ...row, actual: 0, previous: 0 }, 'jobs').grade, 'unchanged')
    assert.equal(grading.gradeNfpReading({ ...row, actual: null }, 'jobs').grade, 'missing')
  }
  const heldGradeId = view.selectedRelease.id
  await app.render({ events: gradedRows.map((row) => row.event_id === '840030016' ? { ...row, actual: 200 } : row) })
  assert.equal(view.selectedRelease.id, heldGradeId)
  assert.match(app.container.querySelector('[aria-label="NFP reading tally"]').textContent, /3 Good.*6 Bad/)
  await app.render({ events: gradedRows.map((row) => row.event_id === '840030016' ? { ...row, actual: null } : row) })
  assert.match(app.container.querySelector('[aria-label="NFP reading tally"]').textContent, /2 Good.*6 Bad.*1 Unchanged.*1 Missing.*10 readings/)
  assert.equal(majorityLabel(), 'Incomplete', 'A missing value suppresses direction despite a remaining majority')
  const majorityRows = (grades) => gradedRows.map((row, index) => {
    const sign = grading.nfpReadingRules[row.event_id].goodWhen === 'higher' ? 1 : -1
    return { ...row, previous: 1, actual: grades[index] === 'unchanged' ? 1 :
      grades[index] === 'good' ? 1 + sign : 1 - sign }
  })
  await app.render({ events: majorityRows(['good', 'good', 'good', 'good', 'bad', 'bad', 'bad', 'unchanged', 'unchanged', 'unchanged']) })
  assert.equal(majorityLabel(), 'EURUSD Short', '4 Good, 3 Bad and 3 Unchanged gives Short')
  await app.render({ events: majorityRows(['good', 'good', 'good', 'good', 'good', 'bad', 'bad', 'bad', 'bad', 'unchanged']) })
  assert.equal(view.selectedRelease.id, heldGradeId, 'Direction refreshes without changing selection')
  assert.equal(majorityLabel(), 'EURUSD Short', '5 Good, 4 Bad and 1 Unchanged also gives Short')
  await app.render({ events: majorityRows(['good', 'good', 'good', 'good', 'bad', 'bad', 'bad', 'bad', 'unchanged', 'unchanged']) })
  assert.equal(majorityLabel(), 'EURUSD Neutral')
  await app.render({ events: majorityRows(Array(10).fill('unchanged')) })
  assert.equal(majorityLabel(), 'EURUSD Neutral', 'All zero deltas give Neutral')
  await app.render({ events: gradedRows.slice(1) })
  assert.equal(majorityLabel(), 'Incomplete', 'An absent series differs from a provided row with missing values')
  const duplicateSeries = [...gradedRows.slice(1), { ...gradedRows[1], value_id: 'extra-unemployment' }]
  await app.render({ events: duplicateSeries })
  assert.equal(majorityLabel(), 'Incomplete', 'Ten rows do not certify completeness if a series repeats')
  assert.equal(grading.assessNfpMajority({ ...view.selectedRelease, events: [...gradedRows.slice(1), event({ event_id: 'unknown' })] }).direction, 'incomplete')
  assert.equal(grading.assessNfpMajority({ ...view.selectedRelease, familyId: 'us-cpi' }), null)
  assert.equal(grading.assessNfpMajority(null), null)
  await app.render({ events: [core] })
  await click(app.container.querySelector('.inspector-release'))
  assert.equal(app.container.querySelector('[aria-label="NFP reading tally"]'), null)
  assert.equal(app.container.querySelector('.inspector-row-grade'), null)
  assert.equal(app.container.querySelector('[aria-label="NFP majority direction"]'), null)
  console.log('✓ Mounted NFP ten-reading grading, inverse rules, zero/missing states, live updates and family isolation')
  console.log('✓ Mounted experimental NFP majority Short/Long/Neutral, complete-series gate and incoming changes')

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
      activeWindow, activityCount: 0, selectedSymbol: 'EURUSD',
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
  for (const [activeWindow, label, distance, savedHeight] of [
    ['notebook', 'Notebook', 60, 342], ['activity', 'Activity', 90, 372],
  ]) {
    await dockApp.render({ activeWindow })
    assert.equal(dock.height, 258, 'Each additional dock keeps its initial height until resized')
    assert.equal(handle.getAttribute('aria-label'), `Resize ${label} dock`)
    await pointer('onPointerDown', 600)
    await pointer('onPointerMove', 600 - distance)
    await pointer('onPointerUp', 600 - distance)
    assert.equal(dock.height, 258 + distance)
    assert.equal(captured, null)
    await act(async () => handle.dispatchEvent(new dom.KeyboardEvent('keydown', { bubbles: true, key: 'ArrowUp' })))
    assert.equal(dock.height, savedHeight)
    assert.equal(localStorage.getItem(bottomDockHeightKeys[activeWindow]), String(savedHeight))
    await act(async () => { dom.innerHeight = 500; dom.dispatchEvent(new dom.Event('resize')) })
    assert.equal(dock.height, 260, 'Every dock retains chart space on small viewports')
    assert.equal(localStorage.getItem(bottomDockHeightKeys[activeWindow]), String(savedHeight))
    await act(async () => { dom.innerHeight = 1000; dom.dispatchEvent(new dom.Event('resize')) })
    assert.equal(dock.height, savedHeight)
  }
  await dockApp.render({ activeWindow: 'notebook' })
  assert.equal(dock.height, 342)
  await pointer('onPointerDown', 600)
  await pointer('onPointerMove', 580)
  assert.equal(captured, 7)
  await dockApp.render({ activeWindow: 'activity' })
  assert.equal(captured, null, 'Switching docks releases an unfinished drag')
  assert.equal(handle.getAttribute('data-resizing'), 'false')
  await pointer('onPointerMove', 400)
  await pointer('onPointerUp', 400)
  assert.equal(dock.height, 372, 'The previous dock drag cannot resize the newly selected dock')
  await dockApp.render({ activeWindow: null })
  assert.equal(dockApp.container.querySelector('[role="separator"]'), null)
  await dockApp.render()
  assert.equal(dock.height, 464)
  const reopenedDock = mount(DockApp, {})
  await reopenedDock.render()
  assert.equal(dock.height, 464, 'New mounts restore the saved Inspector height')
  await reopenedDock.render({ activeWindow: 'notebook' })
  assert.equal(dock.height, 342, 'Notebook restores its own committed height on remount')
  await reopenedDock.render({ activeWindow: 'activity' })
  assert.equal(dock.height, 372, 'Activity restores its own committed height on remount')
  const reopenedHandle = reopenedDock.container.querySelector('[role="separator"]')
  await act(async () => reopenedHandle.dispatchEvent(new dom.KeyboardEvent('keydown', { bubbles: true, key: 'Home' })))
  assert.equal(dock.height, 240)
  await act(async () => reopenedHandle.dispatchEvent(new dom.KeyboardEvent('keydown', { bubbles: true, key: 'End' })))
  assert.equal(dock.height, 650)
  assert.equal(localStorage.getItem(inspectorDockHeightKey), '464', 'Other dock resizes preserve Inspector preferences')
  console.log('✓ Mounted all-dock resizing, independent persistence, keyboard/viewport limits and drag-switch cleanup')

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
  function StoredApp({ brokerId = 'Broker-A', liveEvents = [event(), core], chartBars = bars, symbol = 'EURUSD',
    timeDisplay = { mode: 'fixed-offset', utcOffsetMinutes: 420 } }) {
    const inspector = useInspector({ events: liveEvents, symbol, bars: chartBars, timeframe: 'H1',
      timeDisplay, clockOffsetMs: fixtureClockOffset,
      brokerId, brokerOffsetSeconds: 10800 })
    React.useEffect(() => { storedView = inspector }, [inspector])
    return React.createElement(InspectorPanel, { view: inspector, symbol, source: source(), error: null, timeDisplay })
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
  const clockText = (clock) => storageApp.container.querySelector(`[data-clock="${clock}"]`).textContent
  assert.match(clockText('broker'), /broker time.*14:30/)
  assert.match(clockText('display'), /Display.*UTC\+07:00.*19:30/,
    'Display clock converts established UTC, not the raw export or projected broker timestamp')
  const requestsBeforeClockChange = storageRequests.length
  await storageApp.render({ chartBars: historicBars, timeDisplay: utc })
  assert.match(clockText('display'), /Display.*UTC.*12:30/)
  await storageApp.render({ chartBars: historicBars, timeDisplay: { mode: 'fixed-offset', utcOffsetMinutes: -300 } })
  assert.match(clockText('display'), /Display.*UTC-05:00.*07:30/)
  await storageApp.render({ chartBars: historicBars, timeDisplay: { mode: 'local', utcOffsetMinutes: 0 } })
  const { formatAppTimestamp, timeDisplayLabel } = await server.ssrLoadModule('./src/appearance/time-display/time-display-preference.ts')
  assert.equal(clockText('display'), `Display · ${timeDisplayLabel({ mode: 'local', utcOffsetMinutes: 0 })} · ${formatAppTimestamp(historic.release_at, { mode: 'local', utcOffsetMinutes: 0 })}`)
  assert.match(clockText('broker'), /broker time.*14:30/)
  assert.equal(storedView.selectedRelease.id, historicId)
  assert.equal(storedView.markers[0].time, historicBars[0].time)
  assert.equal(storageRequests.length, requestsBeforeClockChange, 'Display settings do not refetch a broker-clock range')
  const clockPanel = mount(InspectorPanel, { view: { ...storedView,
    selectedRelease: { ...storedView.selectedRelease, releaseAt: null, chartTime: null } }, symbol: 'EURUSD',
    source: source(), error: null, timeDisplay: utc })
  await clockPanel.render()
  assert.match(clockPanel.container.querySelector('[data-clock="broker"]').textContent, /Broker time unavailable/)
  assert.match(clockPanel.container.querySelector('[data-clock="display"]').textContent, /Display time unavailable/)
  await clockPanel.render({ view: { ...storedView, selectedRelease: { ...storedView.selectedRelease,
    serverTime: Date.UTC(2025, 0, 10, 15, 30) / 1000, chartTime: Date.UTC(2025, 0, 10, 15, 30) / 1000,
    releaseAt: Date.UTC(2025, 0, 10, 13, 30) } }, symbol: 'EURUSD', source: source(), error: null,
    timeDisplay: { mode: 'fixed-offset', utcOffsetMinutes: 420 } })
  assert.match(clockPanel.container.querySelector('[data-clock="broker"]').textContent, /broker time.*15:30/)
  assert.match(clockPanel.container.querySelector('[data-clock="display"]').textContent, /UTC\+07:00.*20:30/,
    'January 10 NFP shows Jakarta time without double-applying the broker offset')
  console.log('✓ Mounted selected-release broker/display clocks, UTC/local/offset changes and unavailable timing')
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

  let rangeView
  function RangeStorageApp() {
    const state = useInspector({ events: [], symbol: 'EURUSD', bars, timeframe: 'H1', timeDisplay: utc,
      clockOffsetMs: fixtureClockOffset, brokerId: 'Broker-A', brokerOffsetSeconds: 10800 })
    React.useEffect(() => { rangeView = state }, [state])
    return React.createElement(InspectorPanel, { view: state, symbol: 'EURUSD', source: source(), error: null, timeDisplay: utc })
  }
  const rangeApp = mount(RangeStorageApp, {})
  let start = storageRequests.length
  await rangeApp.render()
  await respond(storageRequests[start], storedHealth())
  await respond(storageRequests[start + 1], page([]))
  start = storageRequests.length
  await click(rangeApp.container.querySelector('[aria-label="Inspector date range"]'))
  await click(document.querySelector('[aria-label="Choose 2026-10-01"]'))
  assert.equal(storageRequests.length, start, 'Choosing only the start date does not request a partial range')
  await click(document.querySelector('[aria-label="Choose 2026-10-02"]'))
  assert.equal(storageRequests.length, start + 1, 'A completed calendar range starts one storage lifecycle')
  await respond(storageRequests[start], storedHealth())
  const completedParams = new URL('http://localhost' + storageRequests[start + 1].url).searchParams
  assert.equal(Number(completedParams.get('from_server_seconds')), Date.UTC(2026, 9, 1) / 1000)
  assert.equal(Number(completedParams.get('to_server_seconds')), Date.UTC(2026, 9, 3) / 1000)
  await respond(storageRequests[start + 1], page([rawRow]))
  assert.equal(rangeView.releases.length, 1)
  start = storageRequests.length
  await click(rangeApp.container.querySelector('[aria-label="Inspector date range"]'))
  await change(document.querySelector('[aria-label="Inspector range start"]'), { value: '' })
  assert.equal(storageRequests.length, start, 'Incomplete date edits cannot clear or refetch the applied range')
  assert.equal(rangeView.releases.length, 1)
  await click(document.querySelector('[aria-label="Close date range picker"]'))
  console.log('✓ Mounted date picker/storage integration uses one complete broker range and preserves results during incomplete edits')

  const { magnitudeDistribution, selectedMagnitudeBin } = await server.ssrLoadModule('./src/inspector/magnitude/magnitude-distribution.ts')
  const { nfpMagnitudeHistory, nfpHistoryStart, nfpHistoryScope } = await server.ssrLoadModule('./src/inspector/magnitude/nfp-magnitude-history.ts')
  const { useNfpMagnitudeHistory } = await server.ssrLoadModule('./src/inspector/magnitude/useNfpMagnitudeHistory.ts')
  const { NfpMagnitudeCell } = await server.ssrLoadModule('./src/inspector/magnitude/NfpMagnitudeCell.tsx')
  const { MagnitudeHistogram } = await server.ssrLoadModule('./src/inspector/magnitude/MagnitudeHistogram.tsx')
  const distribution = magnitudeDistribution([0, 1, 2, 3, 1000], -2)
  assert.equal(distribution.p50, 2)
  assert.equal(distribution.p75, 3)
  assert.equal(distribution.p90, 601.2)
  assert.equal(distribution.percentile, 60)
  assert.equal(distribution.overflow, 1)
  assert.equal(distribution.bins.reduce((a, b) => a + b, 0) + distribution.overflow, 5)
  assert.equal(magnitudeDistribution([0, 0, 0], 2).allZero, true)
  assert.equal(magnitudeDistribution([0, 0, 0], 2).currentOverflow, true)
  assert.equal(magnitudeDistribution([NaN, Infinity, -1], 1), null)
  assert.equal(magnitudeDistribution([1, 1], null).percentile, null)
  assert.equal(magnitudeDistribution([1, 1], 1).percentile, 100, 'ECDF ties count magnitudes at or below current')
  assert.equal(magnitudeDistribution([2], 1).p90, 2)
  const binFixture = (magnitude) => ({ ...distribution, scaleMax: 16, bins: Array(16).fill(2), magnitude,
    currentOverflow: magnitude !== null && magnitude > 16 })
  assert.equal(selectedMagnitudeBin(binFixture(0)).index, 0)
  assert.equal(selectedMagnitudeBin(binFixture(1)).index, 1, 'A bin boundary selects the bin on its right')
  assert.equal(selectedMagnitudeBin(binFixture(16)).index, 15, 'The scale endpoint stays in the final regular bin')
  assert.equal(selectedMagnitudeBin(binFixture(17)).index, 'tail')
  assert.equal(selectedMagnitudeBin(binFixture(null)), null)
  const histogramProps = { distribution: magnitudeDistribution([0, 0, 0, 8, 16], 7), label: 'Test series',
    formatValue: (value) => `${value}k`, context: 'Earlier releases only.', tone: 'bad' }
  const histogramApp = mount(MagnitudeHistogram, histogramProps)
  await histogramApp.render()
  let reusablePlot = histogramApp.container.querySelector('.magnitude-histogram')
  let selectedBar = reusablePlot.querySelector('.magnitude-current')
  assert.equal(selectedBar.getAttribute('data-count'), '0')
  assert.ok(selectedBar.classList.contains('magnitude-empty-bin'))
  assert.equal(reusablePlot.querySelectorAll('.magnitude-bin-highlight').length, 1)
  assert.equal([...reusablePlot.querySelectorAll('.magnitude-bar')].reduce((sum, bar) => sum + Number(bar.dataset.count), 0), 5,
    'An empty selected bin does not add a historical observation')
  await act(async () => reusablePlot.dispatchEvent(new dom.MouseEvent('mouseover', { bubbles: true })))
  assert.match(document.querySelector('.magnitude-details').textContent, /No earlier readings in the selected interval/)
  await act(async () => reusablePlot.dispatchEvent(new dom.MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })))
  assert.equal(document.querySelector('.magnitude-details'), null)
  reusablePlot.getBoundingClientRect = () => ({ top: window.innerHeight - 80, bottom: window.innerHeight - 48,
    right: window.innerWidth + 40, left: window.innerWidth - 232, width: 272, height: 32 })
  await act(async () => reusablePlot.focus())
  const boundedCard = document.querySelector('.magnitude-details')
  assert.ok(parseFloat(boundedCard.style.bottom) > 0, 'A bottom-dock hover card opens above its plot')
  assert.ok(parseFloat(boundedCard.style.left) + parseFloat(boundedCard.style.width) <= window.innerWidth - 16,
    'Detail card stays inside the right viewport edge')
  await act(async () => window.dispatchEvent(new dom.Event('resize')))
  assert.equal(document.querySelector('.magnitude-details'), null)
  await act(async () => reusablePlot.blur())
  await histogramApp.render({ ...histogramProps, distribution: magnitudeDistribution([0, 1, 2, 3, 1000], 1001) })
  reusablePlot = histogramApp.container.querySelector('.magnitude-histogram')
  selectedBar = reusablePlot.querySelector('.magnitude-current')
  assert.equal(selectedBar.getAttribute('data-bin'), 'tail')
  assert.equal(selectedBar.getAttribute('data-count'), '1')
  assert.equal(reusablePlot.querySelectorAll('.magnitude-bin-highlight').length, 0, 'Nonempty selection colors the actual frequency bar')
  await act(async () => reusablePlot.focus())
  assert.match(document.querySelector('.magnitude-details').textContent, /Beyond/)
  await histogramApp.render({ ...histogramProps, distribution: magnitudeDistribution([0, 1, 2], null) })
  assert.equal(histogramApp.container.querySelectorAll('.magnitude-current').length, 0)
  assert.equal(histogramApp.container.querySelector('.magnitude-rank strong').textContent, '—')
  await act(async () => histogramApp.container.querySelector('.magnitude-histogram').blur())
  assert.equal(document.querySelector('.magnitude-details'), null)

  const selectedNfp = data.groupInspectorReleases([stored(event({ event_id: '840030016', name: 'Nonfarm Payrolls', unit: 0, multiplier: 1,
    actual: 12, previous: 10, actual_raw_scaled_1e6: '12000000', previous_raw_scaled_1e6: '10000000' }))])[0]
  const historyRow = (id, at, overrides = {}) => ({ ...selectedNfp.events[0], value_id: id, release_at: at,
    server_time_seconds: at / 1000 + 10800, chart_time_seconds: at / 1000 + 10800, availability: 'observed',
    actual: 11, previous: 10, actual_raw_scaled_1e6: '11000000', previous_raw_scaled_1e6: '10000000', ...overrides })
  const earlierRows = [historyRow('before-2015', nfpHistoryStart - 1), historyRow('first', nfpHistoryStart + 86400000),
    historyRow('second', nfpHistoryStart + 2 * 86400000, { actual: 7, actual_raw_scaled_1e6: '7000000' }),
    historyRow('current', selectedNfp.releaseAt), historyRow('future', selectedNfp.releaseAt + 86400000),
    historyRow('absent', nfpHistoryStart + 3 * 86400000, { availability: 'not-returned-by-latest-query' }),
    historyRow('missing', nfpHistoryStart + 4 * 86400000, { actual: null }),
    historyRow('duplicate-1', nfpHistoryStart + 5 * 86400000), historyRow('duplicate-2', nfpHistoryStart + 5 * 86400000),
    historyRow('unit-change', nfpHistoryStart + 6 * 86400000, { multiplier: 0 }),
    historyRow('wrong-country', nfpHistoryStart + 7 * 86400000, { country_code: 'EU' }),
    historyRow('uncertain', nfpHistoryStart + 8 * 86400000, { time_mode: 1 })]
  const hist = nfpMagnitudeHistory([...earlierRows, earlierRows[1]], selectedNfp)[selectedNfp.events[0].value_id]
  assert.equal(hist.distribution.count, 2, 'Only unique, usable earlier publications of this series count')
  assert.equal(hist.distribution.p50, 2)
  assert.equal(hist.distribution.percentile, 50)
  assert.equal(hist.excluded, 3)
  assert.equal(hist.first, nfpHistoryStart + 86400000)
  assert.equal(hist.last, nfpHistoryStart + 2 * 86400000)
  assert.deepEqual(nfpMagnitudeHistory(earlierRows, groups[0]), {}, 'Other families cannot inherit NFP magnitude history')

  let nfpHistoryView
  function NfpHistoryApp({ selected = selectedNfp, brokerId = 'Broker-A' }) {
    const history = useNfpMagnitudeHistory(brokerId, selected)
    React.useEffect(() => { nfpHistoryView = history }, [history])
    return selected ? React.createElement('table', {}, React.createElement('tbody', {}, React.createElement('tr', {},
      React.createElement(NfpMagnitudeCell, { event: selected.events[0], history, grade: 'good' })))) : null
  }
  const historyApp = mount(NfpHistoryApp, {})
  start = storageRequests.length
  await historyApp.render()
  assert.match(historyApp.container.textContent, /Loading history/)
  await respond(storageRequests[start], storedHealth())
  const historyParams = new URL('http://localhost' + storageRequests[start + 1].url).searchParams
  assert.equal(Number(historyParams.get('from_server_seconds')), nfpHistoryStart / 1000)
  assert.equal(Number(historyParams.get('to_server_seconds')), selectedNfp.chartTime)
  assert.equal(historyParams.get('currency'), 'USD')
  assert.deepEqual(historyParams.get('event_ids').split(',').sort(), nfpHistoryScope.eventIds.slice().sort())
  const historyPage = (rows, revision = 1, cursor = null, id = 'Broker-A') => ({ ...page(rows, revision, cursor, id), event_ids: nfpHistoryScope.eventIds })
  await respond(storageRequests[start + 1], historyPage(earlierRows.slice(0, 2), 1, { after_time: anchor, after_id: 'first' }))
  assert.equal(historyApp.container.querySelectorAll('svg').length, 0, 'No partial-page distribution is published')
  await respond(storageRequests[start + 2], { ...historyPage(earlierRows.slice(2)), coverage: { USD: { missing: [[1, 2]] } } })
  assert.equal(nfpHistoryView.rows.a.distribution.count, 2)
  assert.match(historyApp.container.textContent, /Partial history/)
  const plot = historyApp.container.querySelector('.magnitude-histogram')
  assert.match(plot.getAttribute('aria-label'), /2 earlier readings \(small sample\)/)
  assert.match(plot.getAttribute('aria-label'), /50.0%/)
  assert.ok(plot.classList.contains('inspector-grade-good'))
  assert.equal(plot.querySelectorAll('.magnitude-current').length, 1)
  assert.equal(plot.querySelector('.magnitude-current').tagName.toLowerCase(), 'rect', 'The current interval is a colored bar')
  assert.equal(plot.querySelectorAll('circle').length, 0)
  assert.equal(plot.querySelectorAll('text').length, 3, 'Only endpoints and Tail remain on the compact axis')
  assert.equal(plot.querySelector('.magnitude-rank strong').textContent, 'P50')
  assert.equal(plot.querySelector('.magnitude-rank small').textContent, '2 earlier')
  assert.equal(plot.getAttribute('title'), null, 'The long native tooltip is replaced by a detail card')
  await act(async () => plot.focus())
  let details = document.querySelector('.magnitude-details')
  assert.ok(details)
  assert.equal(details.id, plot.getAttribute('aria-describedby'))
  assert.match(details.textContent, /Earlier readings2/)
  assert.match(details.textContent, /P50/)
  assert.match(details.textContent, /Partial USD history/)
  assert.ok(parseFloat(details.style.left) >= 16)
  await act(async () => document.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.equal(document.querySelector('.magnitude-details'), null)
  await act(async () => plot.blur())
  await act(async () => plot.focus())
  assert.ok(document.querySelector('.magnitude-details'))
  await act(async () => window.dispatchEvent(new dom.Event('scroll')))
  assert.equal(document.querySelector('.magnitude-details'), null, 'Scrolling closes the card rather than leaving a stale anchor')
  await act(async () => plot.blur())
  await historyApp.render({ selected: { ...selectedNfp, events: [{ ...selectedNfp.events[0], actual: null }] } })
  assert.equal(historyApp.container.querySelectorAll('.magnitude-current').length, 0, 'Missing current delta retains gray history without a fake marker')
  assert.equal(nfpHistoryView.rows.a.distribution.count, 2)
  assert.equal(nfpHistoryView.rows.a.distribution.percentile, null)
  await historyApp.render()

  const alternate = { ...selectedNfp, id: 'alternate', chartTime: selectedNfp.chartTime - 86400, releaseAt: selectedNfp.releaseAt - 86400000 }
  start = storageRequests.length
  await historyApp.render({ selected: alternate })
  await respond(storageRequests[start], storedHealth())
  const stalePage = storageRequests[start + 1]
  await historyApp.render({ selected: selectedNfp, brokerId: 'Broker-B' })
  assert.ok(stalePage.signal.aborted)
  assert.equal(historyApp.container.querySelectorAll('svg').length, 0, 'Old broker/history is hidden immediately')
  await respond(storageRequests[start + 2], storedHealth('Broker-B'))
  await respond(storageRequests[start + 3], historyPage([], 1, null, 'Broker-B'))
  await respond(stalePage, historyPage(earlierRows))
  assert.equal(nfpHistoryView.rows.a.distribution, null, 'A late old-broker history page cannot repopulate the cell')
  assert.match(historyApp.container.textContent, /No usable earlier readings/)
  start = storageRequests.length
  await historyApp.render({ selected: selectedNfp })
  await respond(storageRequests[start], storedHealth())
  await respond(storageRequests[start + 1], page(earlierRows))
  assert.match(nfpHistoryView.error, /Restart calendar storage/, 'An older service cannot silently supply an unfiltered baseline')
  assert.match(historyApp.container.textContent, /History unavailable/)
  start = storageRequests.length
  await historyApp.render({ selected: null })
  assert.equal(storageRequests.length, start, 'No selected NFP means no history requests')
  await historyApp.render({ selected: selectedNfp, brokerId: null })
  assert.match(historyApp.container.textContent, /History needs calendar storage/)
  console.log('✓ NFP magnitudes, colored bins/tail/empty states, mounted detail cards and prior-release history lifecycle')
} finally {
  await act(async () => { for (const root of roots) root.unmount() })
  await server.close()
  await dom.happyDOM.close()
  for (const [key, descriptor] of Object.entries(previous)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
}
