import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'
import { cpi } from './usd-context/fixtures.mjs'

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
localStorage.setItem('fyodor.raycaster.visible.v1', 'true')
localStorage.setItem('fyodor.context-sequences.v1', JSON.stringify({ roofs: true, fresh: true, ribbon: true, density: 'concise' }))
localStorage.setItem('fyodor.time-display.v1', JSON.stringify({ mode: 'utc', utcOffsetMinutes: 0 }))
localStorage.setItem('fyodor.chart-drawings.v1', JSON.stringify([{ id: 'drawing', symbol: 'EURUSD', timeframe: 'H1', tool: 'parallel-channel',
  points: [{ time: now / 1000 - 5 * 3600, price: 1.1 }, { time: now / 1000 - 3 * 3600, price: 1.2 },
    { time: now / 1000 - 5 * 3600, price: 1 }], createdAt: 1 }]))
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
const scale = {
  width: () => 900, options: () => ({ barSpacing: 80 }), getVisibleRange: () => range,
  getVisibleLogicalRange: () => logicalRange,
  timeToCoordinate: time => (Number(time) - Number(range.from)) / 3600 * 80,
  timeToIndex: time => plotted.findIndex(bar => bar.time === time),
  logicalToCoordinate: index => Number.isInteger(index) ? (index - logicalRange.from) * 80 : 0,
  coordinateToLogical: x => Math.ceil(x / 80 + logicalRange.from),
  subscribeVisibleLogicalRangeChange: fn => rangeListeners.add(fn), unsubscribeVisibleLogicalRangeChange: fn => rangeListeners.delete(fn),
  subscribeSizeChange: fn => sizeListeners.add(fn), unsubscribeSizeChange: fn => sizeListeners.delete(fn),
  setVisibleLogicalRange: next => { logicalRange = next }, setVisibleRange: next => { range = next }, fitContent: () => {},
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
const chart = { addSeries: () => series, timeScale: () => scale, priceScale: () => priceScale,
  applyOptions: () => count('chartOptions'), paneSize: () => ({ width: 900, height: 420 }),
  subscribeCrosshairMove: fn => hoverListeners.add(fn), unsubscribeCrosshairMove: fn => hoverListeners.delete(fn),
  subscribeClick: fn => clickListeners.add(fn), unsubscribeClick: fn => clickListeners.delete(fn),
  remove: () => count('chartRemoved'), chartElement: () => document.querySelector('.market-chart-canvas') }
globalThis.__terminalProbe = { count, clocks, createChart: () => { count('chartCreated'); return chart } }
let calculate, calculateCpi
globalThis.Worker = class {
  constructor() { count('workerCreated'); this.terminated = false }
  postMessage(message) {
    count('workerPosts'); workerInputs.push(message.input)
    void Promise.resolve().then(() => { if (!this.terminated) this.onmessage?.({ data: { id: message.id, result: (message.input.release ? calculateCpi : calculate)(message.input) } }) })
  }
  terminate() { this.terminated = true; count('workerTerminated') }
}

const canvasModule = `export const CandlestickSeries = {}, ColorType = { Solid: 'solid' }, CrosshairMode = { Normal: 0 },
  TickMarkType = { Year: 0, Month: 1, DayOfMonth: 2, Time: 3, TimeWithSeconds: 4 }, LineStyle = { Dotted: 1, Dashed: 2 };
  export const createChart = (...args) => globalThis.__terminalProbe.createChart(...args);
  export const createSeriesMarkers = () => ({detach(){}});`
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  ssr: { noExternal: ['lightweight-charts'] },
  server: { middlewareMode: true, hmr: false }, plugins: [{ name: 'terminal-work-counts', enforce: 'pre',
    resolveId(source) { if (source === 'lightweight-charts') return '\0terminal-canvas-fixture' },
    load(id) { if (id === '\0terminal-canvas-fixture') return canvasModule },
    transform(code, id) {
      if (id.endsWith('/FyodorTerminalShell.tsx')) return code.replace('function FyodorTerminalWorkspace() {',
        "function FyodorTerminalWorkspace() { globalThis.__terminalProbe.count('workspace');")
      if (id.endsWith('/MarketWatchPanel.tsx')) return code.replace('const positive = quote.dailyChange >= 0',
        "globalThis.__terminalProbe.count('quoteRows'); const positive = quote.dailyChange >= 0")
      if (id.endsWith('/MarketCandlestickChart.tsx')) return code.replace('}: MarketCandlestickChartProps) {',
        "}: MarketCandlestickChartProps) { globalThis.__terminalProbe.count('chartRender');")
      if (id.endsWith('/useCalendarNow.ts')) return code.replace('return now', 'globalThis.__terminalProbe.clocks.push(now); return now')
      if (id.endsWith('/InspectorScoringView.tsx')) return code.replace('const Component = binding.Component', "globalThis.__terminalProbe.count('scoringRender'); const Component = binding.Component")
    },
  }] })

const pending = new Map(), requests = []
let broker = 'fixture-broker', generation = 1, observed = 0, connected = true, clockOffset = 0, failHealth = false
let quotes = Array.from({ length: 200 }, (_, i) => ({ symbol: i === 0 ? 'EURUSD' : `TEST${i}`, description: `Quote ${i}`,
  bid: 1.1, ask: 1.2, daily_change: 0, precision: 5 }))
let bars = Array.from({ length: 800 }, (_, i) => ({ time: now / 1000 + (i - 799) * 3600, open: 1.1, high: 1.2, low: 1, close: 1.15 }))
let events = [...cpi(2026, 7, [.2, .2, 3]), ...cpi(2026, 8, [.3, .3, 3.1])]
const health = () => ({ api_version: '1', bridge: { status: 'running', started_at: 1, now: now + clockOffset },
  mt5: { connected, process_running: true, generation, account_server: broker },
  calendar: { status: 'live', instance_id: 'fixture', server_utc_offset_seconds: 0 }, operations: {} })
globalThis.fetch = (url, options = {}) => {
  const u = String(url); requests.push(u)
  if (u.startsWith('/storage-api/health')) return Promise.resolve({ ok: true, json: async () => ({ revision: 1,
    sources: [{ id: broker, publisher_status: 'live', server_now: now / 1000, instance_id: 'fixture' }], collector_error: null }) })
  if (u.startsWith('/storage-api/calendar')) {
    const params = new URL(u, 'http://localhost').searchParams, ids = params.get('event_ids')?.split(',') ?? null
    return Promise.resolve({ ok: true, json: async () => ({ source_id: broker, revision: 1, timestamp_convention: 'trade_server_time', time_basis: 'chart',
      event_ids: ids, events: events.filter(event => (!ids || ids.includes(event.event_id)) && event.chart_time_seconds >= Number(params.get('from_server_seconds')) &&
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
const button = label => [...container.querySelectorAll('button')].find(element => element.textContent.trim().startsWith(label))
async function click(element) { assert.ok(element); await React.act(async () => element.click()) }
function assertQuiet(label, workspace = false) {
  for (const key of ['quoteRows', 'chartRender', 'setData', 'update', 'workerPosts', ...(workspace ? ['workspace'] : [])])
    assert.equal(counters[key] ?? 0, 0, `${label}: ${key} must remain unchanged`)
}
let append
try {
  const { FyodorTerminalShell } = await server.ssrLoadModule('./src/terminal-shell/FyodorTerminalShell.tsx')
  const { ActivityLogProvider } = await server.ssrLoadModule('./src/system-observability/activity-log/activity-log-store.tsx')
  const { useActivityActions } = await server.ssrLoadModule('./src/system-observability/activity-log/use-activity-log.ts')
  calculate = (await server.ssrLoadModule('./src/usd-context/core/build-context-timeline.ts')).buildContextTimeline
  calculateCpi = (await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/CPI/runtime/cpi-release-analysis.ts')).calculateCpiRelease
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
  assert.equal(plotted.length, 800)
  assert.ok(workerInputs.length > 0, 'Production context calculation has actually run')
  assert.ok(workerInputs.every(input => input.asOf < events.at(-1).release_at), 'Future publication has not been admitted')
  // Exercise drawing selection, body drag and blank-space deselection through
  // the assembled terminal, including chart navigation and the shared storage.
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
  const postsBeforeContextView = workerInputs.length
  const raycasterView = container.querySelector('[aria-label="Raycaster view"]')
  assert.ok(raycasterView)
  await React.act(async () => { raycasterView.value = 'context-detailed'; raycasterView.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.equal(container.querySelector('[aria-label="Raycaster view"]').value, 'context-detailed', 'The assembled shell retains detailed context with no selected combo')
  assert.ok(container.querySelector('[aria-label="Context-detailed calculations"]'))
  assert.equal(workerInputs.length, postsBeforeContextView, 'Opening the detailed reading reuses the existing scores')
  await React.act(async () => { const view = container.querySelector('[aria-label="Raycaster view"]'); view.value = 'context'; view.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.equal(container.querySelector('.context-detailed-content'), null)
  if (!container.querySelector('.inspector-panel')) await click(button('Inspector'))
  await click(container.querySelector('.inspector-pair-toggle'))
  await click(container.querySelector('.inspector-release'))
  await React.act(async () => {
    const view = container.querySelector('[aria-label="Inspector view"]')
    view.value = 'scoring'; view.dispatchEvent(new dom.Event('change', { bubbles: true }))
  })
  assert.equal(container.querySelectorAll('.inspector-panel [aria-label="Context-Aware at Publication Scoring"]').length, 0)
  await click(button('Open publication context in Raycaster'))
  assert.equal(container.querySelector('[aria-label="Raycaster view"]').value, 'context-detailed')
  const publication = container.querySelector('.raycaster-publication')
  assert.ok(publication.querySelector('[aria-label="CPI v4 context change"]'), 'The shell routes the selected CPI publication and its comparison into Raycaster')
  assert.ok(publication.querySelector('[aria-label="CPI v4 context inputs"]'))
  const publicationText = publication.textContent, jobsBeforeHover = workerInputs.length, rendersBeforeHover = counters.scoringRender
  await React.act(async () => {
    for (const handler of hoverListeners) handler({ time: now / 1000 - 3600, point: { x: 400, y: 200 }, seriesData: new Map([[series, {}]]) })
    for (const [id, fn] of frames) { frames.delete(id); fn() }
  })
  assert.equal(publication.textContent, publicationText, 'Candle hover never changes the selected publication cutoff or comparison')
  assert.equal(workerInputs.length, jobsBeforeHover, 'Hover with publication details open launches no workers')
  assert.equal(counters.scoringRender, rendersBeforeHover, 'Hover performs zero publication scorer renders')
  await React.act(async () => { const view = container.querySelector('[aria-label="Raycaster view"]'); view.value = 'context'; view.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  await pointer(canvasForDrawing, 'pointerdown', 100, 300)
  await pointer(window, 'pointerup', 100, 300)
  await click(button('Activity'))
  const search = container.querySelector('[aria-label="Search symbols"]')
  await React.act(async () => props(search).onChange({ target: { value: 'EUR' } }))
  await click(container.querySelector('.active-market .market-watch-toggle'))
  assert.equal(container.querySelectorAll('.market-watch-row').length, 0, 'Collapsed sidebar retains controls state without creating quote rows')
  await React.act(async () => { for (let i = 0; i < 200; i++) append('Application', `Existing entry ${i}`) })
  assert.equal(container.querySelectorAll('.activity-row').length, 200)

  now += 2000
  reset(); await tick('pollHealth', 2000)
  assert.match(container.querySelector('.data-heartbeat').textContent, /Checking/)
  assertQuiet('Checking with populated Activity and collapsed Market Watch', true)
  clockOffset = 12
  reset(); await reply('health')
  assert.match(container.querySelector('.data-heartbeat').textContent, /Running/)
  assertQuiet('Same connection and small UTC correction', true)
  reset(); await tick('poll', 2500); await reply('watch'); assertQuiet('Identical quote reply')
  reset(); await tick('poll', 2000); await reply('ohlc'); assertQuiet('Identical candles and newer observation timestamp')
  reset(); await React.act(async () => append('Application', 'Regression entry'))
  assert.match(container.querySelector('.activity-panel').textContent, /Regression entry/)
  assertQuiet('Activity append', true); assert.equal(counters.commandSubscriber ?? 0, 0)
  reset(); await React.act(async () => { now += 10_000; for (const timer of intervals.values()) if (timer.ms === 10_000) timer.fn() })
  assert.ok(clocks.includes(now + 12), 'Latest small UTC correction is sampled on the existing clock tick')
  assert.equal(counters.workerPosts ?? 0, 0, 'Clock ticks without a new publication do not rescore history')

  await click(container.querySelector('.active-market .market-watch-toggle'))
  assert.equal(container.querySelector('[aria-label="Search symbols"]').value, 'EUR')
  await React.act(async () => props(container.querySelector('[aria-label="Search symbols"]')).onChange({ target: { value: '' } }))
  reset(); await tick('poll', 2500); await reply('watch'); assertQuiet('Identical quotes with visible Market Watch')
  quotes = quotes.map((quote, i) => i === 0 ? { ...quote, bid: 1.12345 } : quote)
  reset(); await tick('poll', 2500); await reply('watch')
  assert.equal(counters.quoteRows, 1, 'A changed quote renders exactly one retained row')
  assert.match(container.querySelector('.market-watch-row').textContent, /1.12345/)
  assert.equal(counters.workerPosts ?? 0, 0)

  bars = bars.map((bar, i) => i === bars.length - 1 ? { ...bar, close: 1.17 } : bar)
  reset(); await tick('poll', 2000); await reply('ohlc')
  assert.equal(counters.update, 1); assert.equal(counters.setData ?? 0, 0)
  assert.equal(plotted.at(-1).close, 1.17); assert.equal(counters.workerPosts ?? 0, 0)
  // Opening a candle can also correct the previous candle's final close.
  bars = bars.map((bar, i) => i === bars.length - 1 ? { ...bar, close: 1.18 } : bar)
  bars = [...bars, { ...bars.at(-1), time: bars.at(-1).time + 3600, close: 1.19 }]
  reset(); await tick('poll', 2000); await reply('ohlc')
  assert.equal(counters.setData, 1)
  assert.equal(plotted.at(-2).close, 1.18); assert.equal(plotted.at(-1).close, 1.19)
  assert.equal(counters.workerPosts ?? 0, 0)
  // A correction in the older portion of the 800-bar reconciliation is real data.
  bars = bars.map((bar, i) => i === 200 ? { ...bar, high: 1.3 } : bar)
  now += 60_000
  reset(); await tick('poll', 2000); await reply('ohlc')
  assert.equal(counters.setData, 1); assert.equal(plotted[200].high, 1.3)
  assert.equal(counters.workerPosts ?? 0, 0)

  // A pending probe alongside pan notifications remains presentation-only.
  reset(); await tick('pollHealth', 2000)
  await React.act(async () => { for (let i = 0; i < 200; i++) for (const notify of rangeListeners) notify() })
  assert.equal(counters.workerPosts ?? 0, 0)
  await React.act(async () => { for (const [id, fn] of frames) { frames.delete(id); fn() } })
  assert.equal(counters.workerPosts ?? 0, 0)
  await reply('health')
  clockOffset = 5012
  const clockIntervals = [...intervals.keys()]
  reset(); await tick('pollHealth', 2000); await reply('health')
  assert.ok(clocks.includes(now + 5012), 'Large UTC correction applies immediately without restarting clock intervals')
  assert.deepEqual([...intervals.keys()], clockIntervals)
  assert.equal(counters.workerPosts ?? 0, 0)

  failHealth = true
  await tick('pollHealth', 2000); await reply('health')
  assert.match(container.querySelector('.status-message').textContent, /Bridge unreachable/)
  failHealth = false
  await tick('pollHealth', 2000); await reply('health')
  assert.match(container.querySelector('.status-message').textContent, /MT5 broker source/)
  await tick('pollHealth', 2000)
  const timeout = [...timers].find(([, timer]) => timer.ms === 5000)
  assert.ok(timeout); timers.delete(timeout[0])
  await React.act(async () => { now += 5000; timeout[1].fn() })
  assert.ok(pending.get('health').shift().signal.aborted)
  assert.match(container.querySelector('.status-message').textContent, /Bridge unreachable/)
  await tick('pollHealth', 2000); await reply('health')
  broker = 'second-broker'; generation = 2
  await tick('pollHealth', 2000); await reply('health'); await reply('watch')
  while (pending.get('ohlc')?.length) await reply('ohlc')
  assert.ok(requests.some(url => url.includes('source_id=second-broker')), 'Broker/generation changes refresh stored history')
  assert.equal(plotted.length, 800)

  const futureAt = events.at(-1).release_at
  now = futureAt - clockOffset
  const postsBefore = workerInputs.length
  await React.act(async () => { for (const timer of [...intervals.values()]) if (timer.ms === 10_000) timer.fn() })
  assert.ok(workerInputs.length > postsBefore, 'A genuinely newly available publication launches a new calculation')
  assert.ok(workerInputs.some(input => input.asOf === futureAt), 'Publication is admitted at the corrected exact clock')
  assert.equal(counters.chartCreated, undefined, 'Polling never recreates the chart')
  const canvas = container.querySelector('.market-chart-canvas')
  canvas.getBoundingClientRect = () => ({ right: 900 })
  await React.act(async () => props(canvas).onPointerDown({ button: 0, clientX: 100, clientY: 100 }))
  assert.equal([...panListeners.values()].reduce((sum, listeners) => sum + listeners.size, 0), 3)
  await React.act(async () => root.unmount())
  assert.equal([...panListeners.values()].reduce((sum, listeners) => sum + listeners.size, 0), 0)
  // The app's development entry uses StrictMode. Its effect replay must also
  // leave no duplicate poll, clock or chart subscriptions after unmount.
  const strictRoot = createRoot(container)
  try {
    await React.act(async () => strictRoot.render(React.createElement(React.StrictMode, null,
      React.createElement(ActivityLogProvider, null, React.createElement(FyodorTerminalShell)))))
  } finally { await React.act(async () => strictRoot.unmount()) }
  console.log('✓ Production terminal: Checking/Running, identical replies, Activity isolation, hidden/retained quote rows, UTC correction sampling, real prices and interior corrections, pan overlap, timeout/recovery, broker changes, exact publication admission and StrictMode/drag cleanup')
} finally {
  await React.act(async () => root.unmount())
  assert.equal(timers.size, 0); assert.equal(intervals.size, 0); assert.equal(frames.size, 0)
  assert.equal(rangeListeners.size, 0); assert.equal(sizeListeners.size, 0); assert.equal(hoverListeners.size, 0); assert.equal(clickListeners.size, 0)
  assert.equal([...panListeners.values()].reduce((sum, listeners) => sum + listeners.size, 0), 0, 'Unmount during a drag releases global pointer listeners')
  assert.equal(primitives.size, 0, 'Unmount detaches drawing primitives'); assert.equal(captures.size, 0)
  Date.now = originalNow
  await server.close(); await dom.happyDOM.abort(); dom.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
