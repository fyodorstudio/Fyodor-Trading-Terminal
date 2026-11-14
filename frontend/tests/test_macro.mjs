import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'
import fs from 'node:fs'

// Terminal contracts: production hooks/dialog/data; no browser or visual audit.
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, navigator: dom.navigator, IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map([...Object.keys(globals), 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const timers = new Map(), requests = []; let timerId = 0
dom.setTimeout = fn => { timers.set(++timerId, fn); return timerId }
dom.clearTimeout = id => timers.delete(id)
globalThis.fetch = (url, options) => String(url) === '/storage-api/fed-forecasts'
  ? Promise.resolve({ ok: true, json: async () => ({ schema: 1, meetings: [] }) })
  : new Promise(resolve => requests.push({ url: String(url), signal: options.signal, resolve }))
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.append(host)
const root = createRoot(host)
const at = Date.UTC(2026, 0, 1), start = at / 1000
const event = (overrides = {}) => ({ value_id: 'one', event_id: '840050014', currency: 'USD', country_code: 'US',
  time_mode: 0, unit: 1, multiplier: 0, actual: 4.5, forecast: 9, previous: 8, revised_previous: 7,
  release_at: at, chart_time_seconds: start, availability: 'observed', revision: 0, ...overrides })
const reply = (request, body) => React.act(async () => request.resolve({ ok: true, json: async () => body }))
const reactProps = element => element[Object.getOwnPropertyNames(element).find(key => key.startsWith('__reactProps$'))]
try {
  const { macroHistory, macroUpcoming, macroPlot, macroNumberLabels, supportsMacro, macroMetrics, macroValue } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-data.ts')
  const rba = JSON.parse(fs.readFileSync(new URL('../../config/calendar-overrides/AUD-RBA-rate.json', import.meta.url), 'utf8'))
  const latestRba = rba.releases[0], rbaAt = Date.parse(latestRba.set.released_at), rbaChart = rbaAt / 1000 + 7200
  const rbaKey = 'AUD:AU:36030008'
  const correctedRba = event({ event_id: rba.event_id, value_id: latestRba.value_id, currency: 'AUD', country_code: 'AU',
    time_mode: 0, actual: latestRba.set.actual, forecast: latestRba.set.forecast, release_at: rbaAt, chart_time_seconds: rbaChart })
  const rbaHistory = macroHistory([correctedRba], rbaAt, 'actual', [rbaKey])[rbaKey]
  assert.deepEqual(macroPlot([{ time: rbaChart }], rbaHistory, 3600, true).dots, [{ time: rbaChart, value: 4.85 }], 'Corrected RBA releases produce MFDI dots')
  assert.equal(macroHistory([correctedRba], rbaAt, 'forecast', [rbaKey])[rbaKey][0].value, 4.85)
  assert.deepEqual(macroHistory([{ ...correctedRba, time_mode: 1, release_at: null, chart_time_seconds: null }], rbaAt, 'actual', [rbaKey])[rbaKey], [], 'Uncorrected date-only rows still need timing')
  const macroEventIds = Object.values(macroMetrics).map(metric => metric.eventId)
  const { defaultMacroPreferences, readMacroPreferences, saveMacroPreferences, macroAxis, selectMacroAxis, selectMacroMetric, toggleMacroMetric, toggleMacroForecast, toggleMacroNumbers } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-preferences.ts')
  assert.ok(supportsMacro('USDX')); assert.ok(supportsMacro('USDX.a'))
  for (const symbol of ['EURUSD', 'USDJPY', 'EURX', 'JPYX', 'USDX-PERP', 'USDXFAKE']) assert.equal(supportsMacro(symbol), true)
  const invalid = [
    { event_id: '840050015' }, { country_code: 'CA' }, { currency: 'CAD' }, { unit: 0 }, { multiplier: 2 },
    { actual: null }, { actual: NaN }, { release_at: null }, { release_at: at + 100000 },
    { time_mode: 2 }, { chart_time_seconds: null }, { availability: 'not-returned-by-latest-query' },
  ].map((overrides, i) => event({ value_id: `invalid-${i}`, ...overrides }))
  assert.ok(Object.values(macroHistory(invalid, at)).every(rows => !rows.length), 'Other series, forecasts, future releases and unverifiable clocks never plot')
  const history = macroHistory([event({ value_id: 'old' }), ...invalid,
    event({ value_id: 'new', revision: 1, actual: 0 }),
    event({ value_id: 'next', chart_time_seconds: start + 3800, release_at: at + 3800000, actual: 0.25 }),
    ...Object.entries(macroMetrics).filter(([key]) => key !== 'rate').map(([key, metric]) => event({ value_id: key,
      event_id: metric.eventId, unit: metric.unit, multiplier: metric.multiplier, actual: key === 'payrolls' ? -120 : -0.1 })),
  ], at + 4000000)
  assert.deepEqual(history.rate.map(row => row.value), [0, 0.25], 'Corrections win and zero remains a valid actual')
  assert.equal(history.payrolls[0].value, -120, 'Payrolls preserve the stored thousands, including negative changes')
  assert.equal(history.coreCpi[0].value, -0.1, 'Monthly deflation is preserved')
  assert.equal(macroValue('payrolls', -120), '-120k'); assert.equal(macroValue('coreCpi', 0.1), '0.10%')
  const labelHistory = values => values.map((value, time) => ({ id: String(time), time, releasedAt: time * 1000, value }))
  assert.deepEqual([...macroNumberLabels('rate', labelHistory([4.4, 4.3, 4.4, 4.4])).values()],
    ['4.40%', '↓4.30%', '↑4.40%', '4.40%'], 'Arrows compare consecutive available releases; first and equal values have no arrow')
  assert.deepEqual([...macroNumberLabels('payrolls', labelHistory([-120, 0, -10])).values()],
    ['-120k', '↑0k', '↓-10k'], 'Negative and zero actuals compare numerically')
  const preceding = labelHistory([4.4, 4.3, 4.2])
  const latestDot = macroPlot([{ time: 2 }], preceding, 1, false)
  assert.equal(macroNumberLabels('rate', preceding).get(latestDot.readings.get(2).time), '↓4.20%', 'A predecessor outside loaded candles still determines the arrow')
  const forecastHistory = macroHistory([
    ...Object.entries(macroMetrics).map(([key, metric]) => event({ value_id: key, event_id: metric.eventId,
      unit: metric.unit, multiplier: metric.multiplier, actual: null, forecast: key === 'payrolls' ? -120 : 0 })),
    event({ value_id: 'old-consensus', forecast: 4 }), event({ value_id: 'removed-consensus', revision: 1, forecast: null }),
    event({ event_id: macroMetrics.payrolls.eventId, unit: 4, multiplier: 1, forecast: 999, release_at: at + 1000 }),
    event({ event_id: macroMetrics.payrolls.eventId, unit: 4, multiplier: 1, forecast: 999, chart_time_seconds: null }),
  ], at, 'forecast')
  assert.deepEqual(forecastHistory.rate, [], 'A latest blank forecast never borrows the older consensus')
  assert.equal(forecastHistory.payrolls[0].value, -120, 'Forecasts retain payroll units, negatives and verified historical clocks without requiring an actual')
  assert.equal(forecastHistory.coreCpi[0].value, 0, 'Zero is a valid forecast')
  const bars = [-1, 0, 1, 2, 3].map(i => ({ time: start + i * 3600 }))
  const plot = macroPlot(bars, history.rate, 3600, true)
  assert.deepEqual(plot.line.map(point => point.value), [0, 0.25, 0.25, 0.25])
  assert.deepEqual(plot.dots.map(point => point.time), [start, start + 3600])
  assert.ok(plot.line.every(point => bars.some(bar => bar.time === point.time)), 'No new shared-axis timestamps')
  assert.equal(plot.readings.has(start - 3600), false, 'Nothing is inferred before the first actual')
  const monthly = macroPlot(bars, history.rate, 3600, false)
  assert.deepEqual(monthly.line, plot.dots, 'Monthly lines contain released points only')
  const carried = macroPlot(bars.slice(3), history.rate, 3600, false)
  assert.equal(carried.line.length, 0); assert.equal(carried.readings.get(bars[3].time).value, 0.25)
  assert.deepEqual(macroPlot([], history.rate, 3600, true).line, [])
  assert.deepEqual(macroPlot([{ time: start }], history.rate, 86400, true).dots, [{ time: start, value: 0.25 }])
  const scheduledEvent = (key, days = 1, patch = {}) => event({ value_id: `next-${key}`, event_id: macroMetrics[key].eventId,
    unit: macroMetrics[key].unit, multiplier: macroMetrics[key].multiplier, actual: null,
    release_at: at + days * 86400000, chart_time_seconds: start + days * 86400, ...patch })
  const upcoming = macroUpcoming([scheduledEvent('coreCpi'), scheduledEvent('headlineCpi'), scheduledEvent('coreCpi'),
    scheduledEvent('payrolls', 2), scheduledEvent('unemployment', 2), event(),
    scheduledEvent('rate', 3, { chart_time_seconds: null }), scheduledEvent('rate', 4, { time_mode: 2 }),
    scheduledEvent('rate', 5, { availability: 'not-returned-by-latest-query' }), scheduledEvent('rate', 6, { currency: 'CAD' }),
  ], at)
  assert.equal(upcoming.length, 2, 'Upcoming CPI and jobs companions share one publication marker each')
  assert.deepEqual(upcoming[0].metrics, ['coreCpi', 'headlineCpi'])
  assert.deepEqual(upcoming[1].metrics, ['payrolls', 'unemployment'])
  assert.deepEqual(upcoming[1].forecasts, { payrolls: 9, unemployment: 9 }, 'Companion forecasts retain their individual series')
  assert.equal(upcoming[1].formats.payrolls.unit, 4); assert.equal(upcoming[1].formats.payrolls.multiplier, 1)
  const revisedUpcoming = macroUpcoming([
    scheduledEvent('payrolls', 1, { forecast: 100 }),
    scheduledEvent('payrolls', 1, { revision: 1, forecast: null }),
    scheduledEvent('unemployment', 1, { forecast: 0 }),
    scheduledEvent('coreCpi', 2, { forecast: NaN }),
  ], at)
  assert.deepEqual(revisedUpcoming[0].forecasts, { unemployment: 0 }, 'Latest blank/zero forecasts preserve their distinct meanings')
  assert.deepEqual(revisedUpcoming[1].forecasts, {}, 'Nonnumeric upcoming values remain schedule only')
  assert.equal(macroUpcoming([scheduledEvent('coreCpi')], at + 86400000).length, 0, 'Elapsed schedules never remain upcoming')

  const { createMacroReleaseMarkers } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-release-markers.ts')
  const markerState = createMacroReleaseMarkers(), markerAt = at + 1000
  const markerIndicator = { enabled: true, status: '', preferences: defaultMacroPreferences, history: {}, upcoming: [
    { time: start, releasedAt: markerAt, metrics: ['payrolls'], forecasts: { payrolls: 0 } },
  ] }
  markerState.sync(markerIndicator, at)
  assert.equal(markerState.all()[0].forecast, 0)
  markerState.sync({ ...markerIndicator, upcoming: [] }, markerAt + 1)
  assert.equal(markerState.all()[0].forecast, 0, 'A due release keeps its last captured forecast while the actual is pending')
  assert.equal(markerState.all()[0].actual, undefined, 'Reaching the scheduled time never fabricates an actual')
  const publishedReading = { time: start, releasedAt: markerAt, id: 'published', value: 125 }
  markerState.sync({ ...markerIndicator, upcoming: [], history: { payrolls: [publishedReading] } }, markerAt + 1)
  assert.equal(markerState.all().length, 1, 'Publication replaces the forecast marker rather than adding a duplicate')
  assert.equal(markerState.all()[0].actual, publishedReading)
  assert.equal(markerState.hasActual('payrolls', markerAt), true)
  markerState.clear(); assert.deepEqual(markerState.all(), [])
  markerState.sync(markerIndicator, at)
  markerState.sync({ ...markerIndicator, upcoming: [{ ...markerIndicator.upcoming[0], forecasts: {} }] }, at)
  assert.equal(markerState.all()[0].forecast, undefined, 'A revised blank forecast does not borrow an older value')
  markerState.sync({ ...markerIndicator, upcoming: [] }, at)
  assert.deepEqual(markerState.all(), [], 'Cancelled future releases disappear')
  dom.localStorage.setItem('fyodor.indicators.fed-rate.v1', 'true')
  assert.equal(readMacroPreferences().enabled, true, 'The original Fed visibility migrates')
  assert.equal(dom.localStorage.getItem('fyodor.indicators.fed-rate.v1'), 'true', 'Migration preserves the old preference')
  dom.localStorage.removeItem('fyodor.indicators.macro.v2')
  dom.localStorage.setItem('fyodor.indicators.macro.v1', JSON.stringify({ enabled: false, view: 'bad', labourAxis: 'bad',
    series: { coreCpi: { color: 'invalid', lineWidth: 9, visible: false } } }))
  const sanitized = readMacroPreferences()
  assert.equal(sanitized.enabled, false); assert.equal(sanitized.axisTarget, 'rate')
  assert.ok(Object.values(sanitized.series).filter(style => style.visible).length === 4)
  assert.equal(sanitized.series.coreCpi.visible, false); assert.equal(sanitized.series.coreCpi.color, defaultMacroPreferences.series.coreCpi.color)
  dom.localStorage.removeItem('fyodor.indicators.macro.v2')
  dom.localStorage.setItem('fyodor.indicators.macro.v1', JSON.stringify({ enabled: true, view: 'labour', labourAxis: 'unemployment',
    series: { payrolls: { visible: false, color: '#123456', lineWidth: 3 } } }))
  const migrated = readMacroPreferences()
  assert.equal(migrated.axisTarget, 'unemployment')
  assert.equal(migrated.series.payrolls.visible, false); assert.equal(migrated.series.payrolls.color, '#123456')
  assert.equal(migrated.series.payrolls.forecastVisible, true, 'Existing settings adopt payroll forecasts without changing visibility or style')
  assert.equal(migrated.series.rate.forecastVisible, false, 'Other forecast layers start hidden')
  const forecastToggled = toggleMacroForecast(migrated, 'payrolls')
  assert.equal(forecastToggled.series.payrolls.forecastVisible, false)
  assert.equal(forecastToggled.series.payrolls.visible, false, 'F never changes the actual-series eye')
  assert.equal(migrated.series.payrolls.forecastVisible, true, 'F does not mutate the old preference')
  saveMacroPreferences(forecastToggled)
  assert.deepEqual(readMacroPreferences(), forecastToggled, 'Forecast off choices persist')
  assert.ok(Object.values(migrated.series).every(style => !style.numbersVisible), 'Existing settings default to hidden numbers')
  const numbered = toggleMacroNumbers(forecastToggled, 'payrolls')
  assert.equal(numbered.series.payrolls.numbersVisible, true)
  assert.equal(numbered.series.payrolls.visible, false, 'N preserves the series eye')
  assert.equal(numbered.series.payrolls.forecastVisible, false, 'N preserves the forecast choice')
  assert.equal(forecastToggled.series.payrolls.numbersVisible, false, 'N never mutates previous settings')
  saveMacroPreferences(numbered)
  assert.deepEqual(readMacroPreferences(), numbered, 'Number choices survive reload')
  dom.localStorage.removeItem('fyodor.indicators.macro.v2')
  dom.localStorage.setItem('fyodor.indicators.macro.v1', JSON.stringify({ ...defaultMacroPreferences, groups: { policy: true, labour: false, inflation: false } }))
  const flattened = readMacroPreferences()
  assert.equal(flattened.series.rate.visible, true)
  assert.ok(['payrolls', 'unemployment', 'coreCpi', 'headlineCpi'].every(key => !flattened.series[key].visible), 'Legacy category hides migrate to the individual eyes')
  const revealed = selectMacroMetric(flattened, 'headlineCpi')
  assert.equal(revealed.series.headlineCpi.visible, true); assert.equal(revealed.series.coreCpi.visible, false)
  assert.equal(revealed.series.payrolls.visible, false)
  assert.equal(macroAxis(revealed), 'headlineCpi')
  assert.equal(flattened.series.headlineCpi.visible, false, 'Selection never mutates old settings')
  const toggled = toggleMacroMetric(revealed, 'headlineCpi')
  assert.equal(toggled.series.headlineCpi.visible, false); assert.equal(toggled.series.rate.visible, true)
  saveMacroPreferences(toggled)
  assert.deepEqual(readMacroPreferences(), toggled, 'Per-line visibility round-trips without a hidden category master')
  saveMacroPreferences(defaultMacroPreferences)
  assert.equal(macroAxis({ ...defaultMacroPreferences, axisTarget: 'payrolls', series: Object.fromEntries(Object.entries(defaultMacroPreferences.series).map(([key, style]) => [key, { ...style, visible: key === 'unemployment' }])) }), 'unemployment')
  dom.localStorage.removeItem('fyodor.indicators.macro.v2')
  dom.localStorage.setItem('fyodor.indicators.macro.v1', JSON.stringify({ ...defaultMacroPreferences, axisTarget: 'inflation' }))
  assert.equal(readMacroPreferences().axisTarget, 'coreCpi', 'The former shared CPI axis migrates to Core')
  const onlyHeadline = selectMacroAxis(revealed, 'headlineCpi')
  assert.equal(onlyHeadline.series.coreCpi.visible, false, 'Settings axis selection preserves an independently hidden CPI sibling')

  const { ChartWorkspaceHeader } = await server.ssrLoadModule('./src/terminal-shell/ChartWorkspaceHeader.tsx')
  const header = symbol => React.act(async () => root.render(React.createElement(ChartWorkspaceHeader, { symbol, quote: null, timeframe: 'H1', onSelectTimeframe() {}, onToggleMacro() {}, onOpenMacroSettings() {} })))
  await header('USDX')
  assert.ok(host.querySelector('[aria-label="Show MFDI"]'))
  assert.equal(host.querySelector('[aria-label="MFDI settings"]').getAttribute('aria-haspopup'), 'dialog')
  await header('EURUSD'); assert.ok(host.querySelector('[aria-label="MFDI settings"]'))
  await React.act(async () => root.render(null))

  const { useMacroIndicator } = await server.ssrLoadModule('./src/market-data/indicators/macro/useMacroIndicator.ts')
  let view
  function Harness({ symbol = 'USDX', broker = 'A' }) {
    const next = useMacroIndicator(symbol, broker)
    React.useLayoutEffect(() => { view = next }, [next])
    return null
  }
  const render = props => React.act(async () => root.render(React.createElement(Harness, props)))
  await render({}); assert.equal(requests.length, 0)
  await React.act(async () => view.toggleMacro())
  assert.equal(view.macro.enabled, true); assert.match(view.macro.status, /Loading/)
  await reply(requests[0], { revision: 1, sources: [{ id: 'A', coverage: {} }], collector_error: null })
  const params = new URL(requests[1].url, 'http://localhost').searchParams
  assert.equal(params.get('event_ids'), macroEventIds.slice().sort().join(',')); assert.equal(params.get('currencies'), 'USD')
  assert.equal(params.get('time_basis'), 'chart'); assert.equal(params.get('from_server_seconds'), '0')
  await reply(requests[1], { source_id: 'A', revision: 1, timestamp_convention: 'trade_server_time', time_basis: 'chart',
    event_ids: macroEventIds, events: [event(), scheduledEvent('coreCpi', 1, { release_at: Date.now() + 86400000 })], coverage: {}, next_cursor: null })
  assert.equal(view.macro.history.rate.length, 1)
  assert.equal(view.macro.forecastHistory.rate[0].value, 9, 'Forecast curves reuse the same captured calendar snapshot')
  assert.equal(view.macro.upcoming.length, 1)
  const count = requests.length
  await React.act(async () => view.changeMacro(toggleMacroMetric(selectMacroMetric(view.macroPreferences, 'headlineCpi'), 'rate')))
  await React.act(async () => view.changeMacro(toggleMacroForecast(view.macroPreferences, 'headlineCpi')))
  assert.equal(requests.length, count, 'Individual eyes and axis labels reuse the same five-series snapshot')
  const pairPreferences = view.macroPreferences, pairHistory = view.macro.history, pairRequestCount = requests.length
  await render({ symbol: 'EURUSD' }); assert.equal(view.macro.enabled, true)
  assert.equal(view.macroPreferences, pairPreferences); assert.equal(view.macro.history, pairHistory); assert.equal(requests.length, pairRequestCount, 'Changing pairs reuses the shared MFDI data and settings')
  await render({ symbol: 'USDX', broker: 'B' })
  assert.ok(Object.values(view.macro.history).every(rows => !rows.length), 'Broker changes cannot show old-source data')
  const obsolete = requests.at(-1)
  await React.act(async () => view.toggleMacro()); assert.equal(obsolete.signal.aborted, true)
  await reply(obsolete, { revision: 1, sources: [{ id: 'B' }], collector_error: null })
  assert.equal(requests.at(-1), obsolete)
  await React.act(async () => view.toggleMacro())
  await React.act(async () => root.render(null)); await render({})
  assert.equal(view.macro.enabled, true); assert.equal(view.macroPreferences.axisTarget, 'headlineCpi')
  assert.equal(view.macroPreferences.series.rate.visible, false)
  await React.act(async () => root.render(null))

  const { MacroSettingsDialog } = await server.ssrLoadModule('./src/market-data/indicators/macro/MacroSettingsDialog.tsx')
  const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus()
  let saved = null, closes = 0
  const preferences = { ...defaultMacroPreferences, enabled: true }
  const onClose = () => { closes++ }
  const open = () => React.act(async () => root.render(React.createElement(MacroSettingsDialog, { preferences, onSave: next => { saved = next }, onClose })))
  const tab = name => [...host.querySelectorAll('[role="tab"]')].find(button => button.textContent === name)
  const control = label => [...host.querySelectorAll('label')].find(element => element.textContent.startsWith(label)).querySelector('input, select')
  await open()
  assert.equal(tab('Inputs').getAttribute('aria-selected'), 'true')
  assert.equal(host.querySelectorAll('input[type="checkbox"]').length, 14)
  assert.equal(host.querySelectorAll('input[type="color"]').length, 0)
  await React.act(async () => { const input = control('Right axis'); input.value = 'coreCpi'; input.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  await React.act(async () => reactProps(control('Show Fed rate')).onChange({ target: { checked: false } }))
  await React.act(async () => reactProps(control('Show Nonfarm Payrolls')).onChange({ target: { checked: false } }))
  await React.act(async () => tab('Inputs').dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
  assert.equal(document.activeElement, tab('Style')); assert.equal(host.querySelectorAll('input[type="color"]').length, 5)
  await React.act(async () => reactProps(control('Core CPI MoM colour')).onChange({ target: { value: '#123456' } }))
  await React.act(async () => { const input = control('Core CPI MoM line width'); input.value = '4'; input.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  await React.act(async () => reactProps(control('Show Fed rate dots')).onChange({ target: { checked: false } }))
  await React.act(async () => { const input = control('Nonfarm Payrolls line width'); input.value = '3'; input.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  await React.act(async () => reactProps(control('Show Nonfarm Payrolls dots')).onChange({ target: { checked: false } }))
  await React.act(async () => reactProps(control('Show Nonfarm Payrolls forecasts')).onChange({ target: { checked: false } }))
  await React.act(async () => reactProps(control('Show Core CPI MoM forecasts')).onChange({ target: { checked: true } }))
  await React.act(async () => host.querySelector('form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(saved.axisTarget, 'coreCpi'); assert.equal(saved.series.rate.visible, false); assert.equal(saved.enabled, true); assert.equal(saved.series.payrolls.visible, false)
  assert.equal(saved.series.payrolls.lineWidth, 3); assert.equal(saved.series.payrolls.pointsVisible, false)
  assert.equal(saved.series.payrolls.forecastVisible, false); assert.equal(saved.series.coreCpi.forecastVisible, true)
  assert.equal(saved.series.coreCpi.color, '#123456'); assert.equal(saved.series.coreCpi.lineWidth, 4); assert.equal(saved.series.rate.pointsVisible, false)
  assert.equal(preferences.series.coreCpi.color, defaultMacroPreferences.series.coreCpi.color, 'Drafts never mutate live settings')
  await React.act(async () => root.render(null)); assert.equal(document.activeElement, trigger)
  saved = null; await open()
  await React.act(async () => { const input = control('Right axis'); input.value = 'payrolls'; input.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  await React.act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Reset defaults').click())
  assert.equal(control('Right axis').value, 'rate')
  assert.ok([...host.querySelectorAll('.macro-selected-event input[type="checkbox"]')].every(input => input.checked))
  await React.act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Cancel').click())
  assert.equal(saved, null)
  await React.act(async () => dom.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.ok(closes >= 3)
  console.log('✓ MFDI: five exact series/units, corrections/clocks, policy/monthly plots, USDX scope, overlay migration, saved individual eyes/five axes, hidden-axis reveal, shared reads, cancellation and Inputs/Style including payroll line/dots')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  assert.equal(timers.size, 0)
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
