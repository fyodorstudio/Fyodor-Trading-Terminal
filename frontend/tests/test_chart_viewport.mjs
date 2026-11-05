import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

// Production chart + MT5 paging hook. Only transport and canvas are fixtures.
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node,
  navigator: dom.navigator, getComputedStyle: dom.getComputedStyle.bind(dom), localStorage: dom.localStorage, IS_REACT_ACT_ENVIRONMENT: true }
const keys = [...Object.keys(globals), 'fetch', '__viewportChart']
const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
let id = 0, fitted = 0, autoscaled = 0, range = null, plotted = [], future = []
let futureSets = 0, futureUpdates = 0
const timers = new Map(), listeners = new Set(), requests = []
dom.setTimeout = fn => { timers.set(++id, fn); return id }; dom.clearTimeout = id => timers.delete(id)
const emit = next => { range = next; for (const fn of listeners) fn(next) }
const scale = {
  width: () => 900,
  getVisibleLogicalRange: () => range, setVisibleLogicalRange: next => {
    if (next.from === 0 && next.to === plotted.length + 7) fitted++
    emit(next)
  },
  getVisibleRange: () => null, fitContent: () => { fitted++; emit({ from: 0, to: plotted.length + 2 }) },
  subscribeVisibleLogicalRangeChange: fn => listeners.add(fn), unsubscribeVisibleLogicalRangeChange: fn => listeners.delete(fn),
}
const series = { applyOptions() {}, setData(bars) { plotted = bars; emit(bars.length ? { from: 0, to: bars.length } : null) }, update(bar) { plotted = [...plotted.slice(0, -1), bar] } }
const futureSeries = { setData(rows) { futureSets++; future = rows }, update(row) { futureUpdates++; future = [...future, row] },
  applyOptions() {}, attachPrimitive() {}, detachPrimitive() {}, createPriceLine() {}, removePriceLine() {} }
globalThis.__viewportChart = { addSeries: definition => definition.type === 'line' ? futureSeries : series,
  options: () => ({ leftPriceScale: { visible: false } }), timeScale: () => scale, priceScale: () => ({ width: () => 0, applyOptions: () => autoscaled++ }), applyOptions() {}, remove() {} }
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false },
  ssr: { noExternal: ['lightweight-charts'] }, plugins: [{ name: 'viewport-canvas', enforce: 'pre',
    resolveId(source) { if (source === 'lightweight-charts') return '\0viewport-canvas' },
    load(id) { if (id === '\0viewport-canvas') return `export const CandlestickSeries={type:'candle'}, LineSeries={type:'line'}, ColorType={Solid:'solid'}, CrosshairMode={Normal:0}, TickMarkType={}; export const createChart=()=>globalThis.__viewportChart;` },
  }] })
globalThis.fetch = (url, options = {}) => {
  if (String(url).includes('/market-watch')) return Promise.resolve({ ok: true, json: async () => ({ symbols: [] }) })
  return new Promise(resolve => requests.push({ url: String(url), signal: options.signal, resolve }))
}
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.appendChild(container)
const root = createRoot(container)
const pan = next => React.act(() => {
  container.querySelector('.market-chart-canvas').dispatchEvent(new dom.Event('wheel', { bubbles: true }))
  emit(next)
})
const bars = times => times.map(time => ({ time, open: 1, high: 2, low: .5, close: 1.5 }))
const base = 1700000000
const make = (...hours) => bars(hours.map(h => base + h * 3600))
const pending = () => requests.filter(r => !r.done && !r.signal.aborted)
async function reply(request, rows, hasOlder = false, ok = true) {
  assert.ok(request); request.done = true
  const params = new URL(request.url, 'http://localhost').searchParams
  await React.act(async () => request.resolve({ ok, status: ok ? 200 : 503, json: async () => ({ symbol: params.get('symbol'), timeframe: params.get('timeframe'),
    bars: rows, start_pos: Number(params.get('start_pos')), next_start_pos: Number(params.get('start_pos')) + rows.length, has_older: hasOlder, source_generation: 1 }) }))
}
try {
  const { captureDateWindow, projectDateWindow } = await server.ssrLoadModule('./src/market-data/candlestick-chart/chart-viewport.ts')
  const saved = captureDateWindow({ from: .5, to: 5.5 }, make(0, 1, 5, 6), 3600)
  assert.deepEqual(saved, { from: base, to: base + 9 * 3600 }, 'Outer candle edges and future whitespace retained around session gaps')
  assert.deepEqual(projectDateWindow(saved, make(-1, 0, 1, 5, 6), 3600), { from: 1.5, to: 6.5 })
  assert.equal(captureDateWindow(null, [], 3600), null)
  const { MarketCandlestickChart } = await server.ssrLoadModule('./src/market-data/candlestick-chart/MarketCandlestickChart.tsx')
  const { useMt5MarketData } = await server.ssrLoadModule('./src/market-data/mt5-feed/use-mt5-market-data.ts')
  const { ActivityLogProvider } = await server.ssrLoadModule('./src/system-observability/activity-log/activity-log-store.tsx')
  const { DisplayClockProvider } = await server.ssrLoadModule('./src/appearance/time-display/DisplayClock.tsx')
  const { defaultChartAppearance } = await server.ssrLoadModule('./src/market-data/chart-settings/chart-appearance-preference.ts')
  const appearance = defaultChartAppearance, display = { mode: 'utc', utcOffsetMinutes: 0 }, noop = () => {}
  function Harness({ symbol, timeframe }) {
    const feed = useMt5MarketData(true, 1, symbol, timeframe)
    return React.createElement(MarketCandlestickChart, { bars: feed.bars, fitContentKey: `${symbol}:${timeframe}`, precision: 5, theme: 'light', appearance,
      timeDisplay: display, timeframe, activeDrawingTool: null, drawings: [], selectedDrawingId: null, onSelectDrawing: noop, onCreateDrawing: noop,
      onUpdateDrawingPoint: noop, onUpdatePositionWidth: noop, onExitDrawingMode: noop, onDataApplied: noop,
      hasOlderData: !feed.chartHistoryComplete, isLoadingOlderData: feed.chartHistoryLoading, onRequestOlderData: feed.requestOlderBars })
  }
  const render = (symbol, timeframe = 'H1', broker = 'A') => React.act(async () => root.render(React.createElement(ActivityLogProvider, null,
    React.createElement(DisplayClockProvider, { brokerId: broker, brokerOffsetSeconds: 0, preference: display }, React.createElement(Harness, { symbol, timeframe })))))
  await render('EURUSD'); await reply(pending()[0], make(0, 1, 2, 3, 4, 5))
  assert.equal(fitted, 1)
  const futureEnd = Math.floor(plotted.at(-1).time / 86400) * 86400 + 91 * 86400
  assert.equal(future.length, Math.ceil((futureEnd - plotted.at(-1).time) / 3600) - 1)
  assert.equal(future[0].time, plotted.at(-1).time + 3600)
  assert.ok(future.at(-1).time >= plotted.at(-1).time + 90 * 86400 && future.at(-1).time < futureEnd)
  assert.ok(future.slice(0, -1).every(row => Object.keys(row).length === 1), 'Future slots contain only timestamps before the hidden horizon anchor')
  assert.equal(plotted.length, 6, 'The horizon anchor never enters price candles')
  assert.equal(range.to, plotted.length + 7, 'Initial fit includes real candles and the existing margin, not 90 days')
  const setsBeforePan = futureSets, updatesBeforePan = futureUpdates
  pan({ from: 1.25, to: 7.5 })
  assert.equal(futureSets, setsBeforePan); assert.equal(futureUpdates, updatesBeforePan)
  await render('USDJPY')
  assert.equal(plotted.length, 0, 'Old candles disappear while the symbol loads')
  assert.equal(future.length, 0, 'Old future axis disappears with the old symbol')
  await reply(pending()[0], make(0, 1, 2, 3, 4, 5).map(b => ({ ...b, open: 150, close: 151 })))
  assert.deepEqual(range, { from: 1.25, to: 7.5 }, 'Date window including future blank space survives symbol replacement')
  assert.equal(fitted, 1, 'Changing currency never fits the full dataset')
  assert.equal(autoscaled, 2, 'Each new symbol refits its own price scale')

  // Historical window beyond the new symbol initial page: load serially until covered.
  pan({ from: -4, to: -1 })
  await render('GBPUSD'); await reply(pending()[0], make(0, 1, 2, 3, 4, 5), true)
  let older = pending()[0]
  assert.equal(new URL(older.url, 'http://localhost').searchParams.get('start_pos'), '6')
  await reply(older, make(-2, -1), true)
  assert.equal(pending().length, 1, 'A second page is requested only after the first advances history')
  await reply(pending()[0], make(-5, -4, -3), true)
  assert.deepEqual(captureDateWindow(range, plotted, 3600), { from: base - 4.5 * 3600, to: base - 0.5 * 3600 })
  assert.equal(pending().length, 0, 'Backfill stops as soon as the date window is covered')
  assert.equal(fitted, 1)

  await render('AUDUSD'); await reply(pending()[0], make(0, 1, 2, 3, 4, 5), true)
  await reply(pending()[0], [], true, false)
  assert.equal(pending().length, 0, 'Failed history must not spin automatic requests')
  assert.match(container.textContent, /Older history could not reach/)
  const unavailableWindow = captureDateWindow(range, plotted, 3600)
  await React.act(async () => container.querySelector('button').click())
  await reply(pending()[0], make(-6, -5, -4, -3, -2, -1), false)
  assert.deepEqual(captureDateWindow(range, plotted, 3600), unavailableWindow, 'Retry retains the same dates')
  assert.equal(container.querySelector('[role="status"]'), null)

  await render('NZDUSD'); await reply(pending()[0], make(0, 1, 2, 3, 4, 5), false)
  assert.match(container.textContent, /MT5 history does not cover/)
  assert.equal(pending().length, 0); assert.equal(fitted, 1)

  await render('USDCAD'); await reply(pending()[0], make(0, 1, 2, 3, 4, 5), true)
  const stale = pending()[0]
  await render('USDCHF'); assert.equal(stale.signal.aborted, true)
  await reply(pending()[0], make(-6, -5, -4, -3, -2, -1), false)
  const beforeStale = [...plotted]
  await reply(stale, make(-10, -9, -8), false)
  assert.deepEqual(plotted, beforeStale, 'Obsolete paging replies cannot overwrite a new currency')

  pan({ from: 1, to: 4 })
  const beforeFrame = captureDateWindow(range, plotted, 3600)
  await render('USDCHF', 'M30'); await reply(pending()[0], bars(Array.from({ length: 13 }, (_, i) => base - 6 * 3600 + i * 1800)))
  assert.deepEqual(captureDateWindow(range, plotted, 1800), beforeFrame, 'Timeframe changes preserve both visible date bounds using the old step for capture')
  await render('EURUSD', 'H1', 'B'); await reply(pending()[0], make(0, 1, 2, 3, 4, 5))
  assert.equal(fitted, 2, 'A different broker starts a fresh viewport scope')
  const canvas = container.querySelector('.market-chart-canvas')
  await React.act(async () => canvas.dispatchEvent(new dom.MouseEvent('dblclick', { bubbles: true })))
  assert.equal(fitted, 3, 'Explicit double-click still resets the chart')
  await React.act(async () => root.render(null))
  assert.equal(listeners.size, 0); assert.equal(timers.size, 0)
  // Production data application: retain native live following, but keep future
  // date windows fixed, including when unused projected session slots disappear.
  const { replaceRecentBars } = await server.ssrLoadModule('./src/market-data/mt5-feed/market-snapshots.ts')
  const candlesElement = chartBars => React.createElement(DisplayClockProvider,
    { brokerId: 'B', brokerOffsetSeconds: 0, preference: display }, React.createElement(MarketCandlestickChart,
      { bars: chartBars, fitContentKey: 'EURUSD:H1', precision: 5, theme: 'light', appearance, timeDisplay: display, timeframe: 'H1',
        activeDrawingTool: null, drawings: [], selectedDrawingId: null, onSelectDrawing: noop, onCreateDrawing: noop,
        onUpdateDrawingPoint: noop, onUpdatePositionWidth: noop, onExitDrawingMode: noop, onDataApplied: noop,
        hasOlderData: false, isLoadingOlderData: false, onRequestOlderData: noop }))
  const renderCandles = (chartBars, strict = false) => React.act(async () => root.render(strict ?
    React.createElement(React.StrictMode, null, candlesElement(chartBars)) : candlesElement(chartBars)))
  let liveBars = make(0, 1, 2, 3, 4, 5)
  await renderCandles(liveBars)
  liveBars = liveBars.map(bar => ({ ...bar, close: 1.6 }))
  await renderCandles(liveBars)
  assert.equal(container.querySelector('.chart-viewport-notice'), null, 'The first candle outer edge does not request unavailable earlier history')
  pan({ from: 1.25, to: 7.5 })
  const setsBeforeAdvance = futureSets, updatesBeforeAdvance = futureUpdates
  liveBars = replaceRecentBars(liveBars, [...liveBars.slice(-2), ...make(6)])
  await renderCandles(liveBars)
  assert.deepEqual(range, { from: 1.25, to: 7.5 }, 'A manually navigated view stays pinned when a new candle arrives')
  assert.equal(futureSets, setsBeforeAdvance); assert.equal(futureUpdates, updatesBeforeAdvance, 'New candles reuse the cached day horizon')
  pan({ from: 100.25, to: 110.75 })
  const futureWindow = captureDateWindow(range, liveBars, 3600)
  liveBars = replaceRecentBars(liveBars, [...liveBars.slice(-2), ...make(7)])
  await renderCandles(liveBars)
  assert.deepEqual(range, { from: 100.25, to: 110.75 }, 'A future-space pan does not follow new price candles')
  liveBars = replaceRecentBars(liveBars, [...liveBars.slice(-2), ...make(79)])
  await renderCandles(liveBars)
  assert.deepEqual(captureDateWindow(range, liveBars, 3600), futureWindow, 'Session-gap rebasing preserves the selected future dates')
  assert.equal(futureSets, setsBeforeAdvance + 1, 'A session gap rebases once')
  assert.equal(future[0].time, liveBars.at(-1).time + 3600)
  await React.act(async () => root.render(null))
  assert.equal(listeners.size, 0)
  await renderCandles(liveBars, true)
  assert.deepEqual(range, { from: 0, to: liveBars.length + 7 }, 'StrictMode replay with preloaded candles still fits prices, not the future endpoint')
  assert.equal(listeners.size, 1, 'StrictMode retains one chart subscription')
  await React.act(async () => root.render(null))
  assert.equal(listeners.size, 0)
  const largeHistory = bars(Array.from({ length: 2000 }, (_, i) => base + i * 3600))
  await renderCandles(largeHistory)
  assert.equal(range.to, largeHistory.length + 7, 'Startup stays next to actual candles rather than the hidden future anchor')
  assert.ok(range.from > largeHistory.length - 140, 'Startup shows recent history instead of fitting all 2,000 candles')
  assert.ok(Math.abs((range.to - range.from) - 900 / appearance.barSpacing) < 1e-9, 'Startup respects configured pixel spacing')
  const initialRange = { ...range }
  await React.act(async () => root.render(null))
  await renderCandles(largeHistory, true)
  assert.deepEqual(range, initialRange, 'A fresh mount/StrictMode refresh needs no manual refocus')
  await React.act(async () => root.render(null))
  // EURX follows the same viewport rules as pairs, across asynchronous empty
  // loading states and large D1/intraday differences. The hidden 90-day axis
  // must never become the new visible range.
  const end = base + 2200 * 86400
  const frameSteps = { D1: 86400, H4: 14400, H1: 3600, M30: 1800, M15: 900, M5: 300, M1: 60 }
  const historyFor = step => bars(Array.from({ length: 2000 }, (_, i) => end - (1999 - i) * step))
  await render('EURX', 'D1', 'B'); await reply(pending()[0], historyFor(frameSteps.D1))
  pan({ from: 1887, to: 2007 })
  const indexWindow = captureDateWindow(range, plotted, frameSteps.D1)
  for (const [frame, step] of Object.entries(frameSteps).slice(1)) {
    await render('EURX', frame, 'B')
    assert.equal(plotted.length, 0, 'Old timeframe candles are cleared while the next frame loads')
    await reply(pending()[0], historyFor(step))
    assert.deepEqual(captureDateWindow(range, plotted, step), indexWindow, `EURX ${frame}: keep the complete selected date window`)
  }
  pan({ from: 1700.25, to: 1820.75 })
  const historicalWindow = captureDateWindow(range, plotted, frameSteps.M1)
  await render('EURX', 'H1', 'B'); await reply(pending()[0], historyFor(frameSteps.H1))
  assert.deepEqual(captureDateWindow(range, plotted, frameSteps.H1), historicalWindow, 'A historical index view retains both date bounds')
  pan({ from: 100, to: 220 })
  const backfillWindow = captureDateWindow(range, plotted, frameSteps.H1)
  await render('EURX', 'D1', 'B')
  await reply(pending()[0], historyFor(frameSteps.D1).slice(-6), true)
  assert.deepEqual(captureDateWindow(range, plotted, frameSteps.D1), backfillWindow, 'An initially incomplete timeframe keeps the requested dates')
  await reply(pending()[0], historyFor(frameSteps.D1).slice(-206, -6), false)
  assert.deepEqual(captureDateWindow(range, plotted, frameSteps.D1), backfillWindow, 'Older pages retain both selected date bounds')
  assert.equal(pending().length, 0, 'Timeframe backfill stops when the resized date window is covered')
  await React.act(async () => root.render(null))
  console.log('✓ Shared dates, zoom and future space; serial MT5 backfill, stop/retry, missing history, stale replies, timeframe/broker scope and cleanup')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
