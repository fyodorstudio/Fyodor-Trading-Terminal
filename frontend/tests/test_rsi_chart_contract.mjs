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
const frames = new Map(), contexts = new WeakMap(), paintedText = [], paintedFills = [], volumeLayers = [], upcomingStrokes = [], forecastStrokes = [], forecastRings = []; let frameId = 0, captureVolumeLayers = false
const forecastCurveStrokes = [], forecastCurveRings = []
const numberLabels = [], laneDots = []
dom.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId }
dom.cancelAnimationFrame = id => frames.delete(id)
dom.HTMLCanvasElement.prototype.getContext = function () {
  if (!contexts.has(this)) contexts.set(this, new Proxy({ canvas: this,
    fillText(text, x, y) {
      paintedText.push(String(text))
      if (this.font === '11px sans-serif' && this.textBaseline === 'bottom' && this.textAlign === 'center')
        numberLabels.push({ text: String(text), x, y, color: this.fillStyle })
    },
    setLineDash(dash) { this.fixtureDash = [...dash] },
    beginPath() { this.fixtureStart = undefined; this.fixtureEnd = undefined },
    moveTo(x, y) { this.fixtureStart = [x, y] }, lineTo(x, y) { this.fixtureEnd = [x, y] },
    arc(x, y, radius) {
      if (radius === 4) laneDots.push({ x, y, color: this.fillStyle })
      if (radius === 6.5) forecastRings.push({ x, y, radius })
      if (radius === 6) forecastCurveRings.push({ x, y, radius, color: this.strokeStyle, alpha: this.globalAlpha })
    },
    stroke() {
      if (captureVolumeLayers) volumeLayers.push({ kind: 'line', color: this.strokeStyle })
      if (this.fixtureDash?.join(',') === '4,4' && this.fixtureStart?.[0] === this.fixtureEnd?.[0] && this.fixtureStart?.[1] === 0)
        upcomingStrokes.push({ color: this.strokeStyle, from: this.fixtureStart, to: this.fixtureEnd })
      if (this.fixtureDash?.join(',') === '3,3' && this.fixtureStart?.[0] === this.fixtureEnd?.[0])
        forecastStrokes.push({ color: this.strokeStyle, from: this.fixtureStart, to: this.fixtureEnd })
      if (this.fixtureStart && this.fixtureEnd && (this.fixtureDash?.join(',') === '5,4' || (this.fixtureDash?.length === 0 && this.globalAlpha === 0.6)))
        forecastCurveStrokes.push({ color: this.strokeStyle, from: this.fixtureStart, to: this.fixtureEnd, alpha: this.globalAlpha, dash: this.fixtureDash })
    },
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
const nativeClickListeners = new Set(), nativeCrosshairListeners = new Set()
globalThis.__rsiChartLibrary = { ...library, createChart: (element, options) => {
  creates++
  chart = library.createChart(element, { ...options, autoSize: false, width: 900, height: 480,
    layout: { ...options.layout, colorParsers: [color => /^#[\da-f]{6}$/i.test(color) ? [1,3,5].map(i => parseInt(color.slice(i, i + 2), 16)).concat(1) : null] } })
  const subscribeClick = chart.subscribeClick.bind(chart), unsubscribeClick = chart.unsubscribeClick.bind(chart)
  chart.subscribeClick = handler => { nativeClickListeners.add(handler); subscribeClick(handler) }
  chart.unsubscribeClick = handler => { nativeClickListeners.delete(handler); unsubscribeClick(handler) }
  const subscribeCrosshair = chart.subscribeCrosshairMove.bind(chart), unsubscribeCrosshair = chart.unsubscribeCrosshairMove.bind(chart)
  chart.subscribeCrosshairMove = handler => { nativeCrosshairListeners.add(handler); subscribeCrosshair(handler) }
  chart.unsubscribeCrosshairMove = handler => { nativeCrosshairListeners.delete(handler); unsubscribeCrosshair(handler) }
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
  const switchWindow = chart.timeScale().getVisibleLogicalRange(), eurPriceBounds = chart.priceScale('right').getVisibleRange()
  const eurLastPrice = bars.at(-1).close
  const zoomPairBars = bars.map(bar => ({ ...bar, open: bar.open * 1.5, high: bar.high * 1.5, low: bar.low * 1.5, close: bar.close * 1.5 }))
  await render({ bars: [], symbol: 'USDJPY', fitContentKey: 'USDJPY:H1', precision: 3 })
  await render({ bars: zoomPairBars })
  const inheritedPrice = chart.priceScale('right').getVisibleRange()
  close((inheritedPrice.to - inheritedPrice.from) / zoomPairBars.at(-1).close, (eurPriceBounds.to - eurPriceBounds.from) / eurLastPrice, 'A newly opened pair inherits relative vertical zoom instead of autoscaling')
  assert.deepEqual(chart.timeScale().getVisibleLogicalRange(), switchWindow, 'Pair switches preserve horizontal zoom and dates')
  chart.priceScale('right').setVisibleRange({ from: 140, to: 160 }); await paint()
  await render({ bars: [], symbol: 'EURUSD', fitContentKey: 'EURUSD:H1', precision: 5 }); await render({ bars })
  assert.deepEqual(chart.priceScale('right').getVisibleRange(), eurPriceBounds, 'Returning to a pair restores its bounded manual price range through empty loading states')
  await render({ bars: [], symbol: 'USDJPY', fitContentKey: 'USDJPY:H1', precision: 3 }); await render({ bars: zoomPairBars })
  assert.deepEqual(chart.priceScale('right').getVisibleRange(), { from: 140, to: 160 }, 'Each pair keeps its own zoom and vertical position')
  await render({ bars: [], symbol: 'EURUSD', fitContentKey: 'EURUSD:H1', precision: 5 }); await render({ bars })
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
    timeframe: 'H1', fitContentKey: 'EURUSD:H1',
    onChangeVolumeAxis: axisTarget => { volume = { ...volume, axisTarget }; props = { ...props, volume } },
    onToggleVolumeLayer: layer => { volume = { ...volume, [layer]: !volume[layer] }; props = { ...props, volume } } }
  await render()
  assert.equal(chart.panes().length, 3)
  const volumePane = chart.panes()[1], volumeSeries = volumePane.getSeries()[0]
  assert.equal(volumeSeries.seriesType(), 'Histogram', 'Volume is always above RSI')
  assert.equal(chart.panes()[2].getSeries()[0].seriesType(), 'Line')
  assert.equal(volumeSeries.data().length, bars.length)
  assert.equal(volumeSeries.data().at(-1).value, bars.at(-1).tickVolume)
  const relativeLine = volumePane.getSeries()[2]
  const volumeAverage = volumePane.getSeries()[1]
  const layerToggle = async label => { await React.act(async () => host.querySelector(`[aria-label="Show ${label}"]`).click()); await render({ volume }) }
  assert.deepEqual([...host.querySelectorAll('.volume-controls button')].map(button => button.textContent), ['Axis: Volume','Bars','Relative','Average'])
  for (const label of ['Select A','Select B','Clear','Load older']) assert.ok(!host.querySelector('.volume-controls').textContent.includes(label))
  const layerPriceSeries = chart.panes()[0].getSeries()[0]
  const layerWindow = chart.timeScale().getVisibleLogicalRange(), layerCandles = layerPriceSeries.data(), layerMainHeight = chart.panes()[0].getHeight()
  await layerToggle('volume bars')
  assert.equal(volumeSeries.options().visible, false)
  assert.equal(relativeLine.options().visible, true)
  assert.equal(relativeLine.options().priceScaleId, 'right', 'A lone Relative line gets the usable right axis')
  await layerToggle('average line')
  assert.equal(volumeAverage.options().visible, true)
  assert.ok(volumeAverage.data().some(point => point.value > 0), 'The average can be shown without bars')
  await layerToggle('relative line')
  assert.equal(relativeLine.options().visible, false)
  assert.equal(volumeAverage.options().visible, true, 'Hiding Relative leaves the average independent')
  await layerToggle('average line')
  assert.ok([volumeSeries, relativeLine, volumeAverage].every(series => !series.options().visible))
  assert.equal(chart.panes().length, 3, 'Hiding all layers preserves the Volume pane and its controls')
  chart.panes()[0].setHeight(180); await paint()
  assert.ok(host.querySelector('.volume-legend').style.top, 'The pane legend still follows layout with every series hidden')
  assert.notEqual(chart.panes()[0].getHeight(), layerMainHeight)
  chart.panes()[0].setHeight(layerMainHeight); await paint()
  for (const label of ['volume bars', 'relative line']) await layerToggle(label)
  assert.deepEqual(layerPriceSeries.data(), layerCandles)
  close(chart.timeScale().getVisibleLogicalRange().from, layerWindow.from, 'Layer controls preserve the left date')
  close(chart.timeScale().getVisibleLogicalRange().to, layerWindow.to, 'Layer controls preserve the right date')
  assert.equal(chart.options().hoveredSeriesOnTop, false, 'Hover cannot promote the histogram above the Relative line')
  assert.ok(relativeLine.seriesOrder() > volumeSeries.seriesOrder())
  captureVolumeLayers = true
  await React.act(async () => host.querySelector('.market-chart-canvas').dispatchEvent(new dom.WheelEvent('wheel', { bubbles: true })))
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
  await render({ volume: { ...volume, relativeLineVisible: false, barsVisible: false } })
  assert.equal(volumeSeries.options().visible, false)
  assert.equal(host.querySelectorAll('.volume-controls button').length, 4, 'Controls remain available when all three layers are hidden')
  assert.equal(relativeLine.options().visible, false)
  assert.equal(relativeLine.data().length, 0, 'A hidden Relative line contributes no values to scaling')
  assert.equal(chart.options().leftPriceScale.visible, false)
  await render({ volume })
  assert.equal(volumeSeries.options().visible, true)
  assert.equal(relativeLine.options().visible, true)
  checkDirectRatios(bars)
  close(chart.timeScale().getVisibleLogicalRange().from, beforeLineToggle.from, 'Line/controls toggles keep the left viewport date')
  close(chart.timeScale().getVisibleLogicalRange().to, beforeLineToggle.to, 'Line/controls toggles keep the right viewport date')
  const volumeWindow = chart.timeScale().getVisibleLogicalRange()
  const volumeOnly = replaceRecentBars(bars, [{ ...bars.at(-1), tickVolume: 999 }])
  await render({ bars: volumeOnly })
  assert.equal(volumeSeries.data().at(-1).value, 999, 'Volume-only replies reach the histogram even when OHLC is unchanged')
  checkDirectRatios(volumeOnly)
  volume = { ...volume, mode: 'relative' }
  await render({ volume })
  assert.equal(volumeSeries.options().priceFormat.formatter(1.5), '1.50×')
  assert.equal(relativeLine.options().priceScaleId, 'right', 'Relative histogram and line share the same ratio scale')
  assert.ok(relativeLine.seriesOrder() > volumeSeries.seriesOrder(), 'Mode changes preserve the line above the bars')
  assert.equal(chart.options().hoveredSeriesOnTop, false)
  assert.equal(chart.options().leftPriceScale.visible, false, 'Relative mode does not leave an unused second axis')
  assert.ok(volumeSeries.data().some(row => row.value > 0), 'Relative mode has prior-day baselines')
  assert.equal(volumeSeries.dataByIndex(0), null, 'Insufficient baseline history stays blank')
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
  await React.act(async () => reactProps(checkbox('Show volume bars')).onChange({ target: { checked: false } }))
  await React.act(async () => reactProps(checkbox('Show Relative activity line')).onChange({ target: { checked: false } }))
  await React.act(async () => dialogHost.querySelector('form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(saved.mode, 'raw'); assert.equal(saved.enabled, true)
  assert.equal(saved.barsVisible, false); assert.equal(saved.relativeLineVisible, false)
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
  await React.act(async () => reactProps(checkbox('Show volume bars')).onChange({ target: { checked: false } }))
  await React.act(async () => volumeTab('Style').dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Home', bubbles: true })))
  assert.equal(volumeTab('Inputs').getAttribute('aria-selected'), 'true')
  await React.act(async () => [...dialogHost.querySelectorAll('button')].find(button => button.textContent === 'Cancel').click())
  assert.equal(saved, null, 'Cancel discards drafts changed across either tab')
  await React.act(async () => dialogRoot.render(null))
  // Pane removal must unregister series data, not just hide native widgets.
  // Otherwise 800 H1 timestamps survive and put H4 samples 798/799 at
  // logical positions 1395/1399, exactly as in the NZDJPY Activity trace.
  for (const which of ['volume', 'rsi', 'both']) {
    await React.act(async () => root.render(null)); await paint()
    const last = 1711505600
    const h1 = Array.from({ length: 800 }, (_, i) => ({ time: last - (799 - i) * 3600,
      open: 100, high: 106, low: 94, close: 101, tickVolume: 100 + i }))
    const preferences = enabled => ({
      rsi: { ...defaultRsiPreferences, enabled: enabled && which !== 'volume' },
      volume: { ...defaultVolumePreferences, enabled: enabled && which !== 'rsi' },
    })
    await render({ bars: h1, timeframe: 'H1', fitContentKey: 'NZDJPY:H1', symbol: 'NZDJPY',
      ...preferences(true), drawings: [], selectedDrawingId: null })
    const nativeCandles = chart.panes()[0].getSeries()[0], horizon = chart.panes()[0].getSeries()[1]
    const chartCreates = creates
    await React.act(async () => host.querySelector('.market-chart-canvas').dispatchEvent(new dom.WheelEvent('wheel', { bubbles: true })))
    chart.timeScale().setVisibleLogicalRange({ from: 600, to: 820 }); await paint()
    const selectedDates = captureDateWindow(chart.timeScale().getVisibleLogicalRange(), h1, 3600)
    for (let repeat = 0; repeat < 3; repeat++) {
      await render(preferences(false))
      assert.equal(chart.panes().length, 1)
      assert.equal(host.querySelectorAll('.volume-legend, .rsi-legend').length, 0)
      if (repeat < 2) await render(preferences(true))
    }
    for (const [frame, step] of [['H4', 14400], ['D1', 86400], ['H1', 3600]]) {
      const next = h1.map((bar, i) => ({ ...bar, time: last - (799 - i) * step }))
      await render({ bars: next, timeframe: frame, fitContentKey: `NZDJPY:${frame}` })
      assert.ok(next.every((bar, index) => chart.timeScale().timeToIndex(bar.time) === index),
        `${which} teardown leaves exactly 800 real historical positions on ${frame}`)
      assert.deepEqual(nativeCandles.data(), next.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })))
      assert.equal(chart.panes()[0].getSeries()[0], nativeCandles)
      assert.equal(chart.panes()[0].getSeries()[1], horizon)
      assert.equal(creates, chartCreates, 'Timeframe changes retain the existing chart and overlay APIs')
      const dates = captureDateWindow(chart.timeScale().getVisibleLogicalRange(), next, step)
      close(dates.from, selectedDates.from, `${which} hidden, ${frame}: retain selected left date`)
      close(dates.to, selectedDates.to, `${which} hidden, ${frame}: retain selected right date`)
      assert.ok(horizon.data().at(-1).time > last + 89 * 86400, 'The future axis remains available')
      // Exercise each higher timeframe's cleanup before moving to the next.
      await render(preferences(true)); await render(preferences(false))
    }
  }
  console.log('✓ Native timeframe regression: Volume/RSI teardown removes stale H1 timestamps before H4/D1, preserving OHLC, dates, future axis and chart identities')
  // MFDI joins the assembled native chart without introducing event-time
  // positions or leaking them through symbol/timeframe switches.
  await React.act(async () => root.render(null)); await paint()
  const macroBars = makeBars(1700000000)
  const { ChartInspectionDismiss } = await server.ssrLoadModule('./src/terminal-shell/chart-overlays/ChartInspectionDismiss.tsx')
  const inspectedReleases = []; let backgroundDismissals = 0
  const renderDismiss = chartApi => React.createElement(ChartInspectionDismiss, { chartApi, onClear: () => { backgroundDismissals++ } })
  const { defaultMacroPreferences, selectMacroMetric, toggleMacroMetric, toggleMacroForecast, toggleMacroNumbers, setMacroCurrency, setMacroEvents } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-preferences.ts')
  let macro = { enabled: true, status: 'Stored MT5 actuals', preferences: { ...defaultMacroPreferences, enabled: true }, history: { rate: [
    { id: 'seed', time: macroBars[0].time - 86400, releasedAt: (macroBars[0].time - 86400) * 1000, value: 5.5 },
    { id: 'decision', time: macroBars[45].time + 1800, releasedAt: (macroBars[45].time + 1800) * 1000, value: 5.25 },
  ], payrolls: [], unemployment: [], coreCpi: [], headlineCpi: [] } }
  const monthly = (id, index, value) => ({ id, time: macroBars[index].time + 1800, releasedAt: (macroBars[index].time + 1800) * 1000, value })
  macro.history = { ...macro.history,
    payrolls: [monthly('nfp-one', 45, -120), monthly('nfp-two', 65, 200)],
    unemployment: [monthly('unemployment-one', 45, 4.2), monthly('unemployment-two', 65, 4.1)],
    coreCpi: [monthly('core-one', 45, 0), monthly('core-two', 65, -0.1)],
    headlineCpi: [monthly('headline-one', 45, 0.2), monthly('headline-two', 65, 0.3)],
  }
  await render({ bars: macroBars, symbol: 'USDX', fitContentKey: 'USDX:H1', timeframe: 'H1', macro,
    onToggleMacroMetric: metric => { macro = { ...macro, preferences: toggleMacroMetric(macro.preferences, metric) } },
    onToggleMacroForecast: metric => { macro = { ...macro, preferences: toggleMacroForecast(macro.preferences, metric) } },
    onToggleMacroNumbers: metric => { macro = { ...macro, preferences: toggleMacroNumbers(macro.preferences, metric) } },
    onChangeMacroPreferences: preferences => { macro = { ...macro, preferences } },
    onSelectMacroMetric: metric => { macro = { ...macro, preferences: selectMacroMetric(macro.preferences, metric) } },
    onInspectMacroRelease: reading => inspectedReleases.push(reading), renderChartOverlay: renderDismiss,
    rsi: { ...defaultRsiPreferences, enabled: false }, volume: { ...defaultVolumePreferences, enabled: false } })
  assert.equal(chart.panes().length, 2)
  const [payrollLine, rateLine, unemploymentLine, coreLine, headlineLine, rateDots] = chart.panes()[1].getSeries()
  assert.equal(rateLine.options().lineType, library.LineType.WithSteps)
  assert.equal(rateLine.options().priceFormat.formatter(5.25), '5.25%')
  assert.equal(rateDots.options().lineVisible, false)
  assert.equal(rateDots.options().pointMarkersVisible, true)
  assert.deepEqual(rateDots.data(), [{ time: macroBars[45].time, value: 5.25 }])
  assert.equal(rateLine.data().length, 100)
  assert.ok(macroBars.every((bar, index) => chart.timeScale().timeToIndex(bar.time) === index), 'Fed instants never change candle indices')
  assert.ok(rateLine.data().every(point => point.time <= macroBars.at(-1).time), 'No rate projection into future space')
  assert.match(host.querySelector('.macro-legend').textContent, /5.25%/)
  assert.equal(host.querySelector('.chart-price-pane-overlays').dataset.constrained, 'true')
  const rateWindow = chart.timeScale().getVisibleLogicalRange()
  chart.priceScale('right').setVisibleRange({ from: 90, to: 110 }); await paint()
  const ratePriceRange = chart.priceScale('right').getVisibleRange()
  await render({ rsi: { ...defaultRsiPreferences, enabled: true }, volume: { ...defaultVolumePreferences, enabled: true } })
  assert.equal(chart.panes().length, 4)
  assert.equal(host.querySelectorAll('.macro-legend, .rsi-legend, .volume-legend').length, 3)
  assert.deepEqual(chart.timeScale().getVisibleLogicalRange(), rateWindow)
  assert.deepEqual(chart.priceScale('right').getVisibleRange(), ratePriceRange)
  const toggleLines = async keys => {
    await React.act(async () => { for (const key of keys) host.querySelector(`[data-macro-visibility="${key}"]`).click() })
    await render({ macro })
  }
  const selectAxis = async axis => {
    const key = axis
    await React.act(async () => host.querySelector(`[data-macro-axis="${key}"]`).click())
    await render({ macro })
  }
  const macroPane = chart.panes().find(pane => pane.getSeries().includes(payrollLine))
  const seriesDrawerButton = host.querySelector('button[aria-label="MFDI series drawer"]')
  const drawerWindow = chart.timeScale().getVisibleLogicalRange()
  assert.equal(host.querySelector('.macro-series-drawer').hidden, true)
  assert.equal(host.querySelector('.macro-readout').hidden, true, 'The release legend defaults to hidden')
  await React.act(async () => seriesDrawerButton.click()); await paint()
  assert.equal(host.querySelector('.macro-series-drawer').hidden, false)
  assert.equal(seriesDrawerButton.getAttribute('aria-expanded'), 'true')
  for (const key of ['rate', 'payrolls', 'unemployment', 'headlineCpi', 'coreCpi']) {
    const input = host.querySelector(`[data-macro-row="${key}"] input[type="color"]`)
    assert.equal(input.previousElementSibling.dataset.macroNumbers, key, 'The colour circle follows N in every drawer row')
  }
  const seriesDrawer = host.querySelector('.macro-series-drawer'), seriesBody = host.querySelector('.macro-drawer-body')
  Object.defineProperty(seriesBody, 'scrollHeight', { configurable: true, value: 900 })
  Object.defineProperty(seriesBody, 'clientHeight', { configurable: true, value: 120 })
  const drawerRanges = () => macroPane.getSeries().map(line => macroPane.priceScale(line.options().priceScaleId).getVisibleRange())
  const beforeDrawerRanges = drawerRanges()
  const drawerWheel = new dom.WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 80 })
  await React.act(async () => seriesBody.dispatchEvent(drawerWheel)); await paint()
  assert.equal(seriesBody.scrollTop, 80)
  assert.equal(drawerWheel.defaultPrevented, true)
  assert.deepEqual(chart.timeScale().getVisibleLogicalRange(), drawerWindow)
  assert.deepEqual(drawerRanges(), beforeDrawerRanges, 'Scrolling the Series window never moves native axes')
  const drawerTitle = host.querySelector('[aria-label="Move MFDI series window"]'), beforeDrawerLeft = parseFloat(seriesDrawer.style.left)
  await React.act(async () => drawerTitle.dispatchEvent(new dom.PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: 700, clientY: 100, pointerId: 1 })))
  await React.act(async () => window.dispatchEvent(new dom.PointerEvent('pointermove', { clientX: 660, clientY: 110, pointerId: 1 })))
  await React.act(async () => window.dispatchEvent(new dom.PointerEvent('pointerup', { clientX: 660, clientY: 110, pointerId: 1 }))); await paint()
  assert.equal(parseFloat(seriesDrawer.style.left), beforeDrawerLeft - 40, 'The title moves the popover instead of the plot')
  assert.deepEqual(chart.timeScale().getVisibleLogicalRange(), drawerWindow)
  assert.deepEqual(drawerRanges(), beforeDrawerRanges)
  const drawerResize = host.querySelector('[aria-label="Resize MFDI series window"]')
  const beforePopoverWidth = parseFloat(seriesDrawer.style.width)
  await React.act(async () => drawerResize.dispatchEvent(new dom.PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: 700, clientY: 200, pointerId: 1 })))
  await React.act(async () => window.dispatchEvent(new dom.PointerEvent('pointermove', { clientX: 650, clientY: 200, pointerId: 1 })))
  await React.act(async () => window.dispatchEvent(new dom.PointerEvent('pointerup', { clientX: 650, clientY: 200, pointerId: 1 }))); await paint()
  assert.equal(parseFloat(seriesDrawer.style.width), beforePopoverWidth - 50, 'The resize grip changes the window size across chart redraws')
  assert.deepEqual(chart.timeScale().getVisibleLogicalRange(), drawerWindow)
  assert.deepEqual(drawerRanges(), beforeDrawerRanges, 'Popover resizing preserves native scales')
  const universalStyles = macro.preferences.series
  for (const [kind, field, slash] of [['visibility', 'visible', 'eye'], ['forecast', 'forecastVisible', 'forecast'], ['numbers', 'numbersVisible', 'numbers']]) {
    macro = { ...macro, preferences: { ...macro.preferences, series: { ...macro.preferences.series, rate: { ...macro.preferences.series.rate, [field]: true } } } }; await render({ macro })
    await React.act(async () => host.querySelector(`[data-macro-all="${kind}"]`).click()); await render({ macro })
    assert.ok(Object.values(macro.preferences.series).every(style => !style[field]), `${kind}: universal control hides the whole selected set`)
    assert.equal(host.querySelector(`[data-macro-all="${kind}"] [data-${slash}-slash]`).getAttribute('visibility'), 'visible')
    await React.act(async () => host.querySelector(`[data-macro-all="${kind}"]`).click()); await render({ macro })
    assert.ok(Object.values(macro.preferences.series).every(style => style[field]))
  }
  macro = { ...macro, preferences: { ...macro.preferences, series: universalStyles } }; await render({ macro })
  const oldColour = macro.preferences.series.payrolls.color
  const picker = host.querySelector('[data-macro-row="payrolls"] input[type="color"]')
  await React.act(async () => { picker.value = '#1267ab'; picker.dispatchEvent(new dom.Event('change', { bubbles: true })) }); await render({ macro })
  assert.equal(payrollLine.options().color, '#1267ab', 'The drawer colour picker updates the actual series')
  await React.act(async () => { picker.value = oldColour; picker.dispatchEvent(new dom.Event('change', { bubbles: true })) }); await render({ macro })
  host.querySelector('.macro-series-drawer').dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  assert.equal(host.querySelector('.macro-series-drawer').hidden, true)
  assert.equal(document.activeElement, seriesDrawerButton)
  assert.deepEqual(chart.timeScale().getVisibleLogicalRange(), drawerWindow, 'Drawer use preserves the shared date viewport')
  const normalUpcoming = macro.upcoming
  const futureChartTime = macroBars.at(-1).time + 3.5 * 3600
  macro = { ...macro, upcoming: [
    { time: futureChartTime, releasedAt: Date.now() + 86400000, metrics: ['coreCpi', 'headlineCpi'] },
    { time: macroBars.at(-1).time + 1800, releasedAt: Date.now() + 3600000, metrics: ['rate'] },
    { time: futureChartTime + 3600, releasedAt: Date.now() - 1000, metrics: ['rate'] },
  ] }
  upcomingStrokes.length = 0
  await render({ macro })
  const scheduleLines = upcomingStrokes.filter(stroke => stroke.color === macro.preferences.series.coreCpi.color)
  assert.ok(scheduleLines.length > 0, 'Upcoming CPI draws a vertical line in future space without candles')
  const expectedFutureX = (chart.timeScale().logicalToCoordinate(102) + chart.timeScale().logicalToCoordinate(103)) / 2
  for (const stroke of scheduleLines) {
    close(stroke.from[0], expectedFutureX, 'Scheduled time retains sub-candle positioning')
    assert.ok(stroke.to[1] > stroke.from[1])
  }
  assert.equal(new Set(scheduleLines.map(stroke => stroke.from[0])).size, 1, 'The CPI package has one marker position')
  assert.equal(upcomingStrokes.filter(stroke => stroke.color === macro.preferences.series.rate.color).length, 0, 'Elapsed and current-candle schedules are omitted')
  assert.ok(macroPane.getSeries().every(line => line.data().every(point => point.time <= macroBars.at(-1).time)), 'Schedules do not add valued series points or timestamps')
  const scheduledStyles = macro.preferences.series
  macro = { ...macro, preferences: { ...macro.preferences, series: { ...scheduledStyles,
    coreCpi: { ...scheduledStyles.coreCpi, visible: false }, headlineCpi: { ...scheduledStyles.headlineCpi, visible: false } } } }
  upcomingStrokes.length = 0; await render({ macro })
  assert.equal(upcomingStrokes.filter(stroke => stroke.color === scheduledStyles.coreCpi.color || stroke.color === scheduledStyles.headlineCpi.color).length, 0, 'Hidden series have no scheduled marker')
  macro = { ...macro, upcoming: normalUpcoming, preferences: { ...macro.preferences, series: scheduledStyles } }; await render({ macro })
  // Forecast curves are primitive overlays on the actual scales. Even extreme
  // forecasts and future dots must never add native samples or refit any scale.
  const forecastPreferences = macro.preferences
  // Enabling RSI/Volume reduces MFDI's canvas without squeezing its plots.
  // Fit all scales explicitly before checking their on-canvas dots and labels.
  for (const line of [rateLine, payrollLine, unemploymentLine, coreLine, headlineLine])
    macroPane.priceScale(line.options().priceScaleId).setAutoScale(true)
  await paint()
  const originalPayrollRange = macroPane.priceScale(payrollLine.options().priceScaleId).getVisibleRange()
  await selectAxis('payrolls')
  macroPane.priceScale('right').setVisibleRange({ from: -200, to: 400 }); await paint()
  const curveWindow = chart.timeScale().getVisibleLogicalRange(), originalPayrollData = payrollLine.data()
  const numberPreferences = macro.preferences
  assert.equal(host.querySelectorAll('[data-macro-numbers]').length, 5)
  const toggleNumbers = async key => {
    numberLabels.length = 0
    await React.act(async () => host.querySelector(`[data-macro-numbers="${key}"]`).click()); await render({ macro })
  }
  for (const [key, line, expected] of [
    ['rate', rateLine, '↓5.25%'], ['payrolls', payrollLine, '↑200k'], ['unemployment', unemploymentLine, '↓4.10%'],
    ['coreCpi', coreLine, '↓-0.10%'], ['headlineCpi', headlineLine, '↑0.30%'],
  ]) {
    const button = host.querySelector(`[data-macro-numbers="${key}"]`)
    assert.equal(button.getAttribute('aria-pressed'), 'false', 'Numbers start hidden')
    assert.equal(button.querySelector('[data-numbers-slash]').getAttribute('visibility'), 'visible')
    await toggleNumbers(key)
    assert.equal(button.getAttribute('aria-pressed'), 'true')
    assert.equal(button.querySelector('[data-numbers-slash]').getAttribute('visibility'), 'hidden')
    const point = (key === 'rate' ? rateDots : line).data().at(-1)
    const label = numberLabels.find(label => label.text === expected && label.color === macro.preferences.series[key].color)
    assert.ok(label, `${key}: N paints the actual value with its correct units`)
    close(label.x, chart.timeScale().timeToCoordinate(point.time), 'Number stays centered on its release dot')
    assert.ok(label.y < line.priceToCoordinate(point.value), 'Number appears above its dot')
    await toggleNumbers(key)
    assert.equal(numberLabels.filter(label => label.color === macro.preferences.series[key].color).length, 0, 'Slashed N hides numbers')
  }
  assert.deepEqual(payrollLine.data(), originalPayrollData, 'N never adds samples or carried value labels')
  assert.deepEqual(chart.timeScale().getVisibleLogicalRange(), curveWindow)
  assert.deepEqual(macroPane.priceScale('right').getVisibleRange(), { from: -200, to: 400 })
  macro = { ...macro, preferences: numberPreferences }; await render({ macro })
  const lastForecastX = chart.timeScale().timeToCoordinate(macroBars[65].time)
  const forecastToggle = async key => {
    await React.act(async () => host.querySelector(`[data-macro-forecast="${key}"]`).click()); await render({ macro })
  }
  macro = { ...macro, forecastHistory: { ...macro.history,
    payrolls: [monthly('nfp-f-one', 45, -120), monthly('nfp-f-two', 65, 100)] }, upcoming: [
    { time: futureChartTime, releasedAt: Date.now() + 86400000, metrics: ['payrolls'], forecasts: { payrolls: 250 } },
    { time: futureChartTime + 3600, releasedAt: Date.now() + 172800000, metrics: ['payrolls'] },
    { time: futureChartTime + 7200, releasedAt: Date.now() + 259200000, metrics: ['payrolls'], forecasts: { payrolls: 0 } },
  ] }
  forecastCurveStrokes.length = 0; forecastCurveRings.length = 0; upcomingStrokes.length = 0
  await render({ macro })
  const payrollColor = macro.preferences.series.payrolls.color
  const payrollCurves = forecastCurveStrokes.filter(row => row.color === payrollColor)
  assert.ok(payrollCurves.some(row => row.alpha === 0.6 && row.dash.length === 0), 'Historical forecasts use a translucent solid line')
  const dashedCurves = payrollCurves.filter(row => row.dash.join(',') === '5,4')
  assert.ok(dashedCurves.length > 0, 'Upcoming forecasts use dashed connections')
  for (const row of dashedCurves) {
    close(row.from[0], lastForecastX, 'Future connection starts at the latest forecast release')
    close(row.from[1], payrollLine.priceToCoordinate(100), 'Future connection starts at the forecast value, independently of the actual')
    close(row.to[0], expectedFutureX, 'Upcoming dot uses the verified sub-candle schedule')
    close(row.to[1], payrollLine.priceToCoordinate(250), 'Upcoming dot uses its forecast value')
    assert.equal(row.alpha, 0.4)
  }
  assert.ok(forecastCurveRings.some(row => row.color === payrollColor && row.alpha === 1
    && row.x === chart.timeScale().timeToCoordinate(macroBars[45].time) && row.y === payrollLine.priceToCoordinate(-120)),
  'A larger hollow forecast ring remains around an equal actual dot')
  assert.ok(forecastCurveRings.some(row => row.color === payrollColor && row.alpha === 0.4 && row.y === payrollLine.priceToCoordinate(0)), 'A zero forecast remains a visible faint dot after a missing forecast')
  assert.equal(new Set(upcomingStrokes.filter(row => row.color === payrollColor).map(row => row.from[0])).size, 3, 'Missing forecasts retain their vertical schedules')
  assert.deepEqual(payrollLine.data(), originalPayrollData)
  assert.equal(macroPane.getSeries().length, 6, 'Forecasts introduce no native series')
  assert.deepEqual(macroPane.priceScale('right').getVisibleRange(), { from: -200, to: 400 })
  assert.deepEqual(chart.timeScale().getVisibleLogicalRange(), curveWindow)
  assert.ok(macroBars.every((bar, index) => chart.timeScale().timeToIndex(bar.time) === index), 'Forecasts never introduce timeline timestamps')
  assert.equal(host.querySelectorAll('[data-macro-forecast]').length, 5)
  forecastCurveRings.length = 0; upcomingStrokes.length = 0
  await forecastToggle('payrolls')
  assert.equal(host.querySelector('[data-macro-forecast="payrolls"]').getAttribute('aria-pressed'), 'false')
  assert.equal(host.querySelector('[data-macro-forecast="payrolls"] [data-forecast-slash]').getAttribute('visibility'), 'visible')
  assert.equal(forecastCurveRings.filter(row => row.color === payrollColor).length, 0, 'Slashed F hides forecast dots independently')
  assert.ok(upcomingStrokes.some(row => row.color === payrollColor), 'Slashed F preserves upcoming schedules')
  assert.deepEqual(payrollLine.data(), originalPayrollData, 'Slashed F preserves actuals')
  for (const key of ['rate', 'unemployment', 'headlineCpi', 'coreCpi']) {
    forecastCurveRings.length = 0
    await forecastToggle(key)
    assert.ok(forecastCurveRings.some(row => row.color === macro.preferences.series[key].color), `${key}: F also enables its forecast layer`)
    await forecastToggle(key)
  }
  macro = { ...macro, preferences: forecastPreferences, forecastHistory: undefined, upcoming: normalUpcoming }
  macroPane.priceScale('right').setVisibleRange(originalPayrollRange); await render({ macro })
  console.log('✓ MFDI forecast curves: outlined equal-value dots, lighter historical lines, dashed forecast-to-forecast future segments, zero/missing values, all five F controls and unchanged native scales/dates/samples')
  // Native drawing contracts: a transient primitive overlay never contributes
  // forecast values/timestamps to any series or to the independently bound axes.
  const forecastDateRange = chart.timeScale().getVisibleLogicalRange(), originalFedRange = macroPane.priceScale('right').getVisibleRange()
  macroPane.priceScale('right').setVisibleRange({ from: 4, to: 6 }); await paint()
  const originalRateData = rateLine.data(), originalDots = rateDots.data()
  const fedDecision = macro.history.rate[1]
  const forecastEvidence = { url: 'https://www.investing.com/economic-calendar/interest-rate-decision-168',
    captured_at: '2026-11-07T00:00:00Z', as_of: null, timing: 'historical_backfill', note: 'Synthetic contract fixture' }
  const hoverDot = async (line = rateDots, index = 0, extra = {}) => {
    const point = line.data()[index]
    const event = { point: { x: chart.timeScale().timeToCoordinate(point.time), y: line.priceToCoordinate(point.value) },
      time: point.time, paneIndex: macroPane.paneIndex(), seriesData: new Map(), hoveredInfo: { series: line }, ...extra }
    await React.act(async () => { for (const listener of [...nativeCrosshairListeners]) listener(event) }); await paint()
  }
  for (const [value, label] of [[5, 'Beat'], [5.5, 'Miss'], [5.25, 'In line'], [9, 'Miss']]) {
    const meeting = { released_at: new Date(fedDecision.releasedAt).toISOString(), actual: null, fedwatch: null,
      consensus: [{ ...forecastEvidence, provider: 'investing', value }, { ...forecastEvidence, provider: 'trading_economics', value: 5.5 }] }
    macro = { ...macro, forecasts: { meetings: new Map([[fedDecision.releasedAt, meeting]]), status: 'Saved fixture' } }
    forecastRings.length = 0; await render({ macro })
    assert.equal(host.querySelector('[aria-label="MFDI release details"]').hidden, true, 'Sync clears obsolete hover evidence')
    assert.equal(forecastRings.length > 0, label === 'Beat', 'Only a primary consensus Beat adds an outline')
    forecastStrokes.length = 0; await hoverDot()
    const tooltip = host.querySelector('[aria-label="MFDI release details"]')
    assert.equal(tooltip.hidden, false)
    assert.deepEqual([...tooltip.querySelectorAll('th')].map(node => node.textContent), ['Actual', 'Forecast', 'Previous'])
    assert.equal(tooltip.querySelector('[data-macro-tooltip-field="actual"]').textContent, '5.25%')
    assert.equal(tooltip.querySelector('[data-macro-tooltip-field="forecast"]').textContent, `${value.toFixed(2)}%`)
    assert.equal(tooltip.querySelector('[data-macro-tooltip-field="previous"]').textContent, '—')
    assert.equal(tooltip.querySelector('time').dateTime, new Date(fedDecision.releasedAt).toISOString())
    assert.ok(forecastStrokes.length > 0, 'Hovered actual anchors a dashed connector')
    for (const segment of forecastStrokes) {
      close(segment.from[0], chart.timeScale().timeToCoordinate(macroBars[45].time), 'Forecast shares actual x')
      close(segment.from[1], rateLine.priceToCoordinate(5.25), 'Forecast is anchored to the actual')
      assert.ok(segment.to[1] >= 0 && segment.to[1] <= macroPane.getHeight(), 'Offscreen forecasts are clipped without fitting')
      if (label === 'In line') close(segment.to[1], segment.from[1], 'Equal consensus has zero-length connector')
    }
    assert.deepEqual(macroPane.priceScale('right').getVisibleRange(), { from: 4, to: 6 })
    assert.deepEqual(chart.timeScale().getVisibleLogicalRange(), forecastDateRange)
    assert.deepEqual(rateLine.data(), originalRateData); assert.deepEqual(rateDots.data(), originalDots)
    for (const [line, index, extra] of [[rateLine, 80, {}], [rateDots, 0, { paneIndex: 0 }], [rateDots, 0, { point: undefined }]]) {
      forecastStrokes.length = 0; await hoverDot(line, index, extra)
      assert.equal(tooltip.hidden, true, 'Carry, other metrics/panes and chart leave do not show forecasts')
      assert.equal(forecastStrokes.length, 0)
    }
  }
  const originalFedHistory = macro.history.rate
  const officialFixture = { ...forecastEvidence, url: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20231115a.htm', lower: 5, upper: 5.25 }
  const cmeFixture = { ...forecastEvidence, url: 'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html', as_of: new Date(fedDecision.releasedAt - 3600000).toISOString(),
    outcomes: [{ lower: 5, upper: 5.25, probability: 75 }, { lower: 5.25, upper: 5.5, probability: 25 }] }
  const alternativesMeeting = { released_at: new Date(fedDecision.releasedAt).toISOString(), actual: officialFixture, fedwatch: cmeFixture,
    consensus: [{ ...forecastEvidence, provider: 'investing', value: 5.25 }] }
  macro = { ...macro, history: { ...macro.history, rate: originalFedHistory.map(row => row.id === 'decision' ? { ...row, brokerValue: 5.5 } : row) },
    forecasts: { meetings: new Map([[fedDecision.releasedAt, alternativesMeeting]]), status: 'Saved fixture' } }
  await render({ macro }); await hoverDot()
  const alternativesTooltip = host.querySelector('[aria-label="MFDI release details"]')
  assert.equal(alternativesTooltip.querySelector('[data-macro-tooltip-field="forecast"]').textContent, '5.25%', 'The Fed card uses the saved exact-release consensus')
  assert.ok(!alternativesTooltip.textContent.includes('CME'))
  assert.deepEqual(macroPane.priceScale('right').getVisibleRange(), { from: 4, to: 6 })
  macro = { ...macro, history: { ...macro.history, rate: originalFedHistory }, forecasts: undefined }; await render({ macro }); await hoverDot()
  assert.equal(host.querySelector('[aria-label="MFDI release details"]').querySelector('[data-macro-tooltip-field="forecast"]').textContent, '—')
  await hoverDot(rateDots, 0, { point: undefined })
  macroPane.priceScale('right').setVisibleRange(originalFedRange); await paint()
  console.log('✓ Fed forecast native overlay: release cards with saved consensus, no CME/metadata, Beat ring, zero/offscreen connector, unchanged series/dates/bound scales and leave cleanup')
  const fireDotClick = async (line, index, extra = {}) => {
    const point = line.data()[index]
    const event = { point: { x: chart.timeScale().timeToCoordinate(point.time), y: line.priceToCoordinate(point.value) },
      time: point.time, paneIndex: macroPane.paneIndex(), seriesData: new Map(), hoveredInfo: { series: line }, ...extra }
    await React.act(async () => { for (const listener of [...nativeClickListeners]) listener(event) })
  }
  for (const [line, index, id] of [[rateDots, 0, 'decision'], [payrollLine, 0, 'nfp-one'], [unemploymentLine, 1, 'unemployment-two'],
    [headlineLine, 0, 'headline-one'], [coreLine, 1, 'core-two']]) {
    await fireDotClick(line, index)
    assert.equal(inspectedReleases.at(-1).id, id, `${id}: selects the exact clicked release, including overlapping dots`)
  }
  assert.equal(backgroundDismissals, 0, 'A dot selection is not immediately cleared by canvas dismissal')
  const beforeMisses = inspectedReleases.length
  await fireDotClick(rateLine, 80)
  await fireDotClick(payrollLine, 0, { paneIndex: 0 })
  const point = payrollLine.data()[0]
  await fireDotClick(payrollLine, 0, { point: { x: chart.timeScale().timeToCoordinate(point.time) + 12, y: payrollLine.priceToCoordinate(point.value) } })
  assert.equal(inspectedReleases.length, beforeMisses, 'Carried values, other panes and blank space never select a release')
  assert.ok(backgroundDismissals > 0, 'Blank-chart dismissal remains available')
  await fireDotClick(payrollLine, 0, { time: macroBars[44].time })
  assert.equal(inspectedReleases.at(-1).id, 'nfp-one', 'Near-dot clicks survive native snapping to a neighboring candle')
  const originalStyles = macro.preferences.series
  macro = { ...macro, preferences: { ...macro.preferences, series: Object.fromEntries(Object.entries(originalStyles).map(([key, style]) => [key, { ...style, pointsVisible: false }])) } }
  await render({ macro })
  const beforeHiddenDots = inspectedReleases.length
  await fireDotClick(payrollLine, 0)
  assert.equal(inspectedReleases.length, beforeHiddenDots, 'Hidden dots do not respond to line clicks')
  macro = { ...macro, preferences: { ...macro.preferences, series: originalStyles } }; await render({ macro })
  assert.equal(host.querySelectorAll('.macro-readout .macro-field').length, 5, 'All five series overlay by default')
  assert.ok([...host.querySelectorAll('.macro-visibility-button')].every(button => button.getAttribute('aria-pressed') === 'true'))
  assert.equal(payrollLine.seriesType(), 'Line')
  assert.equal(payrollLine.options().pointMarkersVisible, true)
  assert.deepEqual(payrollLine.data().map(point => point.value), [-120, 200])
  assert.deepEqual(unemploymentLine.data().map(point => point.value), [4.2, 4.1])
  assert.equal(payrollLine.options().lineType, library.LineType.Simple)
  assert.equal(payrollLine.options().priceFormat.formatter(150), '150k')
  assert.equal(coreLine.options().priceScaleId, 'macro-coreCpi')
  assert.equal(headlineLine.options().priceScaleId, 'macro-headlineCpi', 'Headline and Core use independent scales')
  assert.deepEqual([...host.querySelectorAll('.macro-metric-axis')].map(button => button.textContent),
    ['USD · Fed Rate (%)', 'USD · Payroll (k)', 'USD · Unemployment (%)', 'USD · Headline CPI m/m (%)', 'USD · Core CPI m/m (%)'])
  const colorFor = color => { const sample = document.createElement('span'); sample.style.backgroundColor = color; return sample.style.backgroundColor }
  const swatchFor = key => host.querySelector(`[data-macro-axis="${key}"]`).closest('.macro-metric-item').querySelector('.macro-control-color')
  assert.equal(host.querySelectorAll('.macro-control-color').length, 5)
  for (const key of ['rate', 'payrolls', 'unemployment', 'headlineCpi', 'coreCpi'])
    assert.equal(swatchFor(key).style.backgroundColor, colorFor(macro.preferences.series[key].color), `${key}: circle matches the line colour`)
  const headlineEye = host.querySelector('[data-macro-visibility="headlineCpi"]')
  assert.equal(headlineEye.querySelector('[data-eye-slash]').getAttribute('visibility'), 'hidden')
  const beforeEyeBounds = macroPane.priceScale('macro-coreCpi').getVisibleRange()
  await toggleLines(['headlineCpi'])
  assert.equal(headlineEye.getAttribute('aria-pressed'), 'false')
  assert.equal(headlineEye.getAttribute('aria-label'), 'Show Headline CPI m/m (%)')
  assert.equal(headlineEye.querySelector('[data-eye-slash]').getAttribute('visibility'), 'visible')
  assert.equal(headlineLine.data().length, 0); assert.equal(coreLine.data().length, 2, 'The headline eye never hides Core')
  assert.deepEqual(macroPane.priceScale('macro-coreCpi').getVisibleRange(), beforeEyeBounds)
  await React.act(async () => host.querySelector('[data-macro-axis="headlineCpi"]').click()); await render({ macro })
  assert.equal(headlineLine.data().length, 2)
  assert.equal(coreLine.options().priceScaleId, 'macro-coreCpi'); assert.equal(headlineLine.options().priceScaleId, 'right')
  assert.equal(headlineEye.querySelector('[data-eye-slash]').getAttribute('visibility'), 'hidden')
  await selectAxis('rate')
  const initialCpiY = coreLine.priceToCoordinate(0)
  const initialPayrollY = payrollLine.priceToCoordinate(200)
  macroPane.priceScale('right').setVisibleRange({ from: 4, to: 6 }); await paint()
  close(coreLine.priceToCoordinate(0), initialCpiY, 'Resizing policy leaves CPI independent')
  close(payrollLine.priceToCoordinate(200), initialPayrollY, 'Resizing policy leaves payrolls independent')
  await selectAxis('payrolls')
  assert.equal(payrollLine.options().priceScaleId, 'right')
  assert.equal(rateLine.options().priceScaleId, 'macro-rate')
  assert.equal(rateDots.options().priceScaleId, 'macro-rate')
  const unemploymentY = unemploymentLine.priceToCoordinate(4.1)
  macroPane.priceScale('right').setVisibleRange({ from: -200, to: 400 }); await paint()
  const placedPayrollY = payrollLine.priceToCoordinate(200)
  close(unemploymentLine.priceToCoordinate(4.1), unemploymentY, 'Payroll scaling leaves unemployment independent')
  close(coreLine.priceToCoordinate(0), initialCpiY, 'Payroll scaling leaves inflation independent')
  await selectAxis('unemployment')
  assert.equal(unemploymentLine.options().priceScaleId, 'right')
  assert.equal(payrollLine.options().priceScaleId, 'macro-payrolls')
  close(payrollLine.priceToCoordinate(200), placedPayrollY, 'Switching away preserves payroll placement')
  assert.deepEqual(macroPane.priceScale('macro-payrolls').getVisibleRange(), { from: -200, to: 400 })
  assert.equal(unemploymentLine.options().priceFormat.formatter(4.1), '4.10%')
  const unselectedRateY = rateLine.priceToCoordinate(5.25)
  macroPane.priceScale('right').setVisibleRange({ from: 3, to: 5 }); await paint()
  close(rateLine.priceToCoordinate(5.25), unselectedRateY, 'Resizing unemployment leaves policy independent')
  await selectAxis('coreCpi')
  assert.equal(coreLine.options().priceScaleId, 'right'); assert.equal(headlineLine.options().priceScaleId, 'macro-headlineCpi')
  assert.deepEqual(coreLine.data().map(point => point.value), [0, -0.1])
  assert.deepEqual(headlineLine.data().map(point => point.value), [0.2, 0.3])
  const inflationUnemploymentY = unemploymentLine.priceToCoordinate(4.1)
  const independentHeadlineY = headlineLine.priceToCoordinate(0.3)
  macroPane.priceScale('right').setVisibleRange({ from: -1, to: 1 }); await paint()
  close(headlineLine.priceToCoordinate(0.3), independentHeadlineY, 'Scaling Core CPI leaves Headline CPI in place')
  close(unemploymentLine.priceToCoordinate(4.1), inflationUnemploymentY, 'CPI scaling leaves unemployment independent')
  // Bind every family independently while navigating old dates and paging in
  // larger historical outliers. Native overlays must not refit on these reads.
  const fixedRanges = () => Object.fromEntries([
    ['rate', rateLine], ['payrolls', payrollLine], ['unemployment', unemploymentLine], ['coreCpi', coreLine], ['headlineCpi', headlineLine],
  ].map(([axis, line]) => [axis, macroPane.priceScale(line.options().priceScaleId).getVisibleRange()]))
  const originalMacroHeight = macroPane.getHeight(), resizeWindow = chart.timeScale().getVisibleLogicalRange()
  const placement = () => [rateLine, payrollLine, unemploymentLine, coreLine, headlineLine, rateDots]
    .map(line => [line.priceToCoordinate(0), line.priceToCoordinate(1)])
  const originalPlacement = placement()
  for (const height of [200, 90, 240, originalMacroHeight]) {
    macroPane.setHeight(height); await paint()
    placement().forEach((coordinates, index) => coordinates.forEach((value, point) => {
      close(value, originalPlacement[index][point], 'Pane resize preserves vertical position and pixels per unit on every scale')
    }))
    assert.deepEqual(chart.timeScale().getVisibleLogicalRange(), resizeWindow, 'Pane resizing preserves horizontal zoom')
  }
  await selectAxis('rate'); await selectAxis('payrolls')
  placement().forEach((coordinates, index) => coordinates.forEach((value, point) => {
    close(value, originalPlacement[index][point], 'Resized placements survive axis changes')
  }))
  const boundedRanges = fixedRanges()
  const navigateMacro = async range => {
    await React.act(async () => host.querySelector('.market-chart-canvas').dispatchEvent(new dom.WheelEvent('wheel', { bubbles: true })))
    chart.timeScale().setVisibleLogicalRange(range); await paint()
  }
  for (const axis of ['payrolls', 'rate', 'unemployment', 'coreCpi', 'payrolls']) {
    await selectAxis(axis)
    assert.deepEqual(fixedRanges(), boundedRanges, `${axis}: all families retain zoom/position`)
    close(payrollLine.priceToCoordinate(200), placedPayrollY, `${axis}: payroll position remains fixed`)
  }
  await navigateMacro({ from: 15, to: 60 })
  assert.deepEqual(fixedRanges(), boundedRanges, 'Scrolling to older releases never changes vertical bounds')
  await navigateMacro({ from: 30, to: 85 })
  assert.deepEqual(fixedRanges(), boundedRanges, 'Horizontal zoom preserves vertical bounds')
  const historicalWindow = captureDateWindow(chart.timeScale().getVisibleLogicalRange(), macroBars, 3600)
  const olderMacroBars = [...makeBars(macroBars[0].time - 100 * 3600), ...macroBars]
  const earlierRelease = (id, value) => ({ id, time: olderMacroBars[10].time + 1800, releasedAt: (olderMacroBars[10].time + 1800) * 1000, value })
  const normalHistory = macro.history
  macro = { ...macro, history: { ...macro.history,
    payrolls: [earlierRelease('old-payrolls', -20000), ...macro.history.payrolls],
    coreCpi: [earlierRelease('old-cpi', 5), ...macro.history.coreCpi],
  } }
  await render({ bars: olderMacroBars, macro })
  assert.deepEqual(fixedRanges(), boundedRanges, 'History backfill/outliers do not refit any family')
  const backfilledHistory = macro.history
  macro = { ...macro, history: { ...macro.history, payrolls: macro.history.payrolls.map((reading, index, all) => index === all.length - 1 ? { ...reading, value: 50000 } : reading) } }
  await render({ macro })
  assert.deepEqual(fixedRanges(), boundedRanges, 'A corrected actual cannot reset the chosen bounds')
  macro = { ...macro, history: backfilledHistory }; await render({ macro })
  const pagedWindow = captureDateWindow(chart.timeScale().getVisibleLogicalRange(), olderMacroBars, 3600)
  close(pagedWindow.from, historicalWindow.from, 'Backfill preserves the left date')
  close(pagedWindow.to, historicalWindow.to, 'Backfill preserves the right date and horizontal zoom')
  await navigateMacro({ from: 5, to: 80 })
  assert.deepEqual(fixedRanges(), boundedRanges, 'Older outliers stay bounded while scrolled into view')
  const untouchedBounds = { ...boundedRanges }; delete untouchedBounds.payrolls
  await React.act(async () => host.querySelector('[aria-label="Fit MFDI selected axis"]').click()); await paint()
  const refitted = fixedRanges()
  assert.notDeepEqual(refitted.payrolls, boundedRanges.payrolls, 'Fit axis deliberately refits the selected historical data')
  for (const axis of ['rate', 'unemployment', 'coreCpi', 'headlineCpi']) assert.deepEqual(refitted[axis], untouchedBounds[axis], `Fit payrolls preserves ${axis}`)
  await navigateMacro({ from: 125, to: 185 })
  assert.deepEqual(fixedRanges(), refitted, 'The fitted result is bound across subsequent scrolling')
  await selectAxis('coreCpi'); await selectAxis('payrolls')
  assert.deepEqual(fixedRanges(), refitted, 'The fitted result survives axis changes')
  macro = { ...macro, history: normalHistory }
  await render({ bars: macroBars, macro })
  await navigateMacro(rateWindow)
  macroPane.priceScale('right').setAutoScale(true); await paint()
  const nativeRefitted = fixedRanges()
  assert.notDeepEqual(nativeRefitted.payrolls, refitted.payrolls, 'Native double-click auto-fit can replace the selected bounds')
  assert.equal(macroPane.priceScale('right').options().autoScale, false, 'The native fit is bound again after paint')
  const fitAll = host.querySelector('[aria-label="Fit all MFDI axes"]')
  const lockAxes = host.querySelector('[aria-label="Link MFDI axes"]')
  assert.equal(fitAll.previousElementSibling.getAttribute('aria-label'), 'Fit MFDI selected axis')
  assert.equal(fitAll.nextElementSibling, lockAxes, 'Fit selected, Fit all and lock appear in that order')
  for (const line of [rateLine, payrollLine, unemploymentLine, coreLine, headlineLine])
    macroPane.priceScale(line.options().priceScaleId).setVisibleRange({ from: -10000, to: 10000 })
  await paint()
  const selectedBeforeFitAll = macro.preferences.axisTarget
  await React.act(async () => fitAll.click()); await paint()
  const allFitted = fixedRanges()
  for (const axis of ['rate', 'payrolls', 'unemployment', 'coreCpi', 'headlineCpi']) {
    assert.notDeepEqual(allFitted[axis], { from: -10000, to: 10000 }, `${axis}: Fit all replaces its bounds`)
  }
  assert.equal(macro.preferences.axisTarget, selectedBeforeFitAll, 'Fit all preserves the selected axis')
  assert.deepEqual(chart.timeScale().getVisibleLogicalRange(), rateWindow, 'Fit all preserves shared dates')
  const flatten = host.querySelector('[aria-label="MFDI lane view"]')
  assert.equal(lockAxes.nextElementSibling, flatten, 'The three-line button sits next to the lock')
  macro = { ...macro, preferences: { ...macro.preferences, layout: { hideLegend: true, laneMode: false, categoryOrder: [], collapsed: [], rowOrder: [] } } }; await render({ macro })
  assert.equal(host.querySelector('.macro-readout').hidden, true, 'Hide Legend hides only the actual/release readout')
  assert.ok(host.querySelector('[data-macro-forecast="rate"]'), 'Hide Legend retains the drawer F/N/eye controls')
  const beforeLaneHeight = macroPane.getHeight()
  macroPane.setHeight(300); await paint()
  const beforeFlat = placement(), beforeFlatData = macroPane.getSeries().map(line => line.data())
  laneDots.length = 0
  await React.act(async () => flatten.click()); await paint()
  assert.equal(flatten.getAttribute('aria-pressed'), 'true')
  assert.equal(host.querySelector('.macro-controls .macro-metric-item'), null, 'Series controls no longer occupy the top toolbar')
  assert.equal(host.querySelector('.macro-inline-layer [data-macro-axis="rate"]'), null, 'Plot labels have no visibility controls')
  assert.ok(host.querySelector('.macro-series-drawer [data-macro-axis="rate"]'), 'Eye/F/N controls live only in the drawer')
  assert.equal(host.querySelector('.macro-inline-layer').textContent, '', 'The plot has no event or category text')
  for (const key of ['rate', 'payrolls']) {
    const dots = laneDots.filter(dot => dot.color === macro.preferences.series[key].color)
    assert.ok(dots.length, `${key}: lane mode draws actual release dots`)
    assert.equal(new Set(dots.map(dot => dot.y)).size, 1, 'Different numeric values occupy one perfectly horizontal lane')
  }
  await React.act(async () => seriesDrawerButton.click()); await paint()
  const beforeCategoryData = macroPane.getSeries().map(line => line.data()), beforeCategoryDates = chart.timeScale().getVisibleLogicalRange()
  laneDots.length = 0
  await React.act(async () => host.querySelector('[aria-label="Collapse Labor"] span:last-child').click()); await paint()
  assert.ok(laneDots.some(dot => dot.color === macro.preferences.series.payrolls.color), 'Collapsed categories retain their plotted dots and lines')
  assert.equal(host.querySelector('[data-macro-row="payrolls"]').style.display, 'none', 'Collapse only folds the drawer children')
  for (const key of ['payrolls', 'unemployment']) assert.equal(host.querySelector(`[data-macro-axis="${key}"]`).getAttribute('aria-pressed'), 'true', 'Every child is selected together')
  assert.equal(host.querySelector('[data-macro-axis="rate"]').getAttribute('aria-pressed'), 'false')
  const categoryBeforeDots = Object.fromEntries(['payrolls', 'unemployment', 'rate'].map(key => [key, laneDots.find(dot => dot.color === macro.preferences.series[key].color).y]))
  const categoryNativeRanges = fixedRanges()
  laneDots.length = 0
  await React.act(async () => macroPane.getHTMLElement().dispatchEvent(new dom.PointerEvent('pointerdown', { bubbles: true, button: 0, clientY: 100, pointerId: 1 })))
  await React.act(async () => window.dispatchEvent(new dom.PointerEvent('pointermove', { clientY: 111, pointerId: 1 }))); await paint()
  await React.act(async () => window.dispatchEvent(new dom.PointerEvent('pointerup', { clientY: 111, pointerId: 1 }))); await paint()
  for (const key of ['payrolls', 'unemployment', 'rate']) close(laneDots.filter(dot => dot.color === macro.preferences.series[key].color).at(-1).y, categoryBeforeDots[key] + (key === 'rate' ? 0 : 11), 'Category dragging moves only its children')
  assert.deepEqual(fixedRanges(), categoryNativeRanges)
  assert.deepEqual(chart.timeScale().getVisibleLogicalRange(), beforeCategoryDates)
  assert.deepEqual(macroPane.getSeries().map(line => line.data()), beforeCategoryData)
  laneDots.length = 0
  macro = { ...macro, preferences: { ...macro.preferences, layout: { ...macro.preferences.layout, rowOffsets: {} } } }; await render({ macro })
  await React.act(async () => host.querySelector('[aria-label="Expand Labor"]').click()); await paint()
  const payrollLane = laneDots.find(dot => dot.color === macro.preferences.series.payrolls.color)
  const selectedBeforeLaneClick = inspectedReleases.length
  await fireDotClick(payrollLine, 0, { point: { x: chart.timeScale().timeToCoordinate(payrollLine.data()[0].time), y: payrollLane.y } })
  assert.equal(inspectedReleases.length, selectedBeforeLaneClick + 1, 'Straight-lane dots remain selectable')
  assert.equal(inspectedReleases.at(-1).value, -120, 'Lane hit testing retains the real actual value')
  assert.deepEqual(macroPane.getSeries().map(line => line.data()), beforeFlatData, 'Lane mode never changes numeric values or dates')
  await selectAxis('payrolls'); await paint()
  laneDots.length = 0; await React.act(async () => chart.applyOptions({})); await paint()
  const beforeSoloPayroll = laneDots.find(dot => dot.color === macro.preferences.series.payrolls.color).y
  const beforeSoloRate = laneDots.find(dot => dot.color === macro.preferences.series.rate.color).y
  const soloRanges = fixedRanges(), soloDates = chart.timeScale().getVisibleLogicalRange()
  laneDots.length = 0
  await React.act(async () => macroPane.getHTMLElement().dispatchEvent(new dom.PointerEvent('pointerdown', { bubbles: true, button: 0, clientY: 100, pointerId: 1 })))
  await React.act(async () => window.dispatchEvent(new dom.PointerEvent('pointermove', { clientY: 117, pointerId: 1 }))); await paint()
  await React.act(async () => window.dispatchEvent(new dom.PointerEvent('pointerup', { clientY: 117, pointerId: 1 }))); await paint()
  assert.equal(macro.preferences.layout.rowOffsets.payrolls, 17, 'Unlocked plot dragging freely places the selected event in lane view')
  close(laneDots.filter(dot => dot.color === macro.preferences.series.payrolls.color).at(-1).y, beforeSoloPayroll + 17, 'Only the selected flat line moves')
  close(laneDots.filter(dot => dot.color === macro.preferences.series.rate.color).at(-1).y, beforeSoloRate, 'Other straight lines retain their positions')
  assert.deepEqual(fixedRanges(), soloRanges, 'Free lane movement preserves the numerical scales for leaving lane view')
  assert.deepEqual(chart.timeScale().getVisibleLogicalRange(), soloDates)
  await React.act(async () => lockAxes.click()); await paint()
  const nativeBeforeLaneMove = fixedRanges()
  laneDots.length = 0; await React.act(async () => chart.applyOptions({})); await paint()
  await React.act(async () => macroPane.getHTMLElement().dispatchEvent(new dom.PointerEvent('pointerdown', { bubbles: true, button: 0, clientY: 100, pointerId: 1 })))
  await React.act(async () => window.dispatchEvent(new dom.PointerEvent('pointermove', { bubbles: true, clientY: 120, pointerId: 1 }))); await paint()
  await React.act(async () => window.dispatchEvent(new dom.PointerEvent('pointerup', { bubbles: true, clientY: 120, pointerId: 1 }))); await paint()
  assert.equal(macro.preferences.layout.laneOffset, 20, 'Linked dragging moves the entire lane collection')
  assert.deepEqual(fixedRanges(), nativeBeforeLaneMove, 'Lane dragging preserves the numerical axes underneath')
  const laneSpacingInput = host.querySelector('[aria-label="MFDI lane spacing"]')
  await React.act(async () => { laneSpacingInput.value = '60'; laneSpacingInput.dispatchEvent(new dom.Event('input', { bubbles: true })) }); await paint()
  assert.equal(macro.preferences.layout.laneSpacing, 60, 'Spacing remains explicitly adjustable with its slider')
  const oldSpacing = macro.preferences.layout.laneSpacing, oldOffsets = macro.preferences.layout.rowOffsets
  const scrollWindow = chart.timeScale().getVisibleLogicalRange()
  laneDots.length = 0; await React.act(async () => chart.applyOptions({})); await paint()
  const beforeScrollLane = laneDots.find(dot => dot.color === macro.preferences.series.payrolls.color).y
  laneDots.length = 0
  const wheelLane = new dom.WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 50 })
  await React.act(async () => macroPane.getHTMLElement().dispatchEvent(wheelLane)); await paint()
  assert.equal(wheelLane.defaultPrevented, true)
  assert.equal(host.querySelector('.macro-lane-scroll').scrollTop, 50, 'Wheel scrolls the vertical pane even while axes are linked')
  close(laneDots.filter(dot => dot.color === macro.preferences.series.payrolls.color).at(-1).y, beforeScrollLane - 50, 'Scrolling shifts lanes without compressing them')
  assert.equal(macro.preferences.layout.laneSpacing, oldSpacing)
  assert.deepEqual(macro.preferences.layout.rowOffsets, oldOffsets)
  assert.deepEqual(chart.timeScale().getVisibleLogicalRange(), scrollWindow)
  assert.deepEqual(fixedRanges(), nativeBeforeLaneMove)
  await React.act(async () => lockAxes.click()); await paint()
  await React.act(async () => macroPane.getHTMLElement().dispatchEvent(new dom.WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -20 }))); await paint()
  assert.equal(host.querySelector('.macro-lane-scroll').scrollTop, 30, 'Unlinked panes use the same vertical wheel scrolling')
  assert.equal(macro.preferences.layout.laneSpacing, oldSpacing)
  await React.act(async () => lockAxes.click()); await paint()
  await React.act(async () => host.querySelector('[aria-label="Fit all MFDI lanes"]').click()); await paint()
  assert.equal(macro.preferences.layout.laneOffset, 0)
  assert.deepEqual(fixedRanges(), nativeBeforeLaneMove)
  await React.act(async () => lockAxes.click()); await paint()
  assert.equal(payrollLine.options().lineVisible, false, 'Native numerical lines are replaced only visually')
  await React.act(async () => flatten.click()); await paint()
  assert.equal(flatten.getAttribute('aria-pressed'), 'false')
  placement().forEach((values, index) => values.forEach((value, point) => close(value, beforeFlat[index][point], 'Leaving lane mode restores each numerical scale')))
  macroPane.setHeight(beforeLaneHeight); await paint()
  await React.act(async () => host.querySelector('[aria-label="Collapse Inflation"]').click()); await render({ macro })
  assert.equal(macro.preferences.layout.categoryTarget, 'inflation')
  assert.equal(host.querySelectorAll('.macro-metric-axis[aria-pressed="true"]').length, 2)
  const beforeCategoryNumeric = placement(), numericCategoryRange = macroPane.priceScale('right').getVisibleRange()
  const categorySpan = numericCategoryRange.to - numericCategoryRange.from
  macroPane.priceScale('right').setVisibleRange({ from: numericCategoryRange.from + categorySpan / 5, to: numericCategoryRange.to + categorySpan / 5 }); await paint()
  const afterCategoryNumeric = placement(), categoryShift = afterCategoryNumeric[4][0] - beforeCategoryNumeric[4][0]
  assert.ok(Math.abs(categoryShift) > 1, 'The selected category actually moves in numerical view')
  afterCategoryNumeric.forEach((values, index) => values.forEach((value, point) => close(value, beforeCategoryNumeric[index][point] + ([3, 4].includes(index) ? categoryShift : 0), 'Numerical dragging selects just the category children')))
  macroPane.priceScale('right').setVisibleRange(numericCategoryRange); await paint()
  await React.act(async () => host.querySelector('[aria-label="Expand Inflation"]').click()); await paint()
  await selectAxis('payrolls')
  assert.equal(macro.preferences.layout.categoryTarget, undefined)
  await React.act(async () => lockAxes.click()); await paint()
  assert.equal(lockAxes.getAttribute('aria-pressed'), 'true')
  assert.equal(lockAxes.getAttribute('aria-label'), 'Unlink MFDI axes')
  assert.equal(fitAll.disabled, false, 'Linked axes remain adjustable')
  assert.equal(host.querySelectorAll('.macro-metric-axis[aria-pressed="true"]').length, 5, 'Linking selects all visible series')
  const nativeNavigation = structuredClone({ handleScale: chart.options().handleScale, handleScroll: chart.options().handleScroll })
  const paneElement = macroPane.getHTMLElement()
  const wheel = new dom.WheelEvent('wheel', { bubbles: true, cancelable: true })
  paneElement.dispatchEvent(wheel)
  assert.equal(wheel.defaultPrevented, false, 'Linked MFDI gestures remain enabled')
  const groupedPlacement = placement()
  for (const kind of ['pan', 'zoom']) {
    const before = placement(), range = macroPane.priceScale('right').getVisibleRange(), span = range.to - range.from
    const next = kind === 'pan' ? { from: range.from + span / 5, to: range.to + span / 5 }
      : { from: range.from + span / 5, to: range.to - span / 5 }
    macroPane.priceScale('right').setVisibleRange(next); await paint()
    const after = placement(), source = 1 // Payroll is the selected right axis.
    const zoom = (after[source][1] - after[source][0]) / (before[source][1] - before[source][0])
    const shift = after[source][0] - before[source][0] * zoom
    assert.ok(Math.abs(zoom - 1) > 1e-5 || Math.abs(shift) > 1, 'The selected scale actually moves')
    after.forEach((coordinates, index) => coordinates.forEach((value, point) => {
      close(value, before[index][point] * zoom + shift, `${kind}: every scale receives the same screen transform`)
    }))
  }
  assert.notDeepEqual(placement(), groupedPlacement)
  assert.deepEqual({ handleScale: chart.options().handleScale, handleScroll: chart.options().handleScroll }, nativeNavigation)
  await React.act(async () => fitAll.click()); await paint()
  const selectedReleasesBeforeLink = inspectedReleases.length
  await hoverDot(); await fireDotClick(rateDots, 0)
  assert.equal(host.querySelector('[aria-label="MFDI release details"]').hidden, false, 'Hover works with linked axes')
  assert.equal(inspectedReleases.length, selectedReleasesBeforeLink + 1, 'Release selection works with linked axes')
  await hoverDot(rateDots, 0, { point: undefined })
  await React.act(async () => lockAxes.click()); await paint()
  assert.equal(lockAxes.getAttribute('aria-pressed'), 'false')
  assert.equal(host.querySelectorAll('.macro-metric-axis[aria-pressed="true"]').length, 1, 'Unlinking restores individual selection')
  for (const [axis, line] of [['rate', rateLine], ['payrolls', payrollLine], ['unemployment', unemploymentLine], ['coreCpi', coreLine], ['headlineCpi', headlineLine]])
    macroPane.priceScale(line.options().priceScaleId).setVisibleRange(nativeRefitted[axis])
  await paint()
  const beforeVisibility = fixedRanges()
  assert.match(host.querySelector('.macro-readout').textContent, /200k.*Released.*Unemployment 4.10%/)
  const coreValues = coreLine.data(), payrollValues = payrollLine.data()
  macro = { ...macro, preferences: { ...macro.preferences, series: { ...macro.preferences.series,
    coreCpi: { ...macro.preferences.series.coreCpi, color: '#123456', lineWidth: 4, pointsVisible: false },
    payrolls: { ...macro.preferences.series.payrolls, lineWidth: 3, pointsVisible: false } } } }
  await render({ macro })
  assert.equal(coreLine.options().color, '#123456'); assert.equal(coreLine.options().lineWidth, 4)
  assert.equal(swatchFor('coreCpi').style.backgroundColor, colorFor('#123456'), 'The circle follows Style changes')
  assert.equal(coreLine.options().pointMarkersVisible, false)
  assert.equal(payrollLine.options().lineWidth, 3); assert.equal(payrollLine.options().pointMarkersVisible, false)
  assert.deepEqual(coreLine.data(), coreValues); assert.deepEqual(payrollLine.data(), payrollValues)
  await selectAxis('coreCpi')
  await toggleLines(['coreCpi', 'headlineCpi'])
  assert.equal(coreLine.data().length, 0); assert.equal(headlineLine.data().length, 0)
  assert.ok([rateLine, payrollLine, unemploymentLine].every(line => line.data().length > 0), 'Hiding inflation preserves the other categories')
  assert.equal(rateLine.options().priceScaleId, 'right', 'Hiding the active scale automatically selects a visible scale')
  await toggleLines(['rate'])
  assert.equal(rateLine.data().length, 0); assert.equal(rateDots.data().length, 0)
  assert.ok(payrollLine.data().length > 0)
  await toggleLines(['payrolls', 'unemployment'])
  assert.ok(macroPane.getSeries().every(series => series.data().length === 0))
  assert.match(host.querySelector('.macro-note').textContent, /All series hidden/)
  assert.equal(host.querySelectorAll('[data-macro-row]').length, 5, 'All five drawer rows survive hidden data')
  assert.equal(host.querySelectorAll('.macro-controls select').length, 0, 'The chips replace the axis dropdown')
  await selectAxis('coreCpi')
  assert.equal(macro.preferences.series.coreCpi.visible, true)
  assert.equal(macro.preferences.series.rate.visible, false)
  assert.ok(coreLine.data().length > 0 && headlineLine.data().length === 0, 'Selecting Core reveals only Core, preserving the hidden Headline sibling')
  await toggleLines(['headlineCpi'])
  await toggleLines(['payrolls', 'unemployment']); await toggleLines(['rate'])
  assert.equal(host.querySelectorAll('.macro-readout .macro-field').length, 5)
  assert.deepEqual(fixedRanges(), beforeVisibility, 'Individual eyes preserve every axis range')
  assert.deepEqual(chart.timeScale().getVisibleLogicalRange(), rateWindow, 'Overlay toggles/axes preserve shared dates')
  assert.deepEqual(chart.priceScale('right').getVisibleRange(), ratePriceRange, 'Macro axes never alter price scaling')
  await render({ macro: { ...macro, enabled: false } })
  assert.equal(chart.panes().length, 3)
  assert.equal(host.querySelector('.macro-legend'), null)
  await render({ macro })
  assert.equal(chart.panes().length, 4)
  await render({ symbol: 'EURUSD', fitContentKey: 'EURUSD:H1' })
  assert.equal(chart.panes().length, 4, 'MFDI is available on FX pairs as well as indices')
  assert.ok(host.querySelector('.macro-legend'))
  const originalMacro = macro
  macro = { ...macro, preferences: { ...defaultMacroPreferences, enabled: true, currencies: [], eventsByCurrency: {} }, history: {}, status: '' }
  await render({ macro })
  assert.equal(host.querySelectorAll('[data-macro-row]').length, 0, 'An empty symbol has no preselected drawer rows')
  assert.ok([...host.querySelectorAll('[data-macro-all]')].every(button => button.disabled), 'Universal controls are disabled without selected events')
  assert.match(host.querySelector('.macro-note').textContent, /Choose currencies/)
  assert.ok(chart.panes().at(-1).getSeries().every(line => line.data().length === 0))
  const { macroCatalog } = await server.ssrLoadModule('./src/market-data/indicators/macro/macro-catalog.ts')
  const dynamicKey = Object.keys(macroCatalog).find(key => macroCatalog[key].currency === 'EUR')
  const dynamicPreferences = setMacroEvents(setMacroCurrency(macro.preferences, 'EUR', true), 'EUR', [dynamicKey])
  dynamicPreferences.series[dynamicKey] = { ...dynamicPreferences.series[dynamicKey], numbersVisible: true }
  const dynamicReading = { ...monthly('eur-reading', 65, 0.3), currency: 'EUR', unit: 1, digits: 2, forecast: 0.2, previous: 0.1 }
  macro = { ...macro, preferences: dynamicPreferences, history: { [dynamicKey]: [dynamicReading] } }
  const dynamicWindow = chart.timeScale().getVisibleLogicalRange()
  await render({ macro })
  assert.equal(host.querySelectorAll('[data-macro-row]').length, 1)
  assert.equal(host.querySelector('[data-macro-axis]').dataset.macroAxis, dynamicKey)
  const dynamicLine = chart.panes().at(-1).getSeries().find(line => line.data().length)
  assert.equal(dynamicLine.data()[0].value, 0.3, 'Dynamically added events reach native plotted series')
  assert.equal(dynamicLine.options().priceFormat.formatter(0.3), '0.30%')
  assert.deepEqual(chart.timeScale().getVisibleLogicalRange(), dynamicWindow, 'Changing selected currencies preserves shared dates')
  assert.equal(host.querySelector('.macro-note').hidden, true, 'Successful charts have no static source/status text')
  await React.act(async () => { for (const listener of nativeCrosshairListeners) listener({
    point: { x: chart.timeScale().timeToCoordinate(dynamicLine.data()[0].time), y: dynamicLine.priceToCoordinate(0.3) },
    time: dynamicLine.data()[0].time, paneIndex: chart.panes().length - 1, seriesData: new Map(), hoveredInfo: { series: dynamicLine },
  }) }); await paint()
  const dynamicCard = host.querySelector('[aria-label="MFDI release details"]')
  assert.equal(dynamicCard.hidden, false, 'Non-Fed events have release cards even when Fed is not selected')
  assert.deepEqual([...dynamicCard.querySelectorAll('td')].map(node => node.textContent), ['0.30%', '0.20%', '0.10%'])
  await fireDotClick(dynamicLine, 0, { paneIndex: chart.panes().length - 1 })
  assert.equal(inspectedReleases.at(-1).currency, 'EUR', 'Dynamic dots retain currency for Inspector selection')
  macro = originalMacro
  const macroH4 = macroBars.map((bar, i) => ({ ...bar, time: macroBars[0].time + i * 14400 }))
  await render({ symbol: 'USDX', fitContentKey: 'USDX:H4', timeframe: 'H4', bars: macroH4,
    rsi: { ...defaultRsiPreferences, enabled: false }, volume: { ...defaultVolumePreferences, enabled: false } })
  assert.equal(chart.panes().length, 2)
  assert.ok(macroH4.every((bar, index) => chart.timeScale().timeToIndex(bar.time) === index), 'Timeframe changes leave no H1 indicator timestamps')
  await render({ macro: { ...macro, history: { rate: [], payrolls: [], unemployment: [], coreCpi: [], headlineCpi: [] }, status: 'Loading macro releases…' } })
  assert.ok(chart.panes()[1].getSeries().every(series => series.data().length === 0))
  assert.match(host.querySelector('.macro-legend').textContent, /Loading macro releases/)
  await render({ bars: [], macro })
  assert.ok(chart.panes()[1].getSeries().every(series => series.data().length === 0))
  console.log('✓ MFDI real chart: five overlaid lines/dots, independent eye controls/five axes, linked pan/zoom, separate CPI scales, raw release points, hidden/empty data, dates, Volume/RSI and scope cleanup')
  await React.act(async () => root.render(null)); await paint()
  await React.act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(MarketCandlestickChart, { ...props, bars: macroBars, macro, volume }))))
  await paint(); assert.equal(host.querySelectorAll('.volume-legend').length, 1)
  assert.equal(host.querySelectorAll('.macro-legend').length, 1, 'StrictMode leaves one MFDI pane and legend')
  console.log('✓ Volume real chart: raw/relative/native pane order, independent toggles, live volume-only updates, scope reset, settings and StrictMode cleanup')
  console.log('✓ RSI real chart: native panes/scale/time/crosshair, resize and gesture isolation, live/history/scope updates, style/empty/toggle, dialog drafts/validation/focus and StrictMode cleanup')
} catch (error) {
  console.error(error)
  throw error
} finally {
  await React.act(async () => { root.unmount(); dialogRoot.unmount() })
  assert.equal(frames.size, 0, 'Chart removal cancels native and indicator frames')
  assert.equal(nativeClickListeners.size, 0, 'Removing panes and overlays removes every click listener')
  assert.equal(nativeCrosshairListeners.size, 0, 'Removing panes removes every crosshair listener')
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
