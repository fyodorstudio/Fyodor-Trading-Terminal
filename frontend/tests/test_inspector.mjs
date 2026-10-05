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
  assert.equal(upgraded.showHistograms, true, 'Legacy settings retain visible histograms')
  assert.equal(upgraded.detailView, 'table', 'Legacy settings default to the readings table')
  localStorage.setItem(data.inspectorStorageKey, JSON.stringify({ ...upgraded, showHistograms: 'invalid' }))
  assert.equal(data.readInspectorPreferences().showHistograms, true, 'Malformed visibility falls back safely')
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
  assert.equal(data.inspectorSurprise(event()), -.1, 'A−F uses Forecast independently of supplied Previous')
  assert.equal(data.inspectorSurprise(event({ previous: null })), -.1)
  assert.equal(data.inspectorSurprise(event({ forecast: .3 })), 0)
  for (const bad of [null, NaN, Infinity]) {
    assert.equal(data.inspectorSurprise(event({ forecast: bad })), null)
    assert.equal(data.inspectorSurprise(event({ actual: bad })), null)
  }
  assert.equal(data.inspectorSurprise(event({ actual_raw_scaled_1e6: '300001', forecast_raw_scaled_1e6: '300000' })), .000001,
    'Stored Actual/Forecast precision is preserved')
  assert.equal(data.inspectorSurprise(event({ actual_raw_scaled_1e6: '300000', forecast_raw_scaled_1e6: 'invalid' })), null)
  assert.equal(data.inspectorSurprise(event({ actual_raw_scaled_1e6: '9007199254740993', forecast_raw_scaled_1e6: '0' })), null)
  assert.equal(data.inspectorDelta(event({ actual: null })), null)
  assert.equal(data.inspectorDelta(event({ actual: 0, previous: 0 })), 0)
  for (const invalid of ['invalid', '1.5', '', 'Infinity', '0xFF']) {
    assert.equal(data.inspectorDelta(event({ actual_raw_scaled_1e6: invalid, previous_raw_scaled_1e6: '100000' })), null)
    assert.equal(data.inspectorDelta(event({ actual_raw_scaled_1e6: '300000', previous_raw_scaled_1e6: invalid })), null,
      'Malformed raw data is unavailable rather than crashing both historical views')
  }
  assert.equal(data.formatInspectorValue(.2, event(), true), '+0.2 pp')
  assert.equal(data.formatInspectorValue(.123123123, event(), true, 2), '+0.12 pp')
  assert.equal(data.formatInspectorValue(-.123123123, event(), true, 2), '-0.12 pp')
  assert.equal(data.formatInspectorValue(.2, event(), true, 2), '+0.2 pp', 'Rounding does not pad trailing zeros')
  assert.equal(data.formatInspectorValue(-.001, event(), true, 2), '0 pp', 'Rounded zero has no misleading negative sign')
  assert.equal(data.formatInspectorValue(.001, event(), true, 2), '0 pp', 'Rounded zero has no misleading positive sign')
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
  assert.equal(data.groupInspectorReleases([statement, decision]).length, 1, 'Known FOMC commentary attaches to the decision episode')
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
  assert.equal(data.buildInspectorMarkers(groups, preferences, bars, 'H1').length, 2, 'Future publications project beyond loaded bars instead of snapping backward')
  assert.equal(data.buildInspectorMarkers(data.groupInspectorReleases([event({ time_mode: 1 })]), preferences, bars, 'H1').length, 0)
  assert.equal(data.buildInspectorMarkers(data.groupInspectorReleases([event({ chart_time_seconds: null })]), preferences, bars, 'H1').length, 0,
    'Known UTC without a broker clock profile cannot masquerade as native candle time')
  assert.equal(data.buildInspectorMarkers(groups, { ...preferences, showSymbols: false }, bars, 'H1').length, 0)
  assert.ok(data.buildInspectorMarkers(groups, preferences, [bars[0]], 'H1').every((marker) => marker.projection && marker.time > Number(bars[0].time)), 'Future markers never reuse the final observed candle')
  assert.equal(data.buildInspectorMarkers(data.groupInspectorReleases([event()]), preferences, [bars[0], bars[2]], 'H1').length, 0, 'Internal historical gaps are not filled with nearest bars')
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
  const showView = async (label) => change(app.container.querySelector('[aria-label="Inspector view"]'), { value: label === 'Table only' ? 'table' : 'scoring' })
  await app.render()
  await click([...app.container.querySelectorAll('.inspector-release')].find((button) => button.textContent.includes('US CPI')))
  assert.deepEqual([...app.container.querySelectorAll('.inspector-table-scroll th')].map((el) => el.textContent), ['Series', 'Actual', 'Previous', 'A−P', 'A−P magnitude · History'])
  assert.match(app.container.querySelector('.inspector-table-scroll tbody').textContent, /\+0.2 pp/)
  assert.match(app.container.querySelector('.inspector-table-scroll tbody').textContent, /Rev: 0.2%/)
  assert.doesNotMatch(app.container.querySelector('.inspector-table-scroll table').textContent, /Sum|Direction|Long|Short|Gross/)
  assert.equal(app.container.querySelector('.inspector-scoring-view'), null, 'Table only is the default')
  await showView('Scoring system')
  assert.equal(app.container.querySelector('.inspector-table-scroll'), null, 'Scoring view contains no readings table')
  assert.equal(app.container.querySelector('[aria-label="CPI pair direction"]').textContent, 'Uncomputed',
    'Incomplete CPI primary readings cannot produce a direction')
  assert.equal(app.container.querySelectorAll('.inspector-cpi-score tbody tr').length, 4)
  assert.ok(app.container.querySelector('.inspector-header .inspector-detail-heading'), 'Selected release metadata shares the toolbar with calendar status')
  assert.equal(app.container.querySelector('.inspector-detail .inspector-detail-heading'), null, 'Metadata leaves no separate summary heading row')
  assert.deepEqual([...app.container.querySelectorAll('.inspector-detail-overview table')].map((table) => table.getAttribute('aria-label')),
    ['CPI price index magnitude score', 'CPI signed magnitude score'], 'Index matrix precedes the rate matrix')
  await showView('Table only')
  assert.equal(app.container.querySelectorAll('.inspector-shared-period').length, 1)
  assert.doesNotMatch(app.container.querySelector('.inspector-table-scroll tbody').textContent, /Period:/, 'Shared period is shown once above the table')
  assert.ok(app.container.querySelector('[aria-label="Release information"]').getAttribute('aria-describedby'))
  await click(app.container.querySelector('.inspector-pair-toggle'))
  assert.equal(app.container.querySelector('nav').hidden, true)
  assert.ok(app.container.querySelector('.inspector-body.releases-collapsed'))
  assert.equal(app.container.querySelectorAll('.inspector-table-scroll tbody tr').length, 2, 'Full-width table keeps the selected readings')
  await click(app.container.querySelector('.inspector-pair-toggle'))
  assert.equal(app.container.querySelector('nav').hidden, false)
  await app.render({ events: [event(), core, nextPeriod] })
  assert.equal(app.container.querySelectorAll('.inspector-shared-period').length, 0)
  assert.equal([...app.container.querySelectorAll('.inspector-table-scroll tbody td:first-child')].filter((cell) => cell.textContent.includes('Period:')).length, 3,
    'Mixed periods remain visible on every row')
  await app.render({ events: pceReadings })
  await click(app.container.querySelector('.inspector-release'))
  assert.deepEqual([...app.container.querySelectorAll('.inspector-table-scroll tbody td:first-child strong')].map((cell) => cell.textContent),
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
  assert.match(app.container.querySelector('.inspector-table-scroll tbody').textContent, /Not applicable/)
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
  await click(document.querySelector('[data-calendar="from"][aria-label="Choose 2026-10-01"]'))
  await click(document.querySelector('[data-calendar="to"][aria-label="Choose 2026-10-01"]'))
  assert.equal(view.releases.length, 3, 'Selecting dates immediately sets the custom range')
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
  assert.ok(document.querySelector('[aria-label="Previous calendar month"]'))
  assert.ok(document.querySelector('[aria-label="Next calendar month"]'))
  await click(document.querySelector('[aria-label="Previous calendar month"]'))
  assert.ok(document.querySelector('[data-calendar="from"][aria-label="Choose 2026-09-15"]'))
  await click(document.querySelector('[aria-label="Next calendar month"]'))
  assert.ok(document.querySelector('[data-calendar="from"][aria-label="Choose 2026-10-15"]'))
  await click(document.querySelector('[data-calendar="from"][aria-label="Choose 2026-10-09"]'))
  await click(document.querySelector('[data-calendar="to"][aria-label="Choose 2026-10-28"]'))
  assert.equal(view.customFrom, '2026-10-09', 'From calendar sets customFrom')
  assert.equal(view.customTo, '2026-10-28', 'To calendar sets customTo')
  assert.equal(view.range.to, Date.UTC(2026, 9, 29), 'The displayed end date is included')
  assert.equal(document.querySelector('[aria-label="Anchor date (YYYY-MM-DD)"]').value, '2026-10-09')
  await change(document.querySelector('[aria-label="Days before anchor date"]'), { value: '5' })
  assert.equal(view.customFrom, '2026-10-04')
  assert.match(document.querySelector('.inspector-range-total-badge').textContent, /25 days total/)
  await change(document.querySelector('[aria-label="Days after anchor date"]'), { value: '10' })
  assert.equal(view.customTo, '2026-10-19')
  assert.match(document.querySelector('.inspector-range-total-badge').textContent, /16 days total/)
  await click(document.querySelector('[aria-label="Set anchor date to today"]'))
  assert.equal(view.customFrom, '2026-09-26')
  assert.equal(view.customTo, '2026-10-11')
  assert.match(document.querySelector('.inspector-range-total-badge').textContent, /16 days total/)
  await change(document.querySelector('[aria-label="Anchor date (YYYY-MM-DD)"]'), { value: '2026-08-15' })
  assert.equal(view.customFrom, '2026-08-10')
  assert.equal(view.customTo, '2026-08-25')
  await click(document.querySelector('[aria-label="Close date range picker"]'))
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
  assert.deepEqual([...app.container.querySelectorAll('.inspector-table-scroll tbody td:first-child strong')].map((cell) => cell.textContent),
    ['Nonfarm Payrolls', 'Unemployment Rate', 'Average Weekly Hours'])
  assert.match(app.container.querySelector('.inspector-table-scroll tbody').textContent, /\+50k/)
  assert.match(app.container.querySelector('.inspector-table-scroll tbody').textContent, /\+0.1 pp/)
  assert.match(app.container.querySelector('.inspector-table-scroll tbody').textContent, /-0.1 h/)
  assert.deepEqual(grading.tallyNfpRelease(view.selectedRelease).counts, { higher: 2, lower: 1, unchanged: 0, missing: 0, unrated: 0 })
  await showView('Scoring system')
  assert.equal(app.container.querySelector('[aria-label="NFP pair direction"]').textContent, 'Uncomputed')
  await showView('Table only')
  const unemploymentDelta = app.container.querySelectorAll('.inspector-table-scroll tbody tr')[1].querySelector('td.inspector-graded-delta')
  assert.equal(unemploymentDelta.textContent, '+0.1 ppHigher', 'Rising unemployment describes the number, without an economic judgment')
  assert.ok(unemploymentDelta.classList.contains('inspector-grade-higher'))
  assert.doesNotMatch(unemploymentDelta.title, /Good|Bad/)
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
  assert.doesNotMatch(app.container.querySelector('.inspector-table-scroll tbody').textContent, /Not applicable/)
  assert.match(app.container.textContent, /Awaiting actual/)
  await app.render({ events: [pmi] })
  assert.match(app.container.querySelector('.inspector-table-scroll tbody').textContent, /\+0.6 pts/)
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
  assert.deepEqual(grading.tallyNfpRelease(view.selectedRelease).counts, { higher: 2, lower: 7, unchanged: 1, missing: 0, unrated: 0 })
  await showView('Scoring system')
  assert.equal(app.container.querySelectorAll('.inspector-nfp-score tbody tr').length, 3)
  assert.equal(app.container.querySelectorAll('.inspector-nfp-supporting tbody tr').length, 7)
  assert.equal(app.container.querySelectorAll('.inspector-signed-magnitude-matrix tbody td[colspan="5"]').length, 10)
  assert.equal(app.container.querySelector('.magnitude-histogram'), null, 'Undefined never invents a histogram')
  const directionLabel = () => app.container.querySelector('[aria-label="NFP pair direction"]').textContent
  assert.equal(directionLabel(), 'Uncomputed', 'Undefined primary boundaries do not invent a direction')
  assert.doesNotMatch(app.container.querySelector('[aria-label="NFP signed magnitude score"]').textContent,
    /NFP majority rule · Experimental|Compared with Previous|A−P magnitude/)
  assert.equal(app.container.querySelector('.inspector-grade-summary'), null, 'The table replaces the old summary strip')
  await showView('Table only')
  assert.equal(app.container.querySelectorAll('td.inspector-grade-higher').length, 2)
  assert.equal(app.container.querySelectorAll('td.inspector-grade-lower').length, 7)
  assert.equal(app.container.querySelectorAll('td.inspector-grade-unchanged').length, 1)
  assert.match(app.container.querySelector('td.inspector-grade-higher').title, /Compared with supplied Previous/)
  assert.equal(grading.gradeNfpReading(gradedRows[0], 'us-cpi'), null)
  assert.equal(grading.gradeNfpReading({ ...gradedRows[0], country_code: 'EU' }, 'jobs'), null)
  assert.equal(grading.gradeNfpReading({ ...gradedRows[0], currency: 'EUR' }, 'jobs'), null)
  for (const event_id of Object.keys(grading.nfpReadingRules)) {
    const row = event({ event_id, actual: 2, previous: 1 })
    assert.equal(grading.gradeNfpReading(row, 'jobs').grade, 'higher')
    assert.equal(grading.gradeNfpReading({ ...row, actual: 0, previous: 0 }, 'jobs').grade, 'unchanged')
    assert.equal(grading.gradeNfpReading({ ...row, actual: null }, 'jobs').grade, 'missing')
  }
  await showView('Scoring system')
  const heldGradeId = view.selectedRelease.id
  await app.render({ events: gradedRows.map((row) => row.event_id === '840030016' ? { ...row, actual: 200 } : row) })
  assert.equal(view.selectedRelease.id, heldGradeId)
  assert.equal(grading.tallyNfpRelease(view.selectedRelease).counts.higher, 3)
  assert.equal(grading.tallyNfpRelease(view.selectedRelease).counts.lower, 6)
  await app.render({ events: gradedRows.map((row) => row.event_id === '840030016' ? { ...row, actual: null } : row) })
  assert.equal(grading.tallyNfpRelease(view.selectedRelease).counts.missing, 1)
  assert.equal(directionLabel(), 'Uncomputed', 'A missing primary reading suppresses direction')
  const heldScoreId = view.selectedRelease.id
  await app.render({ events: gradedRows })
  assert.equal(view.selectedRelease.id, heldScoreId, 'Incoming readings preserve selection')
  assert.equal(directionLabel(), 'Uncomputed', 'Direction still requires defined primary magnitudes')
  await app.render({ events: [core] })
  await click(app.container.querySelector('.inspector-release'))
  assert.equal(app.container.querySelector('[aria-label="NFP reading tally"]'), null)
  assert.equal(app.container.querySelector('[aria-label="NFP signed magnitude score"]'), null)
  await showView('Table only')
  assert.ok(app.container.querySelector('.inspector-row-grade'), 'CPI readings retain descriptive Higher/Lower labels')
  assert.equal(app.container.querySelector('[aria-label="NFP pair direction"]'), null)
  console.log('✓ Mounted NFP ten-reading Higher/Lower labels, raw sign colors, zero/missing states, live updates and family isolation')
  console.log('✓ Mounted NFP three-primary/seven-supporting matrices, explicit Undefined direction and incoming changes')

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
      onSelectWindow: () => {}, onClose: () => {}, onToggleHeight: size.toggleHeight,
      isMaxHeight: size.isMaxHeight, resizeHandle: size.resizeHandle,
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
  const sizeToggle = dockApp.container.querySelector('.bottom-dock-size-toggle')
  assert.ok(sizeToggle, 'Dock size toggle button is rendered')
  await click(sizeToggle)
  assert.equal(dock.isMaxHeight, true, 'Size toggle maximizes dock height')
  await click(sizeToggle)
  assert.equal(dock.isMaxHeight, false, 'Size toggle restores dock to minimum height')
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
  await dockApp.render({ activeWindow: 'scatter-plot' })
  assert.equal(dock.height, 420)
  assert.equal(handle.getAttribute('aria-label'), 'Resize Scatter Plot dock')
  await act(async () => handle.dispatchEvent(new dom.KeyboardEvent('keydown', { bubbles: true, key: 'ArrowUp' })))
  assert.equal(dock.height, 444)
  assert.equal(localStorage.getItem(bottomDockHeightKeys['scatter-plot']), '444')
  await dockApp.render({ activeWindow: 'alert' })
  assert.equal(dock.height, 258)
  assert.equal(handle.getAttribute('aria-label'), 'Resize Alert dock')
  await act(async () => handle.dispatchEvent(new dom.KeyboardEvent('keydown', { bubbles: true, key: 'ArrowUp' })))
  assert.equal(dock.height, 282)
  assert.equal(localStorage.getItem(bottomDockHeightKeys.alert), '282')
  await dockApp.render({ activeWindow: 'notebook' })
  assert.equal(dock.height, 342, 'Scatter Plot resizing keeps Notebook height independent')
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
  assert.ok(storageApp.container.textContent.includes('broker time'))
  assert.equal(storedView.markers.length, 1)
  await storageApp.render({ liveEvents: [] })
  assert.equal(storedView.markers.length, 1, 'Publisher restarts and empty live windows cannot remove stored symbols')
  await act(async () => { storedView.setRangePreset('custom'); storedView.setCustomFrom('2015-01-01'); storedView.setCustomTo('2015-01-31') })
  assert.equal(storedView.releases.length, 0, 'Old-range data disappears before the next response')
  await respond(storageRequests[3], storedHealth())
  const historicRequest = storageRequests[4]
  const query = new URL('http://localhost' + historicRequest.url).searchParams
  assert.equal(Number(query.get('from_server_seconds')), Date.UTC(2015, 0, 1) / 1000 - 3600, 'Episode queries include one hour before the visible broker range')
  assert.equal(Number(query.get('to_server_seconds')), Date.UTC(2015, 1, 1) / 1000 + 3600, 'Episode queries include one hour after the visible broker range')
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
  assert.match(clockText('display'), /19:30.*\(UTC\+07:00\)/,
    'Display clock converts established UTC, not the raw export or projected broker timestamp')
  const requestsBeforeClockChange = storageRequests.length
  await storageApp.render({ chartBars: historicBars, timeDisplay: utc })
  assert.match(clockText('display'), /12:30.*\(UTC\)/)
  await storageApp.render({ chartBars: historicBars, timeDisplay: { mode: 'fixed-offset', utcOffsetMinutes: -300 } })
  assert.match(clockText('display'), /07:30.*\(UTC-05:00\)/)
  await storageApp.render({ chartBars: historicBars, timeDisplay: { mode: 'local', utcOffsetMinutes: 0 } })
  const { formatAppTimestamp, timeDisplayZoneLabel } = await server.ssrLoadModule('./src/appearance/time-display/time-display-preference.ts')
  assert.equal(clockText('display'), `${formatAppTimestamp(historic.release_at, { mode: 'local', utcOffsetMinutes: 0 })} (${timeDisplayZoneLabel({ mode: 'local', utcOffsetMinutes: 0 })})`)
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
  assert.match(clockPanel.container.querySelector('[data-clock="display"]').textContent, /20:30.*\(UTC\+07:00\)/,
    'January 10 NFP shows Jakarta time without double-applying the broker offset')
  const releaseHeading = clockPanel.container.querySelector('.inspector-detail-heading')
  const information = releaseHeading.querySelector('[role="tooltip"]')
  assert.ok(information.querySelector('[data-clock="broker"]'), 'Broker time lives only inside the information tooltip')
  assert.ok(information.querySelector('.inspector-shared-period'), 'Shared reference period lives in the same tooltip')
  assert.equal(releaseHeading.querySelector('[data-clock="display"]').parentElement, releaseHeading, 'Only the display timestamp remains beside the unchanged family title')
  assert.doesNotMatch(releaseHeading.querySelector('[data-clock="display"]').textContent, /Display ·|Local ·|Released|Period/)
  assert.doesNotMatch(clockPanel.container.querySelector('.inspector-context').textContent, /Stored calendar|publisher live|Broker time/)
  assert.equal(releaseHeading.querySelector('[aria-label="Release information"]').getAttribute('aria-describedby'), information.id)
  await clockPanel.render({ view: { ...storedView, storage: { ...storedView.storage, loading: true } },
    symbol: 'EURUSD', source: source(), error: null, timeDisplay: utc })
  assert.equal(clockPanel.container.querySelector('.inspector-context [role="status"]').textContent, 'Loading')
  assert.match(clockPanel.container.querySelector('[role="tooltip"]').textContent, /Loading stored calendar/)
  await clockPanel.render({ view: { ...storedView, selectedRelease: null, storage: { ...storedView.storage, loading: false } },
    symbol: 'EURUSD', source: source(), error: null, timeDisplay: utc })
  assert.ok(clockPanel.container.querySelector('[aria-label="Calendar information"]'), 'Calendar details stay available without a selected release')
  assert.ok(clockPanel.container.querySelector('.inspector-info-right [role="tooltip"]'), 'Unselected-calendar tooltip opens to the right of its icon')
  assert.equal(clockPanel.container.querySelector('.inspector-context [role="status"]'), null, 'A loaded calendar adds no persistent status sentence')
  const pendingStorage = { ...storedView.storage, loading: false, coverage: {
    EUR: { missing: [[anchor, anchor + 3600]] }, USD: { missing: [[anchor, anchor + 3600]] },
  } }
  for (const selectedRelease of [storedView.selectedRelease, null]) {
    await clockPanel.render({ view: { ...storedView, selectedRelease, storage: pendingStorage },
      symbol: 'EURUSD', source: source(), error: null, timeDisplay: utc })
    const tooltip = clockPanel.container.querySelector('[role="tooltip"]')
    assert.match(tooltip.textContent, /Coverage pending for EUR and USD/)
    const header = clockPanel.container.querySelector('.inspector-header').cloneNode(true)
    header.querySelectorAll('[role="tooltip"]').forEach((element) => element.remove())
    assert.doesNotMatch(header.textContent, /Coverage pending/, 'Coverage details take no space in the visible header with or without a selection')
    assert.equal(clockPanel.container.querySelector('.inspector-context [role="status"]'), null)
  }
  await clockPanel.render({ view: { ...storedView, selectedRelease: null, storage: { ...pendingStorage,
    coverage: { EUR: { missing: [] }, USD: { missing: [] } } } },
    symbol: 'EURUSD', source: source(), error: null, timeDisplay: utc })
  assert.doesNotMatch(clockPanel.container.querySelector('[role="tooltip"]').textContent, /Coverage pending/)
  console.log('✓ Compact selected-release date, broker/reference-period tooltip, UTC/local/offset changes, unavailable timing and loading-only status')
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
  await click(document.querySelector('[aria-label="Next calendar month"]'))
  await click(document.querySelector('[data-calendar="from"][aria-label="Choose 2026-10-01"]'))
  assert.equal(storageRequests.length, start, 'Choosing only the start date does not request a partial range')
  await click(document.querySelector('[data-calendar="to"][aria-label="Choose 2026-10-02"]'))
  assert.equal(storageRequests.length, start + 1, 'A completed calendar range starts one storage lifecycle')
  await respond(storageRequests[start], storedHealth())
  const completedParams = new URL('http://localhost' + storageRequests[start + 1].url).searchParams
  assert.equal(Number(completedParams.get('from_server_seconds')), Date.UTC(2026, 9, 1) / 1000 - 3600)
  assert.equal(Number(completedParams.get('to_server_seconds')), Date.UTC(2026, 9, 3) / 1000 + 3600)
  await respond(storageRequests[start + 1], page([rawRow]))
  assert.equal(rangeView.releases.length, 1)
  await click(document.querySelector('[aria-label="Close date range picker"]'))
  console.log('✓ Mounted date picker/storage integration uses one complete broker range and preserves results during incomplete edits')

  const { magnitudeDistribution, magnitudeBin, selectedMagnitudeBin } = await server.ssrLoadModule('./src/inspector/magnitude/magnitude-distribution.ts')
  const { nfpMagnitudeHistory: buildNfpMagnitudeHistory, nfpHistoryStart, nfpHistoryScope } = await server.ssrLoadModule('./src/inspector/magnitude/nfp-magnitude-history.ts')
  const nfpMagnitudeHistory = (events, selected, settings) => buildNfpMagnitudeHistory(events, selected, settings, anchor * 1000)
  const { useNfpMagnitudeHistory } = await server.ssrLoadModule('./src/inspector/magnitude/useNfpMagnitudeHistory.ts')
  const { NfpMagnitudeCell } = await server.ssrLoadModule('./src/inspector/magnitude/NfpMagnitudeCell.tsx')
  const { MagnitudeHistogram } = await server.ssrLoadModule('./src/inspector/magnitude/MagnitudeHistogram.tsx')
  const { tallyNfpMagnitudes } = await server.ssrLoadModule('./src/inspector/magnitude/nfp-magnitude-tally.ts')
  const { FamilyMagnitudeTally } = await server.ssrLoadModule('./src/inspector/magnitude/FamilyMagnitudeTally.tsx')
  const { nfpMagnitudeFamily } = await server.ssrLoadModule('./src/inspector/magnitude/magnitude-families.ts')
  const MagnitudeTally = (props) => React.createElement(FamilyMagnitudeTally, { ...props, family: nfpMagnitudeFamily })
  assert.equal(magnitudeDistribution([-4, 0, 4], 0), null, 'Undefined has no automatic fallback')
  const binFixture = (current) => magnitudeDistribution([-6, -4, -2, 0, 2, 4, 6], current, [2, 4, 6])
  const distribution = magnitudeDistribution([-4, -2, 0, 2, 4], -2, [4 / 3, 8 / 3, 4])
  assert.equal(distribution.currentSize, 'Medium')
  assert.deepEqual(distribution.bins, [1, 1, 0, 1, 0, 1, 1])
  for (const sign of [-1, 1]) for (const [value, size] of [[0, 'Unchanged'], [2, 'Small'], [2.001, 'Medium'], [4, 'Medium'], [4.001, 'Large'], [6, 'Large'], [6.001, 'Extreme']]) {
    assert.equal(binFixture(sign * value).currentSize, size)
  }
  const extremes = magnitudeDistribution([...Array.from({ length: 98 }, (_, i) => [-6, -4, -2, 0, 2, 4, 6][i % 7]), -19799, 23009], -2, [2, 4, 6])
  assert.deepEqual(extremes.bins, Array(7).fill(14))
  assert.equal(extremes.extremeBelow, 1); assert.equal(extremes.extremeAbove, 1)
  assert.equal(extremes.threshold, 6, 'New extreme values cannot move frozen boundaries')
  assert.equal(binFixture(NaN).currentSize, 'Unavailable')
  for (const sign of [-1, 1]) for (const [index, boundary] of [.1, .2, .3].entries()) {
    assert.equal(magnitudeDistribution([boundary], sign * boundary, [.1, .2, .3]).currentSize, ['Small', 'Medium', 'Large'][index])
    assert.equal(magnitudeDistribution([], sign * (boundary + .000001), [.1, .2, .3]).currentSize, ['Medium', 'Large', 'Extreme'][index])
  }
  assert.deepEqual(magnitudeDistribution([0, 0], 0, [1, 2, 3]).bins, [0, 0, 0, 2, 0, 0, 0])
  const edges = binFixture(-2)
  assert.deepEqual(magnitudeBin(edges, 3), { index: 3, count: 1, from: 0, to: 0 })
  assert.deepEqual(magnitudeBin(edges, 6), { index: 6, count: 1, from: 4, to: 6 })
  const histogramProps = { distribution: magnitudeDistribution([0, 0, 0, 6, 6], -3, [2, 4, 6]), label: 'Test series',
    formatValue: (value) => String(value) + 'k', context: 'Earlier releases only.', tone: 'lower' }
  const histogramApp = mount(MagnitudeHistogram, histogramProps)
  await histogramApp.render()
  let reusablePlot = histogramApp.container.querySelector('.magnitude-histogram')
  assert.equal(reusablePlot.querySelectorAll('.magnitude-bar').length, 7)
  assert.equal(reusablePlot.querySelector('.magnitude-size').textContent, 'Medium')
  assert.equal(reusablePlot.querySelector('.magnitude-sample'), null)
  assert.doesNotMatch(reusablePlot.textContent, /earlier/, 'The history count lives only in the tooltip')
  const selectedBar = reusablePlot.querySelector('.magnitude-current')
  assert.equal(selectedBar.dataset.bin, '1')
  assert.equal(selectedBar.dataset.count, '0')
  assert.ok(selectedBar.classList.contains('magnitude-empty-bin'))
  assert.equal(reusablePlot.querySelectorAll('.magnitude-bin-highlight').length, 1)
  assert.equal([...reusablePlot.querySelectorAll('.magnitude-bar')].reduce((sum, bar) => sum + Number(bar.dataset.count), 0), 5,
    'An empty selected bin does not add a historical observation')
  const centerBar = reusablePlot.querySelector('.magnitude-bar[data-bin="3"]')
  assert.equal(centerBar.getAttribute('height'), '19', 'Exact-zero counts determine the center bar height')
  assert.equal(Number(centerBar.getAttribute('x')) + Number(centerBar.getAttribute('width')) / 2 + 1, 108,
    'The zero band stays centered in the chart')
  assert.equal(reusablePlot.querySelector('.magnitude-zero'), null, 'No tall zero reference line')
  assert.equal(reusablePlot.querySelector('.magnitude-zero-label').getAttribute('y'), '39')
  assert.equal(reusablePlot.querySelector('.magnitude-zero-label').getAttribute('x'), '108')
  await act(async () => reusablePlot.dispatchEvent(new dom.MouseEvent('mouseover', { bubbles: true })))
  let card = document.querySelector('.magnitude-details')
  assert.match(card.textContent, /Selected A−P-3k/)
  assert.match(card.textContent, /This bar's rangeMedium · -4k to < -2k/)
  assert.match(card.textContent, /Dataset readings in range0 of 5 · 0.0%/)
  assert.match(card.textContent, /Historical minimum0k/)
  assert.match(card.textContent, /Historical maximum6k/)
  assert.equal(card.querySelector('.magnitude-details-size').textContent, 'Medium')
  assert.equal(card.querySelectorAll('dl > div').length, 6, 'Tooltip contains only the compact release, range/count and historical min/max fields')
  assert.equal(card.querySelectorAll('p').length, 0, 'Tooltip has no explanatory paragraphs')
  assert.doesNotMatch(card.textContent, /Extreme threshold|P50|P75|P90|Signed A−P rank/)
  const firstTarget = reusablePlot.querySelector('[data-bin-target="0"]')
  await act(async () => reusablePlot.dispatchEvent(new dom.MouseEvent('mouseout', { bubbles: true, relatedTarget: firstTarget })))
  assert.match(document.querySelector('.magnitude-details').textContent, /This bar's rangeLarge · -6k to < -4k/)
  assert.equal(reusablePlot.querySelector('.magnitude-size').textContent, 'Medium', 'Inspecting a large band does not change the selected size label')
  const zeroTarget = reusablePlot.querySelector('[data-bin-target="3"]')
  await act(async () => firstTarget.dispatchEvent(new dom.MouseEvent('mouseout', { bubbles: true, relatedTarget: zeroTarget })))
  assert.match(document.querySelector('.magnitude-details').textContent, /This bar's rangeUnchanged · 0k \(exact\)/)
  assert.match(document.querySelector('.magnitude-details').textContent, /Dataset readings in range3 of 5 · 60.0%/)
  assert.equal(reusablePlot.querySelector('.magnitude-current').dataset.bin, '1', 'Hovering zero does not move the selected release')
  await act(async () => reusablePlot.dispatchEvent(new dom.MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })))
  assert.equal(document.querySelector('.magnitude-details'), null)
  reusablePlot.getBoundingClientRect = () => ({ top: window.innerHeight - 80, bottom: window.innerHeight - 40,
    right: window.innerWidth + 40, left: window.innerWidth - 232, width: 272, height: 40 })
  await act(async () => reusablePlot.focus())
  const boundedCard = document.querySelector('.magnitude-details')
  assert.ok(parseFloat(boundedCard.style.bottom) > 0, 'A bottom-dock hover card opens above its plot')
  assert.ok(parseFloat(boundedCard.style.left) + parseFloat(boundedCard.style.width) <= window.innerWidth - 16,
    'Detail card stays inside the right viewport edge')
  await act(async () => reusablePlot.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'End', bubbles: true })))
  assert.match(document.querySelector('.magnitude-details').textContent, /This bar's rangeLarge · > 4k to 6k/)
  assert.match(document.querySelector('.magnitude-details').textContent, /Dataset readings in range2 of 5 · 40.0%/)
  await act(async () => reusablePlot.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })))
  assert.match(document.querySelector('.magnitude-details').textContent, /Dataset readings in range0 of 5 · 0.0%/)
  await act(async () => reusablePlot.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Home', bubbles: true })))
  assert.match(document.querySelector('.magnitude-details').textContent, /This bar's rangeLarge · -6k to < -4k/)
  await act(async () => window.dispatchEvent(new dom.Event('resize')))
  assert.equal(document.querySelector('.magnitude-details'), null)
  await act(async () => reusablePlot.blur())
  for (const [current, side] of [[7, 'positive'], [-7, 'negative']]) {
    await histogramApp.render({ ...histogramProps, distribution: binFixture(current) })
    reusablePlot = histogramApp.container.querySelector('.magnitude-histogram')
    assert.equal(reusablePlot.querySelector('.magnitude-current'), null)
    assert.equal(reusablePlot.querySelector('.magnitude-extreme-marker').dataset.side, side)
    assert.equal(reusablePlot.querySelector('.magnitude-size').textContent, 'Extreme')
    assert.equal(reusablePlot.querySelector('.magnitude-extreme-label'), null, 'The size label replaces repeated extreme text')
    assert.equal(reusablePlot.querySelectorAll('.magnitude-bar').length, 7, 'An extreme selection does not create another bar')
    await act(async () => reusablePlot.focus())
    assert.match(document.querySelector('.magnitude-details').textContent, /Extreme/)
    await act(async () => reusablePlot.blur())
  }
  await histogramApp.render({ ...histogramProps, distribution, tone: 'lower' })
  assert.ok(reusablePlot.classList.contains('inspector-grade-lower'))
  assert.equal(reusablePlot.querySelector('.magnitude-current').dataset.bin, '1', 'A negative change receives its Lower color')
  await act(async () => reusablePlot.focus())
  assert.match(document.querySelector('.magnitude-details').textContent, /Selected A−P-2k/)
  await histogramApp.render({ ...histogramProps, distribution: extremes })
  assert.deepEqual([...reusablePlot.querySelectorAll('.magnitude-label:not(.magnitude-zero-label)')].map((node) => node.textContent), ['-6k', '6k'])
  assert.match(document.querySelector('.magnitude-details').textContent, /Calculation N100 · 2 extremes hidden/)
  assert.match(document.querySelector('.magnitude-details').textContent, /Historical minimum-19799k/)
  assert.match(document.querySelector('.magnitude-details').textContent, /Historical maximum23009k/)
  assert.doesNotMatch(document.querySelector('.magnitude-details').textContent, /Extreme threshold/)
  await histogramApp.render({ ...histogramProps, distribution: magnitudeDistribution([-6, -6, -5, 0, 6], -6, [2, 4, 6]) })
  const frequencyBars = [...reusablePlot.querySelectorAll('.magnitude-bar')]
  assert.equal(Number(frequencyBars[0].getAttribute('height')), 19)
  assert.equal(Number(frequencyBars[3].getAttribute('height')), 19 / 3, 'Bar height scales with the count')
  for (const oneSided of [[-6, -6], [6, 6]]) {
    await histogramApp.render({ ...histogramProps, distribution: magnitudeDistribution(oneSided, oneSided[0], [2, 4, 6]) })
    assert.equal(reusablePlot.querySelector('.magnitude-zero-label').getAttribute('x'), '108', 'Zero stays centered even with one-sided history')
  }
  await histogramApp.render({ ...histogramProps, distribution: magnitudeDistribution([0, 0, 0], 0, [2, 4, 6]) })
  assert.equal(reusablePlot.querySelector('.magnitude-current').dataset.bin, '3')
  assert.equal(reusablePlot.querySelectorAll('.magnitude-label').length, 3, 'Manual endpoints stay fixed with all-zero history')
  assert.equal(reusablePlot.querySelector('.magnitude-size').textContent, 'Unchanged')
  assert.match(document.querySelector('.magnitude-details').textContent, /Historical minimum0kHistorical maximum0k/)
  await histogramApp.render({ ...histogramProps, distribution: magnitudeDistribution([0, 0, 0, 6, 6], null, [2, 4, 6]) })
  assert.equal(reusablePlot.querySelectorAll('.magnitude-current').length, 0)
  assert.equal(reusablePlot.querySelector('.magnitude-size').textContent, 'Unavailable')
  const emptyTarget = reusablePlot.querySelector('[data-bin-target="1"]')
  await act(async () => reusablePlot.dispatchEvent(new dom.MouseEvent('mouseout', { bubbles: true, relatedTarget: emptyTarget })))
  assert.match(document.querySelector('.magnitude-details').textContent, /Selected A−PUnavailable/)
  assert.match(document.querySelector('.magnitude-details').textContent, /Dataset readings in range0 of 5 · 0.0%/)
  await act(async () => reusablePlot.dispatchEvent(new dom.MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })))
  await act(async () => reusablePlot.blur())
  assert.equal(document.querySelector('.magnitude-details'), null)

  const magnitudeRows = gradedRows.map((row, index) => {
    const magnitude = [1, 3, 5, 7][index % 4]
    return { ...row, previous: 10, actual: index === 9 ? null : index === 8 ? 10 :
      10 + (index < 4 ? 1 : -1) * magnitude }
  })
  const magnitudeRelease = data.groupInspectorReleases(magnitudeRows)[0]
  const readyHistory = (rows = magnitudeRows) => ({ rows: Object.fromEntries(rows.map((row) => [row.value_id,
    { distribution: magnitudeDistribution([-6, 6], data.inspectorDelta(row), [2, 4, 6]), excluded: 0, first: anchor - 86400000, last: anchor - 86400000 }])),
    message: null, error: null, partial: false })
  const oneOfEach = { Small: 1, Medium: 1, Large: 1, Extreme: 1, Unclassified: 0 }
  assert.deepEqual(tallyNfpMagnitudes(magnitudeRelease, readyHistory().rows), { higher: oneOfEach, lower: oneOfEach },
    'Count all four sizes separately for each grade, based on signed A−P; exclude zero/missing readings')
  assert.equal(tallyNfpMagnitudes(null, {}), null)
  assert.equal(tallyNfpMagnitudes({ ...magnitudeRelease, country: 'GB' }, {}), null)
  assert.equal(tallyNfpMagnitudes({ ...magnitudeRelease, familyId: 'us-cpi' }, {}), null)
  const magnitudeTallyApp = mount(MagnitudeTally, { release: magnitudeRelease, history: readyHistory() })
  await magnitudeTallyApp.render()
  const summary = () => magnitudeTallyApp.container.querySelector('[aria-label="NFP magnitude tally"]')
  const sizeCells = (grade) => [...summary().querySelectorAll(`[data-grade="${grade}"] td[data-size]`)].map((cell) => cell.textContent.trim())
  assert.equal(summary().tagName, 'TABLE')
  assert.deepEqual([...summary().querySelectorAll('thead th')].slice(1).map((cell) => cell.textContent), ['Small', 'Medium', 'Large', 'Extreme'])
  assert.deepEqual([...summary().querySelectorAll('tbody th[scope="row"]')].map((cell) => cell.textContent), ['Higher', 'Lower'])
  assert.deepEqual(sizeCells('higher'), ['1', '1', '1', '1'])
  assert.deepEqual(sizeCells('lower'), ['1', '1', '1', '1'])
  const updatedRows = magnitudeRows.map((row, index) => index === 2 ? { ...row, actual: 11 } : row)
  const updatedRelease = data.groupInspectorReleases(updatedRows)[0]
  await magnitudeTallyApp.render({ release: updatedRelease, history: readyHistory(updatedRows) })
  assert.deepEqual(sizeCells('higher'), ['2', '1', '–', '1'], 'Incoming Actual changes refresh the table, with a dash for zero')
  assert.equal(summary().querySelector('[data-grade="higher"] [data-size="Large"]').getAttribute('aria-label'), '0 Higher Large',
    'A dash retains its exact zero meaning for assistive technology')
  const incompleteHistory = readyHistory()
  incompleteHistory.rows[magnitudeRows[0].value_id].distribution = null
  await magnitudeTallyApp.render({ release: magnitudeRelease, history: incompleteHistory })
  assert.deepEqual(sizeCells('higher'), ['–', '1', '1', '1'])
  assert.match(summary().querySelector('tfoot').textContent, /1 Higher unclassified/,
    'A reading without history is explicit rather than silently scored Small')
  await magnitudeTallyApp.render({ release: magnitudeRelease, history: { ...readyHistory(), partial: true } })
  assert.match(summary().textContent, /Partial history/)
  for (const message of ['Loading history…', 'History unavailable', 'No earlier history']) {
    await magnitudeTallyApp.render({ release: magnitudeRelease, history: { ...readyHistory(), message } })
    assert.match(summary().textContent, new RegExp(message))
    assert.equal(summary().querySelector('[data-grade]'), null, 'An unavailable snapshot cannot leave stale magnitude counts visible')
  }
  const snapshotThresholds = { '840030016': 652.9, '840030015': .52, '840030017': .3, '840030018': .6,
    '840030019': 1.005, '840030020': .2, '840030023': 465.1, '840030022': 171.65, '840030032': 66.1, '840030024': .83 }
  const octoberHistory = { ...readyHistory(), rows: Object.fromEntries(gradedRows.map((row) => [row.value_id,
    { distribution: magnitudeDistribution([snapshotThresholds[row.event_id], snapshotThresholds[row.event_id]], data.inspectorDelta(row), [snapshotThresholds[row.event_id] / 3, snapshotThresholds[row.event_id] * 2 / 3, snapshotThresholds[row.event_id]]) }])) }
  const octoberRelease = data.groupInspectorReleases(gradedRows)[0]
  await magnitudeTallyApp.render({ release: octoberRelease, history: octoberHistory })
  assert.deepEqual(sizeCells('higher'), ['1', '1', '–', '–'])
  assert.deepEqual(sizeCells('lower'), ['7', '–', '–', '–'])
  assert.doesNotMatch(summary().textContent, /NFP majority rule · Experimental|Compared with Previous|A−P magnitude/)
  assert.equal(summary().querySelector('tfoot'), null, 'A complete snapshot has just the header and two grade rows')
  await magnitudeTallyApp.render({ release: { ...magnitudeRelease, familyId: 'us-cpi' }, history: readyHistory() })
  assert.equal(summary(), null)
  console.log('✓ Shared Higher/Lower magnitude tally utility, live updates, unavailable/partial history and October inventory example')

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
  const automaticSettings = { '840030016': [.9, 1.8, 2.8], '840030017': [.065, .13, .195] }
  const hist = nfpMagnitudeHistory([...earlierRows, earlierRows[1]], selectedNfp, automaticSettings)[selectedNfp.events[0].value_id]
  assert.equal(hist.distribution.count, 3, 'All unique, usable released publications of this series count')
  assert.equal(hist.earlierCount, 2)
  assert.equal(hist.distribution.threshold, 2.8)
  assert.equal(hist.distribution.extremeBelow, 1)
  assert.equal(hist.distribution.current, 2)
  assert.equal(selectedMagnitudeBin(hist.distribution).index, 6)
  assert.equal(hist.excluded, 3)
  assert.equal(hist.first, nfpHistoryStart + 86400000)
  assert.equal(hist.last, selectedNfp.releaseAt)
  assert.deepEqual(nfpMagnitudeHistory(earlierRows, groups[0]), {}, 'Other families cannot inherit NFP magnitude history')
  const otherCurrent = { ...selectedNfp.events[0], value_id: 'other-selected', event_id: '840030017',
    name: 'Participation Rate', unit: 1, multiplier: 0, actual: .4, previous: .2,
    actual_raw_scaled_1e6: '400000', previous_raw_scaled_1e6: '200000' }
  const otherHistory = [historyRow('other-first', nfpHistoryStart + 86400000, { ...otherCurrent, value_id: 'other-first',
    actual: .3, actual_raw_scaled_1e6: '300000', release_at: nfpHistoryStart + 86400000 }),
    historyRow('other-second', nfpHistoryStart + 2 * 86400000, { ...otherCurrent, value_id: 'other-second',
      release_at: nfpHistoryStart + 2 * 86400000 })]
  const independent = nfpMagnitudeHistory([...earlierRows, ...otherHistory], { ...selectedNfp,
    events: [selectedNfp.events[0], otherCurrent] }, automaticSettings)
  assert.equal(independent.a.distribution.threshold, 2.8)
  assert.ok(Math.abs(independent['other-selected'].distribution.threshold - .195) < 1e-12,
    'Every NFP series computes its threshold independently in native units')

  let nfpHistoryView
  function NfpHistoryApp({ selected = selectedNfp, brokerId = 'Broker-A' }) {
    const history = useNfpMagnitudeHistory(brokerId, selected, fixtureClockOffset)
    React.useEffect(() => { nfpHistoryView = history }, [history])
    return selected ? React.createElement('table', {}, React.createElement('tbody', {}, React.createElement('tr', {},
      React.createElement(NfpMagnitudeCell, { event: selected.events[0], history, grade: 'higher' })))) : null
  }
  const { saveNfpMagnitudeLimits } = await server.ssrLoadModule('./src/inspector/magnitude/nfp-magnitude-settings.ts')
  saveNfpMagnitudeLimits('840030016', [.9, 1.8, 2.8])
  const historyApp = mount(NfpHistoryApp, {})
  start = storageRequests.length
  await historyApp.render()
  assert.match(historyApp.container.textContent, /Loading history/)
  await respond(storageRequests[start], storedHealth())
  const historyParams = new URL('http://localhost' + storageRequests[start + 1].url).searchParams
  assert.equal(Number(historyParams.get('from_server_seconds')), nfpHistoryStart / 1000)
  assert.equal(Number(historyParams.get('to_server_seconds')), (Math.floor(anchor / 86400) + 2) * 86400)
  assert.equal(historyParams.get('currency'), 'USD')
  assert.deepEqual(historyParams.get('event_ids').split(',').sort(), nfpHistoryScope.eventIds.slice().sort())
  const historyPage = (rows, revision = 1, cursor = null, id = 'Broker-A') => ({ ...page(rows, revision, cursor, id), event_ids: nfpHistoryScope.eventIds })
  await respond(storageRequests[start + 1], historyPage(earlierRows.slice(0, 2), 1, { after_time: anchor, after_id: 'first' }))
  assert.equal(historyApp.container.querySelectorAll('svg').length, 0, 'No partial-page distribution is published')
  await respond(storageRequests[start + 2], { ...historyPage(earlierRows.slice(2)), coverage: { USD: { missing: [[1, 2]] } } })
  assert.equal(nfpHistoryView.rows.a.distribution.count, 3)
  assert.match(historyApp.container.textContent, /Partial history/)
  const plot = historyApp.container.querySelector('.magnitude-histogram')
  assert.match(plot.getAttribute('aria-label'), /3 dataset readings \(small sample\)/)
  assert.match(plot.getAttribute('aria-label'), /frozen manual boundaries configured in Scatter Plot/)
  assert.match(plot.getAttribute('aria-label'), /Partial USD history/)
  assert.ok(plot.classList.contains('inspector-grade-higher'))
  assert.equal(plot.querySelectorAll('.magnitude-current').length, 1)
  assert.equal(plot.querySelector('.magnitude-current').dataset.bin, '6')
  assert.equal(plot.querySelector('.magnitude-current').dataset.count, '0')
  assert.equal(plot.querySelector('.magnitude-extreme-marker'), null)
  assert.equal(plot.querySelectorAll('circle').length, 0)
  assert.equal(plot.querySelectorAll('text').length, 3, 'The symmetric threshold endpoints and centered zero remain on the axis')
  assert.equal(plot.querySelector('.magnitude-size').textContent, 'Large')
  assert.deepEqual([...plot.querySelectorAll('.magnitude-label')].map((node) => node.textContent), ['-2.8k', '+2.8k', '0'])
  assert.equal(plot.getAttribute('title'), null, 'The long native tooltip is replaced by a detail card')
  await act(async () => plot.focus())
  let details = document.querySelector('.magnitude-details')
  assert.ok(details)
  assert.equal(details.id, plot.getAttribute('aria-describedby'))
  assert.match(details.textContent, /Earlier \/ All2 \/ 3/)
  assert.match(details.textContent, /Selected A−P\+2k/)
  assert.equal(details.querySelector('.magnitude-details-size').textContent, 'Large')
  assert.match(details.textContent, /Historical minimum-3k/)
  assert.match(details.textContent, /Historical maximum\+1k/)
  assert.doesNotMatch(details.textContent, /Extreme threshold/)
  assert.equal(details.querySelectorAll('dl > div').length, 7)
  assert.doesNotMatch(details.textContent, /P50|P75|P90|Observed dates|History starts/)
  assert.ok(parseFloat(details.style.left) >= 16)
  await act(async () => document.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.equal(document.querySelector('.magnitude-details'), null)
  await act(async () => plot.blur())
  await act(async () => plot.focus())
  assert.ok(document.querySelector('.magnitude-details'))
  await act(async () => window.dispatchEvent(new dom.Event('scroll')))
  assert.equal(document.querySelector('.magnitude-details'), null, 'Scrolling closes the card rather than leaving a stale anchor')
  await act(async () => plot.blur())
  const requestsBeforeCustom = storageRequests.length
  await act(async () => saveNfpMagnitudeLimits('840030016', [2, 5, 8]))
  assert.deepEqual(nfpHistoryView.rows.a.distribution.limits, [2, 5, 8])
  assert.equal(historyApp.container.querySelector('.magnitude-size').textContent, 'Small',
    'Inspector immediately reclassifies from Scatter Plot settings without remounting')
  assert.deepEqual([...plot.querySelectorAll('.magnitude-label')].map((node) => node.textContent), ['-8k', '+8k', '0'])
  assert.match(plot.getAttribute('aria-label'), /frozen manual boundaries configured in Scatter Plot/)
  assert.equal(storageRequests.length, requestsBeforeCustom, 'Settings changes do not reload Inspector history')
  await act(async () => saveNfpMagnitudeLimits('840030016', [.9, 1.8, 2.8]))
  assert.equal(historyApp.container.querySelector('.magnitude-size').textContent, 'Large')
  await historyApp.render({ selected: { ...selectedNfp, events: [{ ...selectedNfp.events[0], actual: null }] } })
  assert.equal(historyApp.container.querySelectorAll('.magnitude-current').length, 0, 'Missing current delta retains gray history without a fake marker')
  assert.equal(nfpHistoryView.rows.a.distribution.count, 3)
  assert.equal(nfpHistoryView.rows.a.distribution.current, null)
  await historyApp.render()

  const alternate = { ...selectedNfp, id: 'alternate', chartTime: selectedNfp.chartTime - 86400, releaseAt: selectedNfp.releaseAt - 86400000 }
  start = storageRequests.length
  await historyApp.render({ selected: alternate })
  assert.equal(storageRequests.length, start, 'Historical selection keeps the full-dataset query and does not refetch')
  await historyApp.render({ selected: alternate, brokerId: 'Broker-C' })
  await respond(storageRequests[start], storedHealth('Broker-C'))
  const stalePage = storageRequests[start + 1]
  await historyApp.render({ selected: selectedNfp, brokerId: 'Broker-B' })
  assert.ok(stalePage.signal.aborted)
  assert.equal(historyApp.container.querySelectorAll('svg').length, 0, 'Old broker/history is hidden immediately')
  await respond(storageRequests[start + 2], storedHealth('Broker-B'))
  await respond(storageRequests[start + 3], historyPage([], 1, null, 'Broker-B'))
  await respond(stalePage, historyPage(earlierRows))
  assert.equal(nfpHistoryView.rows.a.distribution.count, 0, 'A late old-broker page cannot repopulate history')
  assert.equal(nfpHistoryView.rows.a.distribution.threshold, 2.8, 'Frozen boundaries remain usable with empty history')
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
  console.log('✓ Seven zero-centered NFP bands, all-dataset frozen magnitudes, hidden extremes, earlier/total hover details and selection-independent history lifecycle')
} finally {
  await act(async () => { for (const root of roots) root.unmount() })
  await server.close()
  await dom.happyDOM.close()
  for (const [key, descriptor] of Object.entries(previous)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
}
