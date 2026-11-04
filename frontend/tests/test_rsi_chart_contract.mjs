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
const frames = new Map(), contexts = new WeakMap(); let frameId = 0
dom.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId }
dom.cancelAnimationFrame = id => frames.delete(id)
dom.HTMLCanvasElement.prototype.getContext = function () {
  if (!contexts.has(this)) contexts.set(this, new Proxy({ canvas: this,
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
    load(id) { if (id === '\0rsi-chart-library') return 'export const { CandlestickSeries, LineSeries, LineStyle, ColorType, CrosshairMode, TickMarkType, createChart } = globalThis.__rsiChartLibrary' },
  }] })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'), dialogHost = document.createElement('div'); document.body.append(host, dialogHost)
const root = createRoot(host), dialogRoot = createRoot(dialogHost)
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} vs ${expected}`)
async function paint() {
  await React.act(async () => {
    for (let pass = 0; frames.size && pass < 20; pass++) {
      const pending = [...frames]; frames.clear(); for (const [, fn] of pending) fn(performance.now())
    }
  })
  assert.equal(frames.size, 0, 'The pane, label and price overlays settle without a redraw loop')
}
const reactProps = element => element[Object.getOwnPropertyNames(element).find(key => key.startsWith('__reactProps$'))]
try {
  const { MarketCandlestickChart } = await server.ssrLoadModule('./src/market-data/candlestick-chart/MarketCandlestickChart.tsx')
  const { defaultChartAppearance } = await server.ssrLoadModule('./src/market-data/chart-settings/chart-appearance-preference.ts')
  const { defaultRsiPreferences } = await server.ssrLoadModule('./src/market-data/indicators/rsi/rsi-preferences.ts')
  const { RsiSettingsDialog } = await server.ssrLoadModule('./src/market-data/indicators/rsi/RsiSettingsDialog.tsx')
  const { replaceRecentBars } = await server.ssrLoadModule('./src/market-data/mt5-feed/market-snapshots.ts')
  const makeBars = (start, step = 3600) => Array.from({ length: 100 }, (_, i) => ({ time: start + i * step,
    open: 100, high: 106, low: 94, close: 100 + Math.sin(i / 3) * 4 }))
  let bars = makeBars(1700000000), rsi = defaultRsiPreferences
  let props = { bars, rsi, fitContentKey: 'EURUSD:H1', symbol: 'EURUSD', precision: 5, theme: 'light', appearance: defaultChartAppearance,
    timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 }, timeframe: 'H1', activeDrawingTool: null, drawings: [], selectedDrawingId: null,
    onSelectDrawing() {}, onCreateDrawing() { return '' }, onUpdateDrawingPoint() {}, onUpdatePositionWidth() {},
    onExitDrawingMode() {}, onDataApplied() {}, hasOlderData: false, isLoadingOlderData: false, onRequestOlderData() {} }
  const render = async (next = {}) => { props = { ...props, ...next }; await React.act(async () => root.render(React.createElement(MarketCandlestickChart, props))); await paint() }
  await render()
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
  const [line, average] = chart.panes()[1].getSeries()
  assert.equal(line.data().length, 86); assert.equal(average.data().length, 73)
  assert.equal(line.dataByIndex(13), null); assert.ok('value' in line.dataByIndex(14))
  assert.equal(average.dataByIndex(26), null); assert.ok('value' in average.dataByIndex(27))
  assert.equal(line.options().color, '#7e57c2')
  assert.ok(line.priceToCoordinate(0) > line.priceToCoordinate(100), 'RSI has an independent 0–100 scale')
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
  bars = replaceRecentBars(bars, [{ ...bars.at(-1), close: 105 }]); await render({ bars })
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
