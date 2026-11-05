import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

// Real installed chart and production chart component; no-op canvas painting.
// These are terminal contract tests, with no visual or browser inspection.
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node,
  navigator: dom.navigator, location: dom.location, ResizeObserver: dom.ResizeObserver,
  getComputedStyle: dom.getComputedStyle.bind(dom), IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map([...Object.keys(globals), '__rsiChartLibrary'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const frames = new Map(), contexts = new WeakMap(), paintedText = [], paintedFills = [], volumeLayers = []; let frameId = 0, captureVolumeLayers = false
dom.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId }
dom.cancelAnimationFrame = id => frames.delete(id)
dom.HTMLCanvasElement.prototype.getContext = function () {
  if (!contexts.has(this)) contexts.set(this, new Proxy({ canvas: this,
    fillText: text => paintedText.push(String(text)),
    stroke() { if (captureVolumeLayers) volumeLayers.push({ kind: 'line', color: this.strokeStyle }) },
    fillRect(x, y, width, height) { if (captureVolumeLayers) volumeLayers.push({ kind: 'bar', color: this.fillStyle }); paintedFills.push({ x, y, width, height, color: this.fillStyle, alpha: this.globalAlpha }) },
    measureText: text => ({ width: String(text).length * 7, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 3 }),
  }, { get: (target, key) => target[key] ?? (() => {}), set: (target, key, value) => { target[key] = value; return true } }))
  return contexts.get(this)
}
for (const [key, value] of Object.entries({ '--chart-grid': '#eeeeee', '--chart-background': '#ffffff', '--text-muted': '#555555',
  '--text-strong': '#222222', '--chart-crosshair': '#888888', '--chart-label': '#555555', '--chart-axis': '#cccccc', '--border-strong': '#cccccc' }))
  document.documentElement.style.setProperty(key, value)
const library = await import('../node_modules/lightweight-charts/dist/lightweight-charts.development.mjs')
let chart, creates = 0
globalThis.__rsiChartLibrary = { ...library, createChart: (element, options) => {
  creates++
  chart = library.createChart(element, { ...options, autoSize: false, width: 900, height: 480,
    layout: { ...options.layout, colorParsers: [color => /^#[\da-f]{6}$/i.test(color) ? [1,3,5].map(i => parseInt(color.slice(i, i + 2), 16)).concat(1) : null] } })
  return chart
} }
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  ssr: { noExternal: ['lightweight-charts'] },
  server: { middlewareMode: true, hmr: false }, plugins: [{ name: 'real-rsi-chart', enforce: 'pre',
    resolveId(source) { if (source === 'lightweight-charts') return '\0rsi-chart-library' },
    load(id) { if (id === '\0rsi-chart-library') return 'export const { CandlestickSeries, HistogramSeries, LineSeries, LineStyle, LineType, ColorType, CrosshairMode, TickMarkType, createChart } = globalThis.__rsiChartLibrary' },
  }] })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'), dialogHost = document.createElement('div'); document.body.append(host, dialogHost)
const root = createRoot(host), dialogRoot = createRoot(dialogHost)
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} vs ${expected}`)
async function paint(inspect) {
  await React.act(async () => {
    for (let pass = 0; frames.size && pass < 20; pass++) {
      const pending = [...frames]; frames.clear(); for (const [, fn] of pending) fn(performance.now())
      inspect?.()
    }
  })
  assert.equal(frames.size, 0, 'The pane, label and price overlays settle without a redraw loop')
}
const reactProps = element => element[Object.getOwnPropertyNames(element).find(key => key.startsWith('__reactProps$'))]
try {
  const { MarketCandlestickChart } = await server.ssrLoadModule('./src/market-data/candlestick-chart/MarketCandlestickChart.tsx')
  const { defaultChartAppearance } = await server.ssrLoadModule('./src/market-data/chart-settings/chart-appearance-preference.ts')
  const { defaultRsiPreferences } = await server.ssrLoadModule('./src/market-data/indicators/rsi/rsi-preferences.ts')
  const { defaultVolumePreferences } = await server.ssrLoadModule('./src/market-data/indicators/volume/volume-preferences.ts')
  const { RsiSettingsDialog } = await server.ssrLoadModule('./src/market-data/indicators/rsi/RsiSettingsDialog.tsx')
  const { replaceRecentBars } = await server.ssrLoadModule('./src/market-data/mt5-feed/market-snapshots.ts')
  const makeBars = (start, step = 3600) => Array.from({ length: 100 }, (_, i) => ({ time: start + i * step,
    open: 100, high: 106, low: 94, close: 100 + Math.sin(i / 3) * 4 }))
  let bars = makeBars(1700000000), rsi = defaultRsiPreferences
  const traces = []
  let props = { bars, rsi, fitContentKey: 'EURUSD:H1', symbol: 'EURUSD', precision: 5, theme: 'light', appearance: defaultChartAppearance,
    onChartTrace: trace => traces.push(JSON.parse(trace)),
    timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 }, timeframe: 'H1', activeDrawingTool: null, drawings: [], selectedDrawingId: null,
    onSelectDrawing() {}, onCreateDrawing() { return '' }, onUpdateDrawingPoint() {}, onUpdatePositionWidth() {},
    onExitDrawingMode() {}, onDataApplied() {}, hasOlderData: false, isLoadingOlderData: false, onRequestOlderData() {} }
  const render = async (next = {}) => { props = { ...props, ...next }; await React.act(async () => root.render(React.createElement(MarketCandlestickChart, props))); await paint() }
  await render()
  assert.equal(traces.length, 1, 'A scope change captures one post-paint trace')
  assert.ok(traces[0].samples.every(sample => sample.index === sample.logical && JSON.stringify(sample.ohlc) === JSON.stringify(sample.native)), 'The trace compares raw candles with native timeline samples')
  assert.equal(chart.panes().length, 1)
  chart.timeScale().setVisibleLogicalRange({ from: 65, to: 110 }); await paint()
  const viewport = chart.timeScale().getVisibleLogicalRange()
  const candles = chart.panes()[0].getSeries()[0]
  const priceSnapshot = candles.data()
  rsi = { ...rsi, enabled: true }; await render({ rsi })
  assert.equal(creates, 1, 'Enabling RSI keeps the price chart instance')
  assert.equal(chart.panes().length, 2)
  assert.deepEqual(chart.timeScale().getVisibleLogicalRange(), viewport, 'Enabling RSI preserves shared dates and future space')
  assert.deepEqual(candles.data(), priceSnapshot)
  chart.applyOptions({ autoSize: false })
  chart.priceScale('right').setVisibleRange({ from: 90, to: 110 }); await paint()
  const resizePriceRange = chart.priceScale('right').getVisibleRange()
  for (const width of [650, 1100, 900, 650, 900]) {
    chart.resize(width, 480); await paint()
    const resizedWindow = chart.timeScale().getVisibleLogicalRange()
    close(resizedWindow.from, viewport.from, 'Market Watch-sized resizes retain the left viewport date')
    close(resizedWindow.to, viewport.to, 'Market Watch-sized resizes retain the right viewport date')
    assert.deepEqual(chart.priceScale('right').getVisibleRange(), resizePriceRange, 'Resizing preserves the manual price range')
  }
  chart.priceScale('right').applyOptions({ autoScale: true }); await paint()
  const [line, average] = chart.panes()[1].getSeries()
  assert.equal(line.data().length, 86); assert.equal(average.data().length, 73)
  assert.equal(line.dataByIndex(13), null); assert.ok('value' in line.dataByIndex(14))
  assert.equal(average.dataByIndex(26), null); assert.ok('value' in average.dataByIndex(27))
  assert.equal(line.options().color, '#7e57c2')
  assert.ok(line.priceToCoordinate(0) > line.priceToCoordinate(100), 'RSI has an independent 0–100 scale')
  const indicatorSnapshot = line.data()
  paintedFills.length = 0
  chart.timeScale().setVisibleLogicalRange({ from: 115, to: 160 }); await paint()
  assert.equal(line.priceToCoordinate(70), null, 'The native RSI API has no coordinate reference after every sample leaves view')
  assert.ok(paintedFills.some(fill => fill.color === rsi.fillColor && fill.alpha === rsi.fillOpacity / 100 && fill.width > 0 && fill.height > 0),
    'RSI background continues painting with all candles and RSI samples offscreen')
  const scaleReference = chart.panes()[1].getSeries()[2]
  assert.equal(scaleReference.options().lineVisible, false, 'The scale reference never paints a future RSI line')
  assert.equal(scaleReference.data()[0].time, chart.panes()[0].getSeries()[1].data().at(-1).time,
    'The RSI scale reference reuses the existing future horizon without extending the shared timeline')
  chart.panes()[1].priceScale('right').setVisibleRange({ from: -20, to: 120 })
  paintedFills.length = 0
  chart.panes()[1].setHeight(150); await paint()
  const futureFill = paintedFills.find(fill => fill.color === rsi.fillColor && fill.alpha === rsi.fillOpacity / 100)
  close(futureFill.y, scaleReference.priceToCoordinate(70), 'Future fill follows RSI scaling and pane resizing')
  close(futureFill.height, scaleReference.priceToCoordinate(30) - scaleReference.priceToCoordinate(70),
    'Future fill remains between the configured RSI bands')
  assert.deepEqual(scaleReference.priceLines().map(band => band.options().price), [70, 50, 30],
    'Guide bands share the persistent coordinate reference')
  assert.deepEqual(line.data(), indicatorSnapshot, 'Empty-space background rendering never adds future RSI samples')
  chart.panes()[1].priceScale('right').applyOptions({ autoScale: true })
  chart.timeScale().setVisibleLogicalRange(viewport); await paint()
  chart.panes()[1].setHeight(130); await paint()
  close(parseFloat(host.querySelector('.chart-price-pane-overlays').style.height), chart.paneSize(0).height,
    'Divider resizing clips every price overlay at the actual price pane boundary')
  const canvasHost = host.querySelector('.market-chart-canvas')
  canvasHost.getBoundingClientRect = () => ({ left: 0, top: 0, right: 900, bottom: 480, width: 900, height: 480 })
  const priceRange = chart.priceScale('right').getVisibleRange()
  await React.act(async () => {
    canvasHost.dispatchEvent(new dom.PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: chart.paneSize(0).height + 20 }))
    dom.dispatchEvent(new dom.PointerEvent('pointermove', { clientX: 110, clientY: 460 }))
    dom.dispatchEvent(new dom.PointerEvent('pointerup'))
    canvasHost.dispatchEvent(new dom.MouseEvent('dblclick', { bubbles: true, clientX: 100, clientY: 460 }))
  })
  await paint()
  assert.deepEqual(chart.priceScale('right').getVisibleRange(), priceRange, 'RSI pointer gestures never move/reset the candle price scale')
  assert.deepEqual(chart.timeScale().getVisibleLogicalRange(), viewport, 'RSI double-click never resets the shared date window')
  const paneCanvas = chart.panes()[1].getHTMLElement().querySelector('canvas:last-of-type')
  paneCanvas.getBoundingClientRect = () => ({ left: 0, top: 0 })
  const hoverAt = async time => {
    const x = chart.timeScale().timeToCoordinate(time)
    for (const type of ['mouseenter', 'mousemove']) paneCanvas.dispatchEvent(new dom.MouseEvent(type, { clientX: x, clientY: 60, view: dom }))
    await paint()
  }
  await hoverAt(bars[85].time)
  assert.equal(host.querySelector('.rsi-legend span:nth-child(2)').textContent, line.dataByIndex(85).value.toFixed(2), 'Native RSI hover shows the selected candle value')
  await hoverAt(bars.at(-1).time + 5 * 3600)
  assert.equal(host.querySelector('.rsi-legend span:nth-child(2)').textContent, '—', 'Empty future space never fabricates RSI values')
  const tracesBeforeTick = traces.length
  bars = replaceRecentBars(bars, [{ ...bars.at(-1), close: 105 }]); await render({ bars })
  assert.equal(traces.length, tracesBeforeTick, 'Live ticks never create diagnostic history scans or repeated trace entries')
  assert.equal(line.data().length, 86)
  bars = [ { ...bars[0], time: bars[0].time - 3600 }, ...bars ]; await render({ bars })
  assert.equal(line.data().length, 87, 'Paging reseeds and replaces the indicator history')
  const beforeSwitch = chart.timeScale().getVisibleLogicalRange()
  bars = makeBars(1700000000, 14400)
  await render({ bars, timeframe: 'H4', fitContentKey: 'GBPUSD:H4', symbol: 'GBPUSD' })
  assert.deepEqual(line.data().map(row => row.time), bars.slice(14).map(row => row.time), 'No RSI timestamps from the previous symbol/timeframe survive')
  assert.equal(chart.panes().length, 2); assert.equal(creates, 1)
  assert.ok(beforeSwitch)
  const resized = chart.panes()[1].getHeight()
  rsi = { ...rsi, lineColor: '#ff0000', averageVisible: false, smoothing: 'None', fillVisible: false }
  await render({ rsi })
  assert.equal(line.options().color, '#ff0000'); assert.equal(average.options().lineVisible, false)
  assert.equal(chart.panes()[1].getHeight(), resized, 'Style/input edits preserve the resized pane')
  await render({ bars: [] })
  assert.equal(line.data().length, 0); assert.equal(average.data().length, 0)
  assert.match(host.querySelector('.rsi-legend').textContent, /Waiting for 14 price changes/)
  await render({ rsi: { ...rsi, enabled: false } })
  assert.equal(chart.panes().length, 1); assert.equal(host.querySelector('.rsi-legend'), null)
  assert.equal(host.querySelector('.chart-price-pane-overlays').style.height, '')

  bars = makeBars(1700000000, 14400)
  const futureDrawing = { id: 'future-price', symbol: 'GBPUSD', timeframe: 'H4', tool: 'horizontal-line',
    createdAt: 1, points: [{ time: bars.at(-1).time + 20 * 14400, price: 100 }] }
  await render({ bars, drawings: [futureDrawing], selectedDrawingId: futureDrawing.id })
  chart.timeScale().setVisibleLogicalRange({ from: 65, to: 110 }); await paint()
  const usefulRange = chart.priceScale('right').getVisibleRange()
  paintedText.length = 0
  chart.timeScale().setVisibleLogicalRange({ from: 115, to: 160 }); await paint()
  assert.equal(candles.priceToCoordinate(100), null, 'The installed candle API reproduces its empty-future coordinate limitation')
  assert.deepEqual(chart.priceScale('right').getVisibleRange(), usefulRange, 'Empty future space retains the last useful price range')
  assert.ok(paintedText.some(text => /^\d+\.\d+$/.test(text) && Number(text) > 90 && Number(text) < 110), 'The native Y axis continues painting actual price labels in empty future space')
  const futureHandle = host.querySelector('.drawing-resize-handle')
  assert.ok(futureHandle, 'Saved drawings remain projected and editable with every candle off screen')
  assert.ok(Number.isFinite(Number(futureHandle.getAttribute('cy'))))
  const futurePrice = chart.panes()[0].getSeries()[1]
  close(Number(futureHandle.getAttribute('cy')), futurePrice.priceToCoordinate(100), 'Drawing prices use the same native Y scale as its labels')
  chart.priceScale('right').setVisibleRange({ from: 90, to: 110 }); await paint()
  close(Number(host.querySelector('.drawing-resize-handle').getAttribute('cy')), futurePrice.priceToCoordinate(100), 'Manual price-scale edits still update future-space drawings')
  let createdPoint
  await render({ activeDrawingTool: 'horizontal-line', onCreateDrawing: (_tool, points) => { createdPoint = points[0]; return 'new-future' } })
  await React.act(async () => host.querySelector('.chart-drawing-overlay').dispatchEvent(new dom.PointerEvent('pointerdown', {
    bubbles: true, button: 0, clientX: 100, clientY: futurePrice.priceToCoordinate(102), pointerId: 1,
  })))
  assert.ok(createdPoint.time > bars.at(-1).time, 'A drawing can be created at an actual future timestamp')
  close(createdPoint.price, 102, 'Empty-space drawing input retains the native price-coordinate round trip')
  await render({ activeDrawingTool: null })
  const panWindow = chart.timeScale().getVisibleLogicalRange(), candlesBeforeFocus = candles.data()
  await render({ refocusRequest: 1 })
  const focusedWindow = chart.timeScale().getVisibleLogicalRange()
  close(focusedWindow.to - focusedWindow.from, panWindow.to - panWindow.from, 'Refocus retains horizontal zoom')
  close(focusedWindow.to, bars.length - 1 + 8, 'Refocus returns to the last actual candle with a small right margin')
  assert.equal(chart.priceScale('right').options().autoScale, true, 'Refocus restores automatic price scaling')
  assert.deepEqual(candles.data(), candlesBeforeFocus, 'Refocus never adds or replaces candles')
  assert.equal(creates, 1, 'Refocus keeps the chart and saved drawing lifecycle')
  assert.equal(futureDrawing.points[0].price, 100)
  chart.timeScale().setVisibleLogicalRange({ from: 115, to: 160 }); await paint()
  const yenBars = bars.map(bar => ({ ...bar, open: bar.open * 1.5, high: bar.high * 1.5, low: bar.low * 1.5, close: bar.close * 1.5 }))
  await render({ bars: yenBars, fitContentKey: 'USDJPY:H4', symbol: 'USDJPY', precision: 3, drawings: [], selectedDrawingId: null })
  const yenRange = chart.priceScale('right').getVisibleRange()
  assert.ok(yenRange.from >= 140 && yenRange.to <= 160, 'A symbol loaded directly in empty future space seeds its own price units')
  assert.equal(chart.panes()[0].getSeries()[1].options().priceFormat.precision, 3, 'The future price axis uses the selected symbol precision')
  paintedFills.length = 0
  await render({ rsi: { ...defaultRsiPreferences, enabled: true } })
  assert.ok(paintedFills.some(fill => fill.color === defaultRsiPreferences.fillColor && fill.alpha === 0.1 && fill.height > 0),
    'Enabling RSI directly in empty future space also paints its background')
  paintedFills.length = 0
  await render({ rsi: { ...defaultRsiPreferences, enabled: true, fillVisible: false } })
  assert.ok(!paintedFills.some(fill => fill.color === defaultRsiPreferences.fillColor && fill.alpha === 0.1),
    'The background visibility preference still works in empty future space')

  let saved = null, closed = 0
  const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus()
  const onClose = () => { closed++ }
  const openDialog = async () => React.act(async () => dialogRoot.render(React.createElement(RsiSettingsDialog, { preferences: { ...defaultRsiPreferences, enabled: true }, onSave: next => { saved = next }, onClose })))
  await openDialog()
  const select = dialogHost.querySelector('select')
  await React.act(async () => { select.value = 'HLC3'; select.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  await React.act(async () => dialogHost.querySelector('form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(saved.source, 'HLC3'); assert.equal(saved.enabled, true); assert.equal(closed, 1)
  await React.act(async () => dialogRoot.render(null)); assert.equal(document.activeElement, trigger)
  saved = null; await openDialog()
  await React.act(async () => reactProps(dialogHost.querySelector('[aria-label="RSI length"]')).onChange({ target: { value: '0' } }))
  await React.act(async () => dialogHost.querySelector('form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(saved, null); assert.match(dialogHost.querySelector('[role="alert"]').textContent, /Lengths/)
  await React.act(async () => [...dialogHost.querySelectorAll('button')].find(button => button.textContent === 'Reset defaults').click())
  assert.equal(dialogHost.querySelector('[aria-label="RSI length"]').value, '14')
  await React.act(async () => [...dialogHost.querySelectorAll('button')].find(button => button.textContent === 'Cancel').click())
  assert.equal(saved, null, 'Cancel never commits the draft')
  await React.act(async () => dialogRoot.render(null))

  await React.act(async () => root.render(null)); await paint()
  props = { ...props, bars, rsi: { ...defaultRsiPreferences, enabled: true } }
  await React.act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(MarketCandlestickChart, props))))
  await paint()
  assert.equal(chart.panes().length, 2); assert.equal(host.querySelectorAll('.rsi-legend').length, 1, 'StrictMode retains one live RSI pane')
  await React.act(async () => root.render(null)); await paint()
  const viewportBars = Array.from({ length: 2000 }, (_, i) => ({ ...bars[0], time: 1700000000 + i * 3600 }))
  props = { ...props, bars: viewportBars, timeframe: 'H1', fitContentKey: 'EURUSD:H1', symbol: 'EURUSD',
    rsi: { ...defaultRsiPreferences, enabled: true }, drawings: [], selectedDrawingId: null, refocusRequest: 0 }
  await React.act(async () => root.render(React.createElement(MarketCandlestickChart, props)))
  // Quotes/clock/parent updates can arrive before the native chart paints its
  // queued range. A synchronous canvas fixture cannot reproduce this race.
  props = { ...props, precision: 4 }
  await React.act(async () => root.render(React.createElement(MarketCandlestickChart, props)))
  await paint()
  let actualWindow = chart.timeScale().getVisibleLogicalRange()
  assert.ok(actualWindow.from < 1999 && actualWindow.to >= 1999, `Fresh load must contain actual candles after deferred native updates: ${JSON.stringify(actualWindow)}`)
  assert.ok(actualWindow.to - actualWindow.from < 150, 'Fresh load preserves useful candle spacing')
  const { captureDateWindow, projectDateWindow } = await server.ssrLoadModule('./src/market-data/candlestick-chart/chart-viewport.ts')
  const { drawingCoordinates } = await server.ssrLoadModule('./src/market-data/chart-drawings/drawing-coordinates.ts')
  const pairWindow = captureDateWindow(actualWindow, viewportBars, 3600)
  const pairBars = viewportBars.slice(-1500)
  props = { ...props, bars: [], symbol: 'USDJPY', fitContentKey: 'USDJPY:H1' }
  await React.act(async () => root.render(React.createElement(MarketCandlestickChart, props)))
  props = { ...props, bars: pairBars }
  await React.act(async () => root.render(React.createElement(MarketCandlestickChart, props)))
  props = { ...props, precision: 3 }
  await React.act(async () => root.render(React.createElement(MarketCandlestickChart, props)))
  await paint()
  actualWindow = chart.timeScale().getVisibleLogicalRange()
  assert.ok(actualWindow.from < pairBars.length - 1 && actualWindow.to >= pairBars.length - 1, 'A pair switch keeps actual candles visible through deferred updates')
  const pairDates = captureDateWindow(actualWindow, pairBars, 3600)
  close(pairDates.from, pairWindow.from, 'Pair switches preserve the selected start time')
  close(pairDates.to, pairWindow.to, 'Pair switches preserve the selected end time')
  const framesToTest = [['M1', 60], ['M5', 300], ['M15', 900], ['M30', 1800], ['H1', 3600], ['H4', 14400], ['D1', 86400]]
  const endTime = viewportBars.at(-1).time
  const frameBars = step => viewportBars.map((bar, index) => ({ ...bar, time: endTime - (1999 - index) * step }))
  const changeFrame = async (frame, nextBars, settle = true) => {
    props = { ...props, bars: [], symbol: 'EURX', timeframe: frame, fitContentKey: `EURX:${frame}` }
    await React.act(async () => root.render(React.createElement(MarketCandlestickChart, props)))
    props = { ...props, bars: nextBars }
    await React.act(async () => root.render(React.createElement(MarketCandlestickChart, props)))
    props = { ...props, precision: props.precision === 3 ? 4 : 3 }
    await React.act(async () => root.render(React.createElement(MarketCandlestickChart, props)))
    if (settle) await paint()
  }
  // Test both directions with date spans that the native chart can display at
  // either timeframe, including historical pans and deliberate future space.
  for (let i = 0; i < framesToTest.length - 1; i++) {
    const [lower, lowStep] = framesToTest[i], [higher, highStep] = framesToTest[i + 1]
    const lowBars = frameBars(lowStep), highBars = frameBars(highStep)
    for (const future of [false, true]) {
      await changeFrame(lower, lowBars)
      const dates = future ? { from: endTime + 8 * highStep, to: endTime + 16 * highStep }
        : { from: endTime - 16 * highStep, to: endTime - 8 * highStep }
      await React.act(async () => {
        host.querySelector('.market-chart-canvas').dispatchEvent(new dom.Event('wheel', { bubbles: true }))
        chart.timeScale().setVisibleLogicalRange(projectDateWindow(dates, lowBars, lowStep))
      })
      await paint()
      await changeFrame(higher, highBars)
      let visibleDates = captureDateWindow(chart.timeScale().getVisibleLogicalRange(), highBars, highStep)
      close(visibleDates.from, dates.from, `${lower}→${higher}, future=${future}: retain start time`)
      close(visibleDates.to, dates.to, `${lower}→${higher}, future=${future}: retain end time`)
      await changeFrame(lower, lowBars)
      visibleDates = captureDateWindow(chart.timeScale().getVisibleLogicalRange(), lowBars, lowStep)
      close(visibleDates.from, dates.from, `${higher}→${lower}, future=${future}: retain start time on return`)
      close(visibleDates.to, dates.to, `${higher}→${lower}, future=${future}: retain end time on return`)
    }
  }
  // A single narrow M1 view must survive the entire chain, including native
  // zoom limits on H4/D1. Do not reset the window between timeframe changes.
  for (const [rsiEnabled, volumeEnabled] of [[false, false], [true, false], [false, true], [true, true]]) {
    await React.act(async () => root.render(null)); await paint()
    props = { ...props, bars: frameBars(60), timeframe: 'M1', fitContentKey: 'EURX:M1',
      rsi: { ...defaultRsiPreferences, enabled: rsiEnabled }, volume: { ...defaultVolumePreferences, enabled: volumeEnabled } }
    await render()
    const dates = captureDateWindow(chart.timeScale().getVisibleLogicalRange(), props.bars, 60)
    const assertDates = (step, label) => {
      const actual = captureDateWindow(chart.timeScale().getVisibleLogicalRange(), props.bars, step)
      close(actual.from, dates.from, `${label}: left edge`)
      close(actual.to, Math.max(dates.to, dates.from + 2 * step), `${label}: right edge (native minimum zoom)`)
      const nativeCoordinates = drawingCoordinates(chart, chart.panes()[0].getSeries()[0], props.bars, props.timeframe)
      assert.ok(Math.abs(nativeCoordinates.timeToX(dates.from) + 1) < 1e-3, `${label}: the saved date stays at the plot's left border`)
    }
    for (const [frame, step] of [...framesToTest.slice(1), ...framesToTest.slice(0, -1).reverse()]) {
      await changeFrame(frame, frameBars(step), false)
      await paint(() => assertDates(step, `M1 round trip ${frame}, RSI=${rsiEnabled}, Volume=${volumeEnabled}, every frame`))
    }
    // Multiple scopes arrive before the chart can commit a native frame.
    for (const [frame, step] of framesToTest.slice(1)) await changeFrame(frame, frameBars(step), false)
    await paint(() => assertDates(86400, `Rapid M1→D1, RSI=${rsiEnabled}, Volume=${volumeEnabled}, every frame`))
    await changeFrame('M1', frameBars(60), false)
    await paint(() => assertDates(60, `Rapid return to M1, RSI=${rsiEnabled}, Volume=${volumeEnabled}, every frame`))
    await changeFrame('D1', frameBars(86400))
    await React.act(async () => {
      host.querySelector('.market-chart-canvas').dispatchEvent(new dom.Event('wheel', { bubbles: true }))
      chart.timeScale().setVisibleLogicalRange({ from: 1995, to: 2005 })
    })
    await paint()
    const manualDates = captureDateWindow(chart.timeScale().getVisibleLogicalRange(), props.bars, 86400)
    await changeFrame('M1', frameBars(60))
    const afterManual = captureDateWindow(chart.timeScale().getVisibleLogicalRange(), props.bars, 60)
    close(afterManual.from, manualDates.from, 'A new user pan replaces the saved left date')
    close(afterManual.to, manualDates.to, 'A new user zoom replaces the saved right date')
    // The opposite extreme must also survive: a broad D1 viewport reprojected
    // to M1 exceeds the default minimum pixel spacing. Keep the same dates even
    // while earlier history is unavailable, and recover them on return to D1.
    await React.act(async () => root.render(null)); await paint()
    props = { ...props, bars: frameBars(86400), timeframe: 'D1', fitContentKey: 'EURX:D1' }
    await render()
    const broadDates = captureDateWindow(chart.timeScale().getVisibleLogicalRange(), props.bars, 86400)
    for (const [frame, step] of [...framesToTest.slice(0, -1).reverse(), ...framesToTest.slice(1)]) {
      await changeFrame(frame, frameBars(step), false)
      await paint(() => {
        const actual = captureDateWindow(chart.timeScale().getVisibleLogicalRange(), props.bars, step)
        close(actual.from, broadDates.from, `D1 round trip ${frame}: left edge`)
        close(actual.to, broadDates.to, `D1 round trip ${frame}: right edge`)
      })
    }
  }
  // Manual navigation pins both dates even when a higher-timeframe view still
  // contains the newest candle. New data must not silently resume following.
  await React.act(async () => root.render(null)); await paint()
  props = { ...props, bars: frameBars(60), timeframe: 'M1', fitContentKey: 'EURX:M1' }
  await render()
  const liveDates = { from: endTime - 26 * 3600, to: endTime + 480 }
  await React.act(async () => {
    host.querySelector('.market-chart-canvas').dispatchEvent(new dom.Event('wheel', { bubbles: true }))
    // Admit this dense manual fixture with either one or two visible axes,
    // just as production restoration lowers the native spacing floor.
    chart.applyOptions({ timeScale: { minBarSpacing: 0.1 } })
    chart.timeScale().setVisibleLogicalRange(projectDateWindow(liveDates, props.bars, 60))
  })
  await paint()
  close(captureDateWindow(chart.timeScale().getVisibleLogicalRange(), props.bars, 60).from, liveDates.from, 'Live-follow fixture starts at its requested date with the separate axis')
  await changeFrame('D1', frameBars(86400))
  const currentDay = props.bars.at(-1)
  await render({ bars: replaceRecentBars(props.bars, [...props.bars.slice(-2), { ...currentDay, time: currentDay.time + 86400 }]) })
  await changeFrame('M1', frameBars(60).map(bar => ({ ...bar, time: bar.time + 86400 })))
  const followedDates = captureDateWindow(chart.timeScale().getVisibleLogicalRange(), props.bars, 60)
  close(followedDates.from, liveDates.from, 'A new candle cannot move the saved left date after manual navigation')
  close(followedDates.to, liveDates.to, 'A new candle cannot move the saved right date after manual navigation')
  await render({ refocusRequest: (props.refocusRequest ?? 0) + 1 })
  const beforeAppend = chart.timeScale().getVisibleLogicalRange(), lastFocused = props.bars.at(-1)
  await render({ bars: replaceRecentBars(props.bars, [...props.bars.slice(-2), { ...lastFocused, time: lastFocused.time + 60 }]) })
  close(chart.timeScale().getVisibleLogicalRange().from, beforeAppend.from + 1, 'Refocus explicitly resumes live following')
  close(chart.timeScale().getVisibleLogicalRange().to, beforeAppend.to + 1, 'Resumed live following keeps the chosen zoom')
  const beforeSpacing = chart.timeScale().getVisibleLogicalRange()
  const requestedSpacing = 11
  const spacingDates = captureDateWindow({ from: beforeSpacing.to - chart.timeScale().width() / requestedSpacing + 1, to: beforeSpacing.to }, props.bars, 60)
  props = { ...props, appearance: { ...props.appearance, barSpacing: requestedSpacing } }
  await React.act(async () => root.render(React.createElement(MarketCandlestickChart, props)))
  await changeFrame('M15', frameBars(900).map(bar => ({ ...bar, time: bar.time + 86400 })))
  const afterSpacing = captureDateWindow(chart.timeScale().getVisibleLogicalRange(), props.bars, 900)
  close(afterSpacing.from, spacingDates.from, 'Explicit spacing replaces the saved left date before native paint')
  close(afterSpacing.to, spacingDates.to, 'Explicit spacing replaces the saved zoom before native paint')
  props = { ...props, appearance: defaultChartAppearance }
  for (const enabled of [false, true]) for (const strict of [false, true]) {
    await React.act(async () => root.render(null)); await paint()
    props = { ...props, bars: [], timeframe: 'H1', fitContentKey: 'EURUSD:H1', symbol: 'EURUSD', rsi: { ...defaultRsiPreferences, enabled } }
    const element = () => strict ? React.createElement(React.StrictMode, null, React.createElement(MarketCandlestickChart, props)) : React.createElement(MarketCandlestickChart, props)
    await React.act(async () => root.render(element()))
    props = { ...props, bars: viewportBars }
    await React.act(async () => root.render(element()))
    props = { ...props, timeDisplay: { ...props.timeDisplay }, precision: 5 }
    await React.act(async () => root.render(element()))
    await paint()
    actualWindow = chart.timeScale().getVisibleLogicalRange()
    assert.ok(actualWindow.from < 1999 && actualWindow.to >= 1999, `Refresh RSI=${enabled}, StrictMode=${strict}: actual candles are visible`)
    assert.ok(actualWindow.to - actualWindow.from < 150, 'Refresh keeps configured candle spacing')
    const nativeCandles = chart.panes()[0].getSeries()[0]
    assert.equal(nativeCandles.data().length, viewportBars.length)
    const candleY = nativeCandles.priceToCoordinate(viewportBars.at(-1).close)
    assert.ok(candleY !== null && candleY >= 0 && candleY <= chart.paneSize(0).height, 'The latest actual candle also has a visible native price coordinate')
  }
  const { VolumeSettingsDialog } = await server.ssrLoadModule('./src/market-data/indicators/volume/VolumeSettingsDialog.tsx')
  await React.act(async () => root.render(null)); await paint()
  bars = viewportBars.map((bar, i) => ({ ...bar, tickVolume: 100 + i % 24, high: 105 + i / 1000 }))
  let volume = { ...defaultVolumePreferences, enabled: true }
  props = { ...props, bars, volume, rsi: { ...defaultRsiPreferences, enabled: true }, activeDrawingTool: null,
    timeframe: 'H1', fitContentKey: 'EURUSD:H1', onChangeVolumeMode: mode => { volume = { ...volume, mode }; props = { ...props, volume } },
    onChangeVolumeAxis: axisTarget => { volume = { ...volume, axisTarget }; props = { ...props, volume } } }
  await render()
  assert.equal(chart.panes().length, 3)
  const volumePane = chart.panes()[1], volumeSeries = volumePane.getSeries()[0]
  assert.equal(volumeSeries.seriesType(), 'Histogram', 'Volume is always above RSI')
  assert.equal(chart.panes()[2].getSeries()[0].seriesType(), 'Line')
  assert.equal(volumeSeries.data().length, bars.length)
  assert.equal(volumeSeries.data().at(-1).value, bars.at(-1).tickVolume)
  const relativeLine = volumePane.getSeries()[2]
  assert.equal(chart.options().hoveredSeriesOnTop, false, 'Hover cannot promote the histogram above the Relative line')
  assert.ok(relativeLine.seriesOrder() > volumeSeries.seriesOrder())
  captureVolumeLayers = true
  chart.timeScale().setVisibleLogicalRange({ from: 1450, to: 1550 }); await paint()
  const lastBar = volumeLayers.findLastIndex(layer => layer.kind === 'bar' && [volume.upColor, volume.downColor].includes(layer.color))
  const lastLine = volumeLayers.findLastIndex(layer => layer.kind === 'line' && layer.color === volume.relativeLineColor)
  assert.ok(lastBar >= 0 && lastLine > lastBar, 'Native canvas paints the Relative line after the volume bars')
  captureVolumeLayers = false
  assert.equal(relativeLine.options().lineType, library.LineType.Simple, 'Relative values use straight segments, with no curved smoothing')
  assert.equal(relativeLine.options().priceScaleId, 'volume-relative')
  assert.equal(relativeLine.options().lastValueVisible, true)
  assert.equal(relativeLine.options().priceFormat.formatter(1.5), '1.50×')
  assert.equal(volumeSeries.options().priceFormat.type, 'volume', 'Raw ticks keep their own right-hand scale')
  assert.equal(chart.options().leftPriceScale.visible, false, 'The Relative line never opens a left-axis gutter')
  const priceOverlays = host.querySelector('.chart-price-pane-overlays')
  assert.equal(priceOverlays.style.left, '0px', 'Price overlays retain the full plot width')
  assert.equal(priceOverlays.dataset.constrained, 'true', 'Indicators place event overlays inside the main price pane')
  assert.ok(!host.querySelector('.volume-legend').textContent.includes('Volume · Ticks'))
  assert.equal(host.querySelectorAll('.volume-readout > span').length, 7, 'Three stable fields have leading, middle and trailing pipe separators')
  const axisWindow = chart.timeScale().getVisibleLogicalRange(), priceBeforeAxis = chart.priceScale('right').getVisibleRange()
  const relativeY = relativeLine.priceToCoordinate(1)
  volumePane.priceScale('right').setVisibleRange({ from: 0, to: 400 }); await paint()
  close(relativeLine.priceToCoordinate(1), relativeY, 'Resizing raw ticks leaves the relative scale independent')
  assert.equal(volumePane.priceScale('right').options().autoScale, false)
  await render({ volume: { ...volume, upColor: '#123456' } })
  assert.equal(volumePane.priceScale('right').options().autoScale, false, 'Style edits preserve a manually resized axis')
  const axisButton = () => host.querySelector('[aria-label="Right axis target"]')
  await React.act(async () => axisButton().click()); await render({ volume })
  assert.equal(volume.axisTarget, 'relative')
  assert.equal(relativeLine.options().priceScaleId, 'right')
  assert.equal(volumeSeries.options().priceScaleId, 'volume-ticks')
  assert.equal(volumePane.getSeries()[1].options().priceScaleId, 'volume-ticks', 'The optional average stays with raw ticks')
  const tickY = volumeSeries.priceToCoordinate(100)
  volumePane.priceScale('right').setVisibleRange({ from: 0, to: 4 }); await paint()
  close(volumeSeries.priceToCoordinate(100), tickY, 'Resizing the Relative line leaves raw tick scaling independent')
  assert.deepEqual(chart.priceScale('right').getVisibleRange(), priceBeforeAxis, 'Volume-axis resizing never changes the main price scale')
  assert.deepEqual(chart.timeScale().getVisibleLogicalRange(), axisWindow, 'Switching/resizing the axis preserves shared dates')
  await React.act(async () => axisButton().click()); await render({ volume })
  assert.equal(volumeSeries.options().priceScaleId, 'right')
  assert.equal(relativeLine.options().priceScaleId, 'volume-relative')
  assert.ok(relativeLine.priceLines().some(line => line.options().price === 1 && line.options().lineVisible), 'Relative line shows its own 1× reference')
  const { createVolumeCalculator } = await server.ssrLoadModule('./src/market-data/indicators/volume/volume-calculation.ts')
  const checkDirectRatios = inputBars => {
    const rows = createVolumeCalculator().sync(inputBars, volume, { brokerId: null, brokerOffsetSeconds: 0 }, 3600).rows
    assert.deepEqual(relativeLine.data().map(row => ({ time: row.time, value: row.value })),
      rows.filter(row => row.relative !== undefined).map(row => ({ time: row.time, value: row.relative })), 'Every line sample is the exact per-candle Relative value')
    return rows
  }
  checkDirectRatios(bars)
  const spikyBars = bars.map((bar, i) => i === 1500 ? { ...bar, tickVolume: 10000 } : i === 1501 ? { ...bar, tickVolume: 1 } : bar)
  await render({ bars: spikyBars })
  checkDirectRatios(spikyBars)
  assert.ok(relativeLine.dataByIndex(1500).value > 80, 'An isolated activity spike remains intact')
  assert.ok(relativeLine.dataByIndex(1501).value < 0.02, 'The very next dip remains intact without moving-average lag')
  const spikeSnapshot = relativeLine.data()
  await render({ volume: { ...volume, averageVisible: true, averageLength: 100 } })
  assert.deepEqual(relativeLine.data(), spikeSnapshot, 'Legacy raw average settings cannot smooth the Relative line')
  await render({ bars, volume })
  assert.equal(relativeLine.dataByIndex(0), null, 'Unavailable baselines are not fabricated as zeros')
  assert.ok(relativeLine.data().every(point => point.time <= bars.at(-1).time), 'Relative line never projects values into future space')
  const beforeLineToggle = chart.timeScale().getVisibleLogicalRange()
  await render({ volume: { ...volume, relativeLineVisible: false, paneControlsVisible: false } })
  assert.equal(host.querySelector('.volume-pane-controls').hidden, true)
  assert.equal(host.querySelector('.volume-controls').hidden, true, 'No empty title/control row remains when both controls and line are hidden')
  assert.equal(relativeLine.options().visible, false)
  assert.equal(relativeLine.data().length, 0, 'A hidden Relative line contributes no values to scaling')
  assert.equal(chart.options().leftPriceScale.visible, false)
  await render({ volume })
  assert.equal(host.querySelector('.volume-pane-controls').hidden, false)
  assert.equal(relativeLine.options().visible, true)
  checkDirectRatios(bars)
  close(chart.timeScale().getVisibleLogicalRange().from, beforeLineToggle.from, 'Line/controls toggles keep the left viewport date')
  close(chart.timeScale().getVisibleLogicalRange().to, beforeLineToggle.to, 'Line/controls toggles keep the right viewport date')
  const volumeWindow = chart.timeScale().getVisibleLogicalRange()
  const volumeOnly = replaceRecentBars(bars, [{ ...bars.at(-1), tickVolume: 999 }])
  await render({ bars: volumeOnly })
  assert.equal(volumeSeries.data().at(-1).value, 999, 'Volume-only replies reach the histogram even when OHLC is unchanged')
  checkDirectRatios(volumeOnly)
  const legend = host.querySelector('.volume-legend')
  await React.act(async () => [...legend.querySelectorAll('button')].find(button => button.textContent === 'Raw').click())
  await render({ volume })
  assert.equal(volumeSeries.options().priceFormat.formatter(1.5), '1.50×')
  assert.equal(relativeLine.options().priceScaleId, 'right', 'Relative histogram and line share the same ratio scale')
  assert.ok(relativeLine.seriesOrder() > volumeSeries.seriesOrder(), 'Mode changes preserve the line above the bars')
  assert.equal(chart.options().hoveredSeriesOnTop, false)
  assert.equal(chart.options().leftPriceScale.visible, false, 'Relative mode does not leave an unused second axis')
  assert.ok(volumeSeries.data().some(row => row.value > 0), 'Relative mode has prior-day baselines')
  assert.equal(volumeSeries.dataByIndex(0), null, 'Insufficient baseline history stays blank')
  // Use the actual public subscription with a captured subscriber, rather than
  // browser input or private canvas internals.
  const before = chart.subscribeClick.bind(chart)
  let selectClick
  chart.subscribeClick = fn => { selectClick = fn; before(fn) }
  await render({ volume: { ...volume, enabled: false } })
  await render({ volume })
  const liveLegend = host.querySelector('.volume-legend')
  await React.act(async () => [...liveLegend.querySelectorAll('button')].find(button => button.textContent === 'Select A').click())
  selectClick({ paneIndex: 0, time: bars[1500].time })
  assert.match(liveLegend.querySelector('.volume-comparison').textContent, /first/, 'Price pane clicks cannot select a volume range')
  selectClick({ paneIndex: 1, time: bars[1500].time }); selectClick({ paneIndex: 1, time: bars[1503].time }); await paint()
  assert.match(liveLegend.querySelector('.volume-comparison').textContent, /A: 4 closed bars/)
  await React.act(async () => [...liveLegend.querySelectorAll('button')].find(button => button.textContent === 'Select B').click())
  selectClick({ paneIndex: 1, time: bars[1524].time }); selectClick({ paneIndex: 1, time: bars[1529].time }); await paint()
  assert.match(liveLegend.querySelector('.volume-comparison').textContent, /B vs A:/)
  assert.match(liveLegend.querySelector('.volume-comparison').textContent, /higher price high/)
  await render({ rsi: { ...defaultRsiPreferences, enabled: false } })
  assert.equal(chart.panes().length, 2)
  assert.equal(chart.panes()[1].getSeries()[0].seriesType(), 'Histogram')
  await render({ rsi: { ...defaultRsiPreferences, enabled: true } })
  await render({ volume: { ...volume, enabled: false } })
  assert.equal(chart.panes().length, 2)
  assert.equal(chart.panes()[1].getSeries()[0].seriesType(), 'Line', 'Removing Volume preserves RSI')
  assert.equal(chart.options().leftPriceScale.visible, false, 'Removing Volume restores the chart’s original left-axis visibility')
  assert.equal(chart.options().hoveredSeriesOnTop, true, 'Removing Volume restores the previous hover-order preference')
  close(chart.timeScale().getVisibleLogicalRange().to, volumeWindow.to, 'Pane toggles preserve the right viewport edge')
  await render({ volume, fitContentKey: 'GBPUSD:H1' })
  assert.equal(host.querySelector('.volume-comparison').textContent, '', 'Push selections reset across symbols')
  assert.equal(host.querySelectorAll('.volume-legend').length, 1)
  assert.ok(chart.panes()[1].getSeries()[0].data().length > 0, 'A scope change fully restores data even if the input array is reused')
  saved = null
  await React.act(async () => dialogRoot.render(React.createElement(VolumeSettingsDialog, { preferences: volume, onSave: next => { saved = next }, onClose })))
  await React.act(async () => { const control = dialogHost.querySelector('select'); control.value = 'raw'; control.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  const volumeTab = name => [...dialogHost.querySelectorAll('[role="tab"]')].find(tab => tab.textContent === name)
  assert.equal(volumeTab('Inputs').getAttribute('aria-selected'), 'true')
  assert.equal(dialogHost.querySelectorAll('input[type="color"]').length, 0, 'Inputs contains data settings only')
  await React.act(async () => volumeTab('Inputs').dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
  assert.equal(volumeTab('Style').getAttribute('aria-selected'), 'true')
  assert.equal(document.activeElement, volumeTab('Style'))
  assert.equal(dialogHost.querySelector('[role="tabpanel"]').getAttribute('aria-labelledby'), volumeTab('Style').id)
  assert.equal(dialogHost.querySelector('select').value, volume.axisTarget, 'Style exposes the persisted right-axis target')
  const checkbox = label => [...dialogHost.querySelectorAll('label')].find(element => element.textContent.trim() === label).querySelector('input')
  await React.act(async () => reactProps(checkbox('Show pane controls')).onChange({ target: { checked: false } }))
  await React.act(async () => reactProps(checkbox('Show Relative activity line')).onChange({ target: { checked: false } }))
  await React.act(async () => dialogHost.querySelector('form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(saved.mode, 'raw'); assert.equal(saved.enabled, true)
  assert.equal(saved.paneControlsVisible, false); assert.equal(saved.relativeLineVisible, false)
  await React.act(async () => dialogRoot.render(null))
  saved = null
  const reopenVolume = () => dialogRoot.render(React.createElement(VolumeSettingsDialog, { preferences: volume, onSave: next => { saved = next }, onClose }))
  await React.act(async () => reopenVolume())
  await React.act(async () => reactProps(dialogHost.querySelector('[aria-label="Previous sessions"]')).onChange({ target: { value: '1' } }))
  await React.act(async () => volumeTab('Style').click())
  await React.act(async () => dialogHost.querySelector('form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(saved, null)
  assert.equal(volumeTab('Inputs').getAttribute('aria-selected'), 'true', 'Validation returns to the tab containing the invalid input')
  assert.ok(dialogHost.querySelector('[role="alert"]'))
  await React.act(async () => [...dialogHost.querySelectorAll('button')].find(button => button.textContent === 'Reset defaults').click())
  assert.equal(dialogHost.querySelector('[aria-label="Previous sessions"]').value, '20')
  await React.act(async () => volumeTab('Inputs').dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'End', bubbles: true })))
  assert.equal(volumeTab('Style').getAttribute('aria-selected'), 'true')
  await React.act(async () => reactProps(checkbox('Show pane controls')).onChange({ target: { checked: false } }))
  await React.act(async () => volumeTab('Style').dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Home', bubbles: true })))
  assert.equal(volumeTab('Inputs').getAttribute('aria-selected'), 'true')
  await React.act(async () => [...dialogHost.querySelectorAll('button')].find(button => button.textContent === 'Cancel').click())
  assert.equal(saved, null, 'Cancel discards drafts changed across either tab')
  await React.act(async () => dialogRoot.render(null))
  await React.act(async () => root.render(null)); await paint()
  await React.act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(MarketCandlestickChart, { ...props, volume }))))
  await paint(); assert.equal(host.querySelectorAll('.volume-legend').length, 1)
  console.log('✓ Volume real chart: raw/relative/native pane order, independent toggles, live volume-only updates, manual A/B ranges, scope reset, settings and StrictMode cleanup')
  console.log('✓ RSI real chart: native panes/scale/time/crosshair, resize and gesture isolation, live/history/scope updates, style/empty/toggle, dialog drafts/validation/focus and StrictMode cleanup')
} catch (error) {
  console.error(error)
  throw error
} finally {
  await React.act(async () => { root.unmount(); dialogRoot.unmount() })
  assert.equal(frames.size, 0, 'Chart removal cancels native and indicator frames')
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
