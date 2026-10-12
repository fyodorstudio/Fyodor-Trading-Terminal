import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'
import fs from 'node:fs'

// Mount production hooks, shell, chart and overlays. Only external network,
// worker ports and the canvas library are faked; no production boundary is stubbed.
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node,
  navigator: dom.navigator, localStorage: dom.localStorage, ResizeObserver: dom.ResizeObserver,
  getComputedStyle: dom.getComputedStyle.bind(dom), IS_REACT_ACT_ENVIRONMENT: true }
const keys = [...Object.keys(globals), 'fetch', 'Worker', '__terminalProbe']
const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const originalNow = Date.now
let now = Date.UTC(2026, 9, 8, 12), sequence = 0
Date.now = () => now
const timers = new Map(), intervals = new Map(), frames = new Map()
const panListeners = new Map(['pointermove', 'pointerup', 'pointercancel'].map(type => [type, new Set()]))
const addWindowListener = dom.addEventListener.bind(dom), removeWindowListener = dom.removeEventListener.bind(dom)
dom.addEventListener = (type, listener, options) => { panListeners.get(type)?.add(listener); addWindowListener(type, listener, options) }
dom.removeEventListener = (type, listener, options) => { panListeners.get(type)?.delete(listener); removeWindowListener(type, listener, options) }
dom.setTimeout = (fn, ms) => { timers.set(++sequence, { fn, ms }); return sequence }
dom.clearTimeout = id => timers.delete(id)
dom.setInterval = (fn, ms) => { intervals.set(++sequence, { fn, ms }); return sequence }
dom.clearInterval = id => intervals.delete(id)
dom.requestAnimationFrame = fn => { frames.set(++sequence, fn); return sequence }
dom.cancelAnimationFrame = id => frames.delete(id)
localStorage.setItem('fyodor.time-display.v1', JSON.stringify({ mode: 'utc', utcOffsetMinutes: 0 }))
localStorage.setItem('fyodor.chart-drawings.v1', JSON.stringify([{ id: 'drawing', symbol: 'EURUSD', timeframe: 'H1', tool: 'parallel-channel',
  points: [{ time: now / 1000 - 5 * 3600, price: 1.1 }, { time: now / 1000 - 3 * 3600, price: 1.2 },
    { time: now / 1000 - 5 * 3600, price: 1 }], createdAt: 1 }]))
localStorage.setItem('fyodor.inspector.eurusd.v1', JSON.stringify({ version: 2, catalogVersion: 1, families: ['us-cpi','ecb'], showSymbols: true, symbolGrouping: 'release', detailView: 'r1', showHistograms: true, symbols: { 'us-cpi': 'star', ecb: 'moon' }, currencyColors: {} }))
const primitives = new Set(), captures = new Set(), pointerPrices = []
let priceShift = 0, priceRange = { from: 1, to: 2 }
dom.SVGElement.prototype.setPointerCapture = id => captures.add(id)
dom.SVGElement.prototype.hasPointerCapture = id => captures.has(id)
dom.SVGElement.prototype.releasePointerCapture = id => captures.delete(id)
const drawChartFrame = () => { for (const primitive of primitives) for (const view of primitive.paneViews()) view.renderer().draw() }

const counters = {}, clocks = [], workerInputs = [], rangeListeners = new Set(), sizeListeners = new Set(), hoverListeners = new Set(), clickListeners = new Set()
const count = name => { counters[name] = (counters[name] ?? 0) + 1 }
const reset = () => { for (const key of Object.keys(counters)) delete counters[key]; clocks.length = 0 }
let range = { from: now / 1000 - 10 * 3600, to: now / 1000 }, logicalRange = { from: 790, to: 800 }, plotted = []
let futureTimes = []
const scale = {
  width: () => 900, options: () => ({ barSpacing: 80 }), getVisibleRange: () => range,
  getVisibleLogicalRange: () => logicalRange,
  timeToCoordinate: time => (Number(time) - Number(range.from)) / 3600 * 80,
  timeToIndex: time => plotted.findIndex(bar => bar.time === time),
  logicalToCoordinate: index => Number.isInteger(index) ? (index - logicalRange.from) * 80 : 0,
  coordinateToLogical: x => Math.ceil(x / 80 + logicalRange.from),
  subscribeVisibleLogicalRangeChange: fn => rangeListeners.add(fn), unsubscribeVisibleLogicalRangeChange: fn => rangeListeners.delete(fn),
  subscribeSizeChange: fn => sizeListeners.add(fn), unsubscribeSizeChange: fn => sizeListeners.delete(fn),
  // Initial candle fit retains this fixture's fixed ten-bar canvas geometry.
  setVisibleLogicalRange: next => { if (next.from !== 0 || next.to !== plotted.length + 7) logicalRange = next }, setVisibleRange: next => { range = next }, fitContent: () => {},
}
const series = { applyOptions: () => {},
  setData: bars => { count('setData'); plotted = [...bars] },
  update: bar => { count('update'); if (plotted.at(-1)?.time === bar.time) plotted[plotted.length - 1] = bar; else plotted.push(bar) },
  priceToCoordinate: price => price * 100 + priceShift, coordinateToPrice: coordinate => { pointerPrices.push(coordinate); return (coordinate - priceShift) / 100 },
  attachPrimitive: primitive => primitives.add(primitive), detachPrimitive: primitive => primitives.delete(primitive),
  createPriceLine: () => ({}), removePriceLine: () => {},
}
const priceScale = { applyOptions: () => {}, getVisibleRange: () => priceRange,
  setVisibleRange: next => { priceRange = next; priceShift = (1 - next.from) * 100 } }
const timeSeries = { setData: rows => { count('futureSetData'); futureTimes = rows },
  update: row => { count('futureUpdate'); futureTimes = [...futureTimes, row] } }
const chart = { addSeries: definition => definition.type === 'line' ? timeSeries : series, timeScale: () => scale, priceScale: () => priceScale,
  applyOptions: () => count('chartOptions'), paneSize: () => ({ width: 900, height: 420 }),
  subscribeCrosshairMove: fn => hoverListeners.add(fn), unsubscribeCrosshairMove: fn => hoverListeners.delete(fn),
  subscribeClick: fn => clickListeners.add(fn), unsubscribeClick: fn => clickListeners.delete(fn),
  remove: () => count('chartRemoved'), chartElement: () => document.querySelector('.market-chart-canvas') }
globalThis.__terminalProbe = { count, clocks, createChart: () => { count('chartCreated'); return chart } }
globalThis.Worker = class { constructor() { count('workerCreated'); throw new Error('Lite must not create calculation workers') } }

const canvasModule = `export const CandlestickSeries = {type:'candle'}, LineSeries = {type:'line'}, ColorType = { Solid: 'solid' }, CrosshairMode = { Normal: 0 },
  TickMarkType = { Year: 0, Month: 1, DayOfMonth: 2, Time: 3, TimeWithSeconds: 4 }, LineStyle = { Dotted: 1, Dashed: 2 };
  export const createChart = (...args) => globalThis.__terminalProbe.createChart(...args);
  export const createSeriesMarkers = () => ({detach(){}});`
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  ssr: { noExternal: ['lightweight-charts'] },
  server: { middlewareMode: true, hmr: false }, plugins: [{ name: 'terminal-work-counts', enforce: 'pre',
    resolveId(source) { if (source === 'lightweight-charts') return '\0terminal-canvas-fixture' },
    load(id) { if (id === '\0terminal-canvas-fixture') return canvasModule },
    transform(code, id) {
      if (id.endsWith('/TerminalWorkspace.tsx')) return code.replace('function TerminalWorkspace() {',
        "function TerminalWorkspace() { globalThis.__terminalProbe.count('workspace');")
      if (id.endsWith('/MarketWatchPanel.tsx')) return code.replace('const positive = quote.dailyChange >= 0',
        "globalThis.__terminalProbe.count('quoteRows'); const positive = quote.dailyChange >= 0")
      if (id.endsWith('/MarketCandlestickChart.tsx')) return code.replace('}: MarketCandlestickChartProps) {',
        "}: MarketCandlestickChartProps) { globalThis.__terminalProbe.count('chartRender');")
      if (id.endsWith('/useCalendarNow.ts')) return code.replace('return now', 'globalThis.__terminalProbe.clocks.push(now); return now')
      if (id.endsWith('/releases/group-days.ts')) return code.replace('  if (!range) return []', "  globalThis.__terminalProbe.count('dailyGrouping'); if (!range) return []")
    },
  }] })

const pending = new Map(), requests = []
let broker = 'fixture-broker', generation = 1, observed = 0, connected = true, clockOffset = 0, failHealth = false
let quotes = Array.from({ length: 200 }, (_, i) => ({ symbol: i === 0 ? 'EURUSD' : `TEST${i}`, description: `Quote ${i}`,
  bid: 1.1, ask: 1.2, daily_change: 0, precision: 5 }))
let bars = Array.from({ length: 800 }, (_, i) => ({ time: now / 1000 + (i - 799) * 3600, open: 1.1, high: 1.2, low: 1, close: 1.15 }))
const catalog = JSON.parse(fs.readFileSync(new URL('./inspector/fixtures/major-calendar-catalog.json', import.meta.url), 'utf8'))
const event = (id, at, actual = .3, previous = .1) => {
  const meta = catalog.find(row => row.event_id === id)
  return { value_id: id + '/' + at, event_id: id, name: meta.event_name, event_code: id,
    currency: meta.country_currency, country_code: meta.country_code, country_name: meta.country_code,
    unit: +meta.unit_code, multiplier: +meta.multiplier_code, digits: +meta.digits, time_mode: 0,
    release_at: at, chart_time_seconds: at / 1000, server_time_seconds: at / 1000,
    period_seconds: Date.UTC(2026, 8, 1) / 1000, revision: 0, actual, previous,
    forecast: .2, revised_previous: null, importance: 'high', impact: 'none', availability: 'observed' }
}
// Use the exported CPI family fixture's actual names, never a guessed source ID.
const cpiMeta = catalog.filter(row => row.country_currency === 'USD' && /^(?:Core )?CPI(?: |$)/.test(row.event_name))
let events = [...cpiMeta.map(row => event(row.event_id, now - 2 * 3600000)), event('999010006', now - 2 * 3600000, 2, 2)]
for (const currency of ['USD','EUR','GBP','JPY','CHF','CAD','AUD','NZD']) {
  const meta = catalog.find(row => currency === 'EUR' ? row.event_id === '999010006' : row.country_currency === currency)
  events.push(event(meta.event_id, now + 86400000, null))
}
let calendarRevision = 1
const health = () => ({ api_version: '1', bridge: { status: 'running', started_at: 1, now: now + clockOffset },
  mt5: { connected, process_running: true, generation, account_server: broker },
  calendar: { status: 'live', instance_id: 'fixture', server_utc_offset_seconds: 0 }, operations: {} })
const reportRequests = []
let reportFailure = false
globalThis.fetch = (url, options = {}) => {
  const u = String(url); requests.push(u)
  if (u.startsWith('/storage-api/highlights')) return Promise.resolve({ ok: true, json: async () => ({ source_id: broker, revision: 'fixture-pins', items: [] }) })
  if (u === '/storage-api/reports') {
    reportRequests.push(JSON.parse(options.body))
    return Promise.resolve({ ok: !reportFailure, status: reportFailure ? 503 : 200, json: async () => reportFailure
      ? { detail: 'Report folder unavailable' }
      : { filename: 'brief.md', path: 'C:\\dev\\Fyodor Trading Terminal Lite\\Market Analyst Workflow\\report\\named\\brief.md', readings: 70, context_readings: 190, coverage_incomplete: true } })
  }
  if (u.startsWith('/storage-api/health')) return Promise.resolve({ ok: true, json: async () => ({ revision: calendarRevision,
    sources: [{ id: broker, publisher_status: 'live', server_now: now / 1000, instance_id: 'fixture' }], collector_error: null }) })
  if (u.startsWith('/storage-api/calendar')) {
    const params = new URL(u, 'http://localhost').searchParams, ids = params.get('event_ids')?.split(',') ?? null
    return Promise.resolve({ ok: true, json: async () => ({ source_id: broker, revision: calendarRevision, timestamp_convention: 'trade_server_time', time_basis: 'chart',
      event_ids: ids, events: events.filter(event => (!params.get('currencies') || params.get('currencies').split(',').includes(event.currency)) && (!ids || ids.includes(event.event_id)) && event.chart_time_seconds >= Number(params.get('from_server_seconds')) &&
        event.chart_time_seconds <= Number(params.get('to_server_seconds'))), coverage: {}, next_cursor: null }) })
  }
  if (u.includes('/activity')) return Promise.resolve({ ok: true, json: async () => ({ events: [], latest_sequence: 0 }) })
  const name = u.includes('/market-watch') ? 'watch' : u.includes('/ohlc') ? 'ohlc' : 'health'
  return new Promise((resolve, reject) => {
    const queue = pending.get(name) ?? []; queue.push({ url: u, resolve, reject, signal: options.signal }); pending.set(name, queue)
    options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  })
}
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.appendChild(container)
const root = createRoot(container)
const props = element => element[Object.getOwnPropertyNames(element).find(key => key.startsWith('__reactProps$'))]
async function reply(name) {
  await React.act(async () => {
    const request = pending.get(name)?.shift(); assert.ok(request, `Pending ${name} reply`)
    if (name === 'health' && failHealth) { request.reject(new Error('Bridge offline')); return }
    let body = health()
    if (name === 'watch') body = { symbols: quotes.map(quote => ({ ...quote })), observed_at: ++observed }
    if (name === 'ohlc') {
      const params = new URL(request.url, 'http://localhost').searchParams, start = Number(params.get('start_pos')), count = Number(params.get('count'))
      const end = bars.length - start, next = start + count
      body = { symbol: params.get('symbol'), timeframe: params.get('timeframe'), bars: bars.slice(Math.max(0, end - count), end).map(bar => ({ ...bar })),
        start_pos: start, next_start_pos: next, has_older: next < bars.length, observed_at: ++observed, source_generation: generation }
    }
    request.resolve({ ok: true, json: async () => body })
  })
}
async function tick(name, ms) {
  const timer = [...timers].find(([, t]) => t.fn.name === name && t.ms === ms)
  assert.ok(timer, `${name}/${ms} timer`); timers.delete(timer[0])
  await React.act(async () => { void timer[1].fn() })
}
const button = label => [...container.querySelectorAll('button')].find(element => element.textContent.trim().replace(/^⚙\s*/, '').startsWith(label))
async function click(element) { assert.ok(element); await React.act(async () => element.click()) }
function assertQuiet(label, workspace = false) {
  for (const key of ['quoteRows', 'chartRender', 'setData', 'update', 'futureSetData', 'futureUpdate', 'workerPosts', ...(workspace ? ['workspace'] : [])])
    assert.equal(counters[key] ?? 0, 0, `${label}: ${key} must remain unchanged`)
}
let append
try {
  const { FyodorTerminalShell } = await server.ssrLoadModule('./src/terminal-shell/FyodorTerminalShell.tsx')
  const { ActivityLogProvider } = await server.ssrLoadModule('./src/system-observability/activity-log/activity-log-store.tsx')
  const { useActivityActions } = await server.ssrLoadModule('./src/system-observability/activity-log/use-activity-log.ts')
  function CommandOnly() {
    count('commandSubscriber')
    const actions = useActivityActions()
    React.useEffect(() => { append = actions.appendActivity }, [actions])
    return null
  }
  await React.act(async () => root.render(React.createElement(ActivityLogProvider, null,
    React.createElement(FyodorTerminalShell), React.createElement(CommandOnly))))
  await reply('health'); await reply('watch')
  while (pending.get('ohlc')?.length) await reply('ohlc')
  const inspectorQuery = requests.find(url => url.startsWith('/storage-api/calendar') && new URL(url, 'http://localhost').searchParams.has('currencies'))
  assert.ok(inspectorQuery)
  const queryRange = new URL(inspectorQuery, 'http://localhost').searchParams
  const selectedStart = Date.UTC(2025, 9, 8) / 1000, selectedEnd = (Math.floor(now / 86400000) + 91) * 86400
  const queriedStart = Number(queryRange.get('from_server_seconds')), queriedEnd = Number(queryRange.get('to_server_seconds'))
  assert.ok(queriedStart <= selectedStart && queriedEnd >= selectedEnd, 'Inspector retains the full selected date window')
  assert.ok(selectedStart - queriedStart + queriedEnd - selectedEnd <= 6 * 3600,
    'Inspector padding is bounded to active policy/PMI companions; retired monthly ISM grouping must not fetch 20 extra days')
  const flush = async () => React.act(async () => { for (const [id, fn] of frames) { frames.delete(id); fn() } })
  await flush()
  assert.equal(plotted.length, 800)
  assert.equal(Math.floor(futureTimes.at(-1).time / 86400), Math.floor(plotted.at(-1).time / 86400) + 90)
  assert.deepEqual([...container.querySelectorAll('[aria-label="App features"] button')].map(node => node.textContent.trim().replace(/\s+\d+$/, '')),
    ['Inspector', 'Alert', 'Activity', '⚙ Settings'])
  assert.equal(container.querySelector('[aria-label="Fundamental tools"]'), null)
  assert.equal(container.querySelector('[aria-label="Experimental features"]'), null)
  assert.deepEqual([...container.querySelectorAll('[aria-label="Chart timeframe"] button')].map(node => node.textContent), ['M1','M5','M15','M30','H1','H4','D1'])
  assert.ok(container.querySelector('[aria-label="Text"]'))
  // A nearby-release chooser dismisses on blank chart clicks before selecting.
  await click(container.querySelector('[aria-label="2 nearby Inspector releases"]'))
  assert.equal(container.querySelectorAll('.inspector-marker-popup button').length, 3)
  await React.act(async () => { for (const handler of clickListeners) handler({ point: { x: 100, y: 100 } }) })
  assert.equal(container.querySelector('.inspector-marker-popup'), null)
  await click(container.querySelector('[aria-label="2 nearby Inspector releases"]'))
  await click(container.querySelector('.inspector-marker-popup .inspector-currency-USD').parentElement)
  const usdCount = events.filter(event => event.currency === 'USD' && event.actual !== null).length
  assert.equal(container.querySelectorAll('.inspector-panel tr[data-series-id]').length, usdCount)
  assert.equal(container.querySelector('[aria-label="Inspector view"]'), null, 'Legacy R1 preferences still open raw tables')
  assert.equal(container.querySelector('.inspector-histogram-btn'), null)
  assert.ok(container.querySelector('.inspector-panel').textContent.includes('Forecast'))
  // Save/Cancel retains the selection and shows the preview immediately.
  const savedBefore = localStorage.getItem('fyodor.inspector.eurusd.v1')
  const sharedBefore = localStorage.getItem('fyodor.inspector.shared.v1')
  await click(container.querySelector('[data-inspector-filter-trigger]'))
  const change = async (element, value) => React.act(async () => {
    assert.ok(element)
    const native = props(element)
    if (native) native.onChange({ target: { value } })
    else { element.value = value; element.dispatchEvent(new dom.Event('change', { bubbles: true })) }
  })
  await change(document.querySelector('[aria-label="Group Inspector symbols"]'), 'day')
  assert.ok(container.querySelector('.inspector-day-symbol'))
  await click([...document.querySelectorAll('dialog button')].find(node => node.textContent === 'Cancel'))
  assert.equal(localStorage.getItem('fyodor.inspector.eurusd.v1'), savedBefore)
  assert.equal(localStorage.getItem('fyodor.inspector.shared.v1'), sharedBefore)
  await click(container.querySelector('[data-inspector-filter-trigger]'))
  await change(document.querySelector('[aria-label="Group Inspector symbols"]'), 'day')
  await click([...document.querySelectorAll('dialog button')].find(node => node.textContent === 'Save'))
  await flush()
  const saved = JSON.parse(localStorage.getItem('fyodor.inspector.shared.v1')).pairs.EURUSD
  assert.equal(saved.symbolGrouping, 'day'); assert.equal(saved.detailView, undefined); assert.equal(saved.showHistograms, undefined)
  const dailyIcon = container.querySelector('.inspector-day-symbol.inspector-currency-USD')
  await click(dailyIcon)
  assert.equal(container.querySelectorAll('.inspector-day-table tr[data-series-id]').length, Number(dailyIcon.textContent))
  assert.ok([...container.querySelectorAll('.inspector-day-table tr[data-series-id]')].every(row => row.querySelector('.inspector-day-time').textContent))
  // Current date range and anchor/QoL: twelve months before today, 90 after.
  await click(container.querySelector('[aria-label="Inspector date range"]'))
  assert.equal(document.querySelector('[aria-label="Days after anchor date"]').value, '90')
  const before = Number(document.querySelector('[aria-label="Days before anchor date"]').value)
  assert.ok(before === 365 || before === 366)
  await React.act(async () => window.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape' })))
  await React.act(async () => { for (const handler of clickListeners) handler({ point: { x: 100, y: 100 } }) })
  assert.equal(container.querySelector('.inspector-panel'), null, 'Blank chart deselects the icon and collapses Inspector')
  await click(dailyIcon)
  assert.ok(container.querySelector('.inspector-panel'))
  // Settings retains existing options, with no Workspace backup child.
  await click(button('Settings'))
  assert.ok(container.querySelector('[aria-label="Chart settings"]'))
  assert.equal(container.querySelector('.workspace-transfer'), null)
  assert.ok(!container.querySelector('[aria-label="Chart settings"]').textContent.includes('Workspace backup'))
  const grid = container.querySelector('.toggle-setting input')
  await React.act(async () => props(grid).onChange({ target: { checked: false } }))
  assert.equal(JSON.parse(localStorage.getItem('fyodor.chart-appearance.v1')).showGrid, false)
  await click(container.querySelector('[aria-label="Close chart settings"]'))
  // Polling/activity/viewport work never creates workers or resubmits unchanged data.
  reset()
  await React.act(async () => append('Application', 'Manual activity regression'))
  assert.equal(counters.workspace ?? 0, 0, 'Logging does not invalidate the workspace')
  assert.equal(counters.chartRender ?? 0, 0)
  reset(); await tick('poll', 2500); await reply('watch'); assertQuiet('Identical Market Watch quotes')
  reset(); await tick('poll', 2000); await reply('ohlc'); assertQuiet('Identical candles')
  reset()
  await React.act(async () => { for (let i = 0; i < 200; i++) for (const notify of rangeListeners) notify() })
  await flush()
  assert.equal(counters.dailyGrouping ?? 0, 0); assert.equal(counters.futureSetData ?? 0, 0)
  const stableWindow = { ...logicalRange }
  await click(button('Alert'))
  assert.equal(container.querySelectorAll('[aria-label="Alert currency"] button').length, 10)
  assert.equal(container.querySelectorAll('.alert-row').length, 8)
  await click([...container.querySelectorAll('.market-watch-row')].find(row => row.textContent.includes('TEST1')))
  while (pending.get('ohlc')?.length) await reply('ohlc')
  assert.deepEqual(logicalRange, stableWindow, 'Pair selection preserves date zoom/pan')
  assert.equal(container.querySelectorAll('[aria-label="Alert currency"] button').length, 10)
  reset()
  await React.act(async () => { for (const timer of intervals.values()) if (timer.ms === 1000) timer.fn() })
  assertQuiet('Alert countdown', true)
  // Genuine price and calendar corrections continue to reach the UI.
  bars = bars.map((bar, i) => i === bars.length - 1 ? { ...bar, close: 1.17 } : bar)
  reset(); await tick('poll', 2000); await reply('ohlc')
  assert.equal(counters.update, 1); assert.equal(counters.futureSetData ?? 0, 0)
  assert.equal(plotted.at(-1).close, 1.17)
  await click(button('Activity'))
  assert.ok(container.querySelector('[aria-label="Activity log"]'))
  await click([...container.querySelectorAll('.market-watch-row')].find(row => row.textContent.includes('EURUSD')))
  while (pending.get('ohlc')?.length) await reply('ohlc')
  await flush()
  await click(container.querySelector('.inspector-day-symbol.inspector-currency-USD'))
  const id = events.find(event => event.currency === 'USD' && event.actual !== null).value_id
  events = events.map(event => event.value_id === id ? { ...event, actual: .8, revision: 2 } : event)
  calendarRevision++
  const poll = [...timers].find(([, timer]) => timer.fn.name === 'poll' && timer.ms === 10000)
  timers.delete(poll[0]); await React.act(async () => poll[1].fn())
  assert.match(container.querySelector('.inspector-day-table').textContent, /0.8%/)
  assert.match(container.querySelector('.inspector-day-table').textContent, /Revision 2/)
  const drawing = () => container.querySelector('.drawing-object')
  const drawingSvg = () => container.querySelector('.chart-drawing-overlay')
  const canvasForDrawing = container.querySelector('.market-chart-canvas')
  canvasForDrawing.getBoundingClientRect = () => ({ top: 200, left: 0, right: 900 })
  drawingSvg().getBoundingClientRect = () => ({ top: 200, left: 0 })
  async function pointer(element, type, x, y) {
    await React.act(async () => element.dispatchEvent(new dom.PointerEvent(type, { bubbles: true, button: 0, pointerId: 1, clientX: x, clientY: y })))
  }
  await pointer(drawing(), 'pointerdown', 400, 310)
  assert.ok(drawing().classList.contains('selected'), 'The terminal selects a saved channel')
  await pointer(drawing(), 'pointerdown', 400, 310)
  await pointer(drawingSvg(), 'pointermove', 440, 315)
  await pointer(drawingSvg(), 'pointerup', 440, 315)
  assert.equal(captures.size, 0)
  const dragged = JSON.parse(localStorage.getItem('fyodor.chart-drawings.v1'))[0]
  assert.equal(dragged.points[0].time, now / 1000 - 5 * 3600 + 1800, 'Fractional body movement is persisted through terminal callbacks')
  assert.ok(Math.abs(dragged.points[0].price - 1.15) < 1e-9)
  assert.equal([...panListeners.values()].reduce((sum, listeners) => sum + listeners.size, 0), 0, 'Dragging drawings does not start chart panning')
  await pointer(canvasForDrawing, 'pointerdown', 100, 300)
  assert.ok(!drawing().classList.contains('selected'), 'Clicking blank chart space deselects drawings through the host capture handler')
  pointerPrices.length = 0
  const priorY = Number(drawing().querySelector('line').getAttribute('y1'))
  const postsBeforeDrawingPan = workerInputs.length
  await pointer(window, 'pointermove', 100, 315)
  assert.deepEqual(pointerPrices, [100, 115], 'Vertical pan converts client coordinates to chart-local coordinates')
  await React.act(async () => drawChartFrame())
  assert.ok(Math.abs(Number(drawing().querySelector('line').getAttribute('y1')) - priorY - 15) < 1e-9,
    'A vertical pan without a horizontal event updates the drawing in the same chart frame')
  await pointer(window, 'pointerup', 100, 315)
  assert.equal(workerInputs.length, postsBeforeDrawingPan, 'Drawing navigation never starts calculation workers')
  assert.deepEqual(JSON.parse(localStorage.getItem('fyodor.chart-drawings.v1'))[0], dragged, 'Chart pan preserves saved drawing anchors')
  const rectangleIcon = container.querySelector('[aria-label="Rectangle"] svg rect')
  assert.ok(rectangleIcon, 'The assembled drawing toolbar uses a real SVG rectangle icon')
  const postsBeforeText = workerInputs.length
  await click(container.querySelector('[aria-label="Text"]'))
  const sameOverlay = drawingSvg()
  await pointer(sameOverlay, 'pointerdown', 520, 315)
  assert.equal(drawingSvg(), sameOverlay, 'Exiting drawing mode does not remount the overlay and discard its editor state')
  let textInput = container.querySelector('[aria-label="Drawing text"]')
  assert.ok(textInput, 'Creating text in the real terminal opens an editable input after exiting drawing mode')
  await React.act(async () => props(textInput).onChange({ target: { value: 'Terminal annotation' } }))
  await React.act(async () => textInput.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
  let savedText = JSON.parse(localStorage.getItem('fyodor.chart-drawings.v1')).find(item => item.tool === 'text')
  assert.equal(savedText.text, 'Terminal annotation', 'Text commits through the assembled terminal callback and persists')
  const textDrawing = () => [...container.querySelectorAll('.drawing-object')].find(node => node.getAttribute('data-drawing-id') === savedText.id)
  await React.act(async () => textDrawing().dispatchEvent(new dom.MouseEvent('dblclick', { bubbles: true })))
  textInput = container.querySelector('[aria-label="Drawing text"]')
  assert.ok(textInput, 'Saved text can be reopened in the terminal')
  await React.act(async () => props(textInput).onChange({ target: { value: 'Edited annotation' } }))
  await React.act(async () => textInput.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
  savedText = JSON.parse(localStorage.getItem('fyodor.chart-drawings.v1')).find(item => item.tool === 'text')
  assert.equal(savedText.text, 'Edited annotation')
  assert.equal(workerInputs.length, postsBeforeText, 'Text creation and editing never launch calculation jobs')
  // Research is a time selection, independent of prices and calendar filters.
  const { researchRangeDates } = await server.ssrLoadModule('./src/research/research-request.ts')
  assert.equal(researchRangeDates(Date.UTC(2026, 9, 25, 3, 30) / 1000, Date.UTC(2026, 9, 25, 4) / 1000,
    { brokerId: 'Elev8-Demo2', brokerOffsetSeconds: 0 }, { mode: 'utc', utcOffsetMinutes: 0 }), null,
    'Ambiguous broker wall clocks must not create a guessed research date')
  assert.deepEqual(researchRangeDates(Date.UTC(2026, 9, 5, 3) / 1000, Date.UTC(2026, 8, 9, 3) / 1000,
    { brokerId: 'Elev8-Demo2', brokerOffsetSeconds: 0 }, { mode: 'utc', utcOffsetMinutes: 0 }), { from: '2026-09-09', to: '2026-10-05' })
  const savedDrawings = localStorage.getItem('fyodor.chart-drawings.v1')
  // Zoom out enough to include tomorrow's projected releases alongside history.
  const originalLogicalCoordinate = scale.logicalToCoordinate
  scale.logicalToCoordinate = index => (index - logicalRange.from) * 20
  await React.act(async () => { for (const notify of rangeListeners) notify() })
  await flush()
  const calendarSymbols = [...container.querySelectorAll('.inspector-chart-symbol')]
  assert.ok(calendarSymbols.length >= 3, 'Historical USD/EUR and upcoming EUR icons are visible before research')
  const assertCalendarReferences = message => {
    const current = [...container.querySelectorAll('.inspector-chart-symbol')]
    assert.ok(current.length === calendarSymbols.length && current.every((node, i) => node === calendarSymbols[i]), message)
  }
  await click(container.querySelector('[aria-label="Research date range"]'))
  assertCalendarReferences('Entering research keeps the same historical and upcoming calendar icons mounted')
  await click(calendarSymbols.at(-1))
  assert.ok(container.querySelector('.inspector-panel'), 'Calendar icons still open Inspector during range selection')
  await click(container.querySelector('.research-range-hint button'))
  assert.equal(container.querySelector('[aria-label="Select research date range"]'), null)
  assertCalendarReferences('Cancelling research preserves calendar references')
  await click(container.querySelector('[aria-label="Research date range"]'))
  let researchOverlay = container.querySelector('[aria-label="Select research date range"]')
  assert.ok(researchOverlay)
  const overlayStyles = document.createElement('style')
  overlayStyles.textContent = fs.readFileSync(new URL('../src/research/research.css', import.meta.url), 'utf8') +
    fs.readFileSync(new URL('../src/inspector/inspector.css', import.meta.url), 'utf8')
  document.head.appendChild(overlayStyles)
  assert.ok(Number(getComputedStyle(container.querySelector('.inspector-chart-markers')).zIndex) >
    Number(getComputedStyle(researchOverlay).zIndex), 'Calendar buttons stay above the research drag surface')
  overlayStyles.remove()
  researchOverlay.getBoundingClientRect = () => ({ left: 0, top: 0 })
  await pointer(researchOverlay, 'pointerdown', 700, 20)
  reset()
  const requestCount = requests.length, pendingFrames = frames.size
  for (let index = 0; index < 20; index++) await pointer(researchOverlay, 'pointermove', 650 - index * 20, 380)
  assert.equal(frames.size, pendingFrames + 1, 'Research pointer movement batches presentation into one frame')
  await flush()
  assertQuiet('Research drag')
  assert.equal(counters.dailyGrouping ?? 0, 0, 'Research dragging does not regroup calendar history')
  assert.equal(requests.length, requestCount, 'Research dragging does not fetch or export data')
  assertCalendarReferences('Research dragging preserves calendar references')
  await pointer(researchOverlay, 'pointerup', 100, 380)
  assert.equal(captures.size, 0)
  const researchPanel = container.querySelector('.chart-research-workspace > .research-panel')
  assert.ok(researchPanel, 'Research shares the chart row instead of blocking the terminal in a modal')
  assertCalendarReferences('Opening the notes panel preserves the calendar icons')
  scale.logicalToCoordinate = originalLogicalCoordinate
  await React.act(async () => { for (const notify of rangeListeners) notify() })
  await flush()
  assert.equal(document.querySelector('dialog[open]'), null)
  assert.equal(localStorage.getItem('fyodor.chart-drawings.v1'), savedDrawings, 'Research selection preserves saved drawings')
  await change(document.querySelector('[aria-label="Report name"]'), 'September bearish move')
  await change(document.querySelector('[aria-label="Research from date"]'), '2026-09-09')
  await change(document.querySelector('[aria-label="Research through date"]'), '2026-10-05')
  reset()
  await change(document.querySelector('[aria-label="Research question"]'), 'Was this USD strength or EUR weakness?')
  assertQuiet('Writing research notes', true)
  assert.equal(counters.dailyGrouping ?? 0, 0, 'Typing notes does not regroup calendar history')
  await click(container.querySelector('.inspector-day-symbol.inspector-currency-USD'))
  const inspected = container.querySelector('.inspector-panel').textContent
  const requestsBeforeResearchPan = requests.length
  reset()
  await pointer(canvasForDrawing, 'pointerdown', 100, 300)
  await pointer(window, 'pointermove', 110, 315)
  await React.act(async () => {
    drawChartFrame()
    for (const handler of clickListeners) handler({ point: { x: 100, y: 100 } })
  })
  await pointer(window, 'pointerup', 110, 315)
  await flush()
  assertQuiet('Panning while writing research', true)
  assert.equal(requests.length, requestsBeforeResearchPan)
  assert.equal(container.querySelector('.inspector-panel').textContent, inspected, 'Chart navigation retains the inspected release while research is open')
  assert.equal(container.querySelector('.chart-research-workspace > .research-panel'), researchPanel)
  assert.equal(document.querySelector('[aria-label="Research question"]').value, 'Was this USD strength or EUR weakness?')
  await click(button('Alert'))
  assert.ok(container.querySelector('.alert-row'), 'The bottom dock remains interactive beside research')
  await click(button('Inspector'))
  assert.ok(container.querySelector('.inspector-panel'))
  await click([...container.querySelectorAll('[aria-label="Chart timeframe"] button')].find(node => node.textContent === 'H4'))
  while (pending.get('ohlc')?.length) await reply('ohlc')
  assert.equal(document.querySelector('[aria-label="Report name"]').value, 'September bearish move')
  assert.equal(document.querySelector('[aria-label="Research question"]').value, 'Was this USD strength or EUR weakness?', 'Timeframe changes preserve the draft')
  await click([...container.querySelectorAll('[aria-label="Chart timeframe"] button')].find(node => node.textContent === 'H1'))
  while (pending.get('ohlc')?.length) await reply('ohlc')
  await flush()
  await React.act(async () => document.querySelector('.research-panel form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(reportRequests.length, 1)
  assert.equal(reportRequests[0].scope, 'EURUSD')
  assert.equal(reportRequests[0].title, 'September bearish move')
  assert.equal(reportRequests[0].context_days, 90)
  assert.equal(reportRequests[0].question, 'Was this USD strength or EUR weakness?')
  assert.ok(!('families' in reportRequests[0]) && !('event_ids' in reportRequests[0]), 'Visible filters never enter the export request')
  assert.match(document.querySelector('[aria-label="Saved report path"]').value, /Lite\\Market Analyst Workflow\\report\\named\\brief\.md$/)
  assert.match(document.querySelector('.research-panel').textContent, /coverage is missing/)
  await click([...document.querySelectorAll('.research-panel button')].find(node => node.textContent === 'Done'))
  await click(container.querySelector('[aria-label="Research date range"]'))
  researchOverlay = container.querySelector('[aria-label="Select research date range"]')
  researchOverlay.getBoundingClientRect = () => ({ left: 0, top: 0 })
  await pointer(researchOverlay, 'pointerdown', 300, 100)
  await pointer(researchOverlay, 'pointermove', 500, 100)
  await React.act(async () => window.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape' })))
  assert.equal(container.querySelector('[aria-label="Select research date range"]'), null)
  assert.equal(captures.size, 0, 'Cancelling research releases pointer capture and frames')
  assert.equal(reportRequests.length, 1)
  await click(button('Alert'))
  await click(container.querySelector('[aria-label^="Prepare research for USD"]'))
  assert.ok(document.querySelector('[aria-label="Research scope"]'))
  await change(document.querySelector('[aria-label="Research scope"]'), 'USD')
  reportFailure = true
  await React.act(async () => document.querySelector('.research-panel form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.match(document.querySelector('.research-panel [role="alert"]').textContent, /Report folder unavailable/)
  assert.equal(reportRequests[1].kind, 'upcoming')
  assert.equal(reportRequests[1].scope, 'USD')
  assert.ok(reportRequests[1].focus_ids.length > 0)
  reportFailure = false
  await React.act(async () => document.querySelector('.research-panel form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.ok(document.querySelector('[aria-label="Saved report path"]'), 'A failed save can be retried')
  await click([...document.querySelectorAll('.research-panel button')].find(node => node.textContent === 'Done'))
  // Shared dock height persists across dock switches.
  const handle = container.querySelector('[role="separator"]')
  await React.act(async () => handle.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })))
  const height = localStorage.getItem('fyodor.bottom-dock.height.v2')
  await click(button('Alert'))
  assert.equal(localStorage.getItem('fyodor.bottom-dock.height.v2'), height)
  await click(button('Alert'))
  await React.act(async () => root.render(null))
  assert.equal(rangeListeners.size, 0); assert.equal(clickListeners.size, 0)
  assert.equal(counters.workerCreated ?? 0, 0)
  try {
    await React.act(async () => root.render(React.createElement(React.StrictMode, null,
      React.createElement(ActivityLogProvider, null, React.createElement(FyodorTerminalShell)))))
  } finally { await React.act(async () => root.render(null)) }
  console.log('✓ Assembled Lite: navigation, filters/raw tables, dates, future axis, drawings, Alert/Activity, viewport/corrections, research drag/export/retry, zero polling/pan work and StrictMode cleanup')
} finally {
  await React.act(async () => root.unmount())
  assert.equal(timers.size, 0); assert.equal(intervals.size, 0); assert.equal(frames.size, 0)
  assert.equal(rangeListeners.size, 0); assert.equal(sizeListeners.size, 0); assert.equal(hoverListeners.size, 0); assert.equal(clickListeners.size, 0)
  Date.now = originalNow
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
  }
}
