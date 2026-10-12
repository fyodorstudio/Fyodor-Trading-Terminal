import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

// Real installed chart APIs; canvas painting is a no-op. No visual/browser audit.
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, navigator: dom.navigator, location: dom.location,
  HTMLElement: dom.HTMLElement, ResizeObserver: dom.ResizeObserver, getComputedStyle: dom.getComputedStyle.bind(dom) }
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const frames = new Map(), contexts = new WeakMap(); let nextFrame = 0
dom.requestAnimationFrame = fn => { frames.set(++nextFrame, fn); return nextFrame }
dom.cancelAnimationFrame = id => frames.delete(id)
dom.HTMLCanvasElement.prototype.getContext = function () {
  if (!contexts.has(this)) contexts.set(this, new Proxy({ canvas: this,
    measureText: text => ({ width: String(text).length * 7, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 3 }) },
  { get: (target, key) => target[key] ?? (() => {}), set: (target, key, value) => { target[key] = value; return true } }))
  return contexts.get(this)
}
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const { createChart, CandlestickSeries, LineSeries } = await import('../node_modules/lightweight-charts/dist/lightweight-charts.development.mjs')
const chartHost = document.createElement('div'); document.body.append(chartHost)
const paint = () => {
  for (let pass = 0; frames.size && pass < 10; pass++) {
    const pending = [...frames]; frames.clear(); for (const [, fn] of pending) fn(performance.now())
  }
  assert.equal(frames.size, 0, 'The axis settles without a redraw loop')
}
const at = Date.UTC(2026, 9, 12, 12) / 1000, horizon = 90 * 86400
const candle = time => ({ time, open: 1, high: 2, low: .5, close: 1.5 })
let chart
try {
  const { createFutureTimeline } = await server.ssrLoadModule('./src/market-data/candlestick-chart/future-timeline.ts')
  const { drawingCoordinates } = await server.ssrLoadModule('./src/market-data/chart-drawings/drawing-coordinates.ts')
  const { inspectorMarkerCoordinate } = await server.ssrLoadModule('./src/inspector/marker-position.ts')
  const { formatChartTick, formatChartCrosshairTime } = await server.ssrLoadModule('./src/appearance/time-display/time-display-preference.ts')
  for (const step of [60, 300, 900, 1800, 3600, 14400, 86400]) {
    let sets = 0, updates = 0, rows = []
    const timeline = createFutureTimeline({ setData: next => { sets++; rows = next }, update: () => updates++ })
    let bars = [candle(at - step), candle(at)]
    timeline.sync(bars, step)
    const end = Math.floor(at / 86400) * 86400 + horizon + 86400
    assert.equal(rows.length, Math.ceil((end - at) / step) - 1); assert.equal(rows[0].time, at + step)
    assert.ok(rows.at(-1).time >= at + horizon && rows.at(-1).time < end)
    assert.ok(rows.slice(0, -1).every(row => Object.keys(row).length === 1))
    assert.equal(rows.at(-1).value, 0, 'Only the hidden horizon anchor has an inert plot value')
    for (let i = 0; i < 100; i++) timeline.sync(bars.map(row => ({ ...row, close: 1 + i / 100 })), step, false, true)
    assert.equal(sets, 1); assert.equal(updates, 0, 'Repeated quote/correction snapshots do no axis data work')
    bars = [...bars, candle(at + step)]; timeline.sync(bars, step)
    assert.ok(rows.at(-1).time >= bars.at(-1).time + horizon - step)
    assert.equal(updates, 0); assert.equal(sets, step < 86400 ? 1 : 2, 'Same-day candles reuse the horizon')
    const setCount = sets
    timeline.sync([candle(at - 2 * step), ...bars], step, false, true)
    assert.equal(sets, setCount, 'Backfill retains the same future horizon')
    timeline.clear(); assert.equal(rows.length, 0)
  }
  // M1 reuses its horizon for a day, then rebases once at midnight.
  let sets = 0, updates = 0, rows = []
  const cached = createFutureTimeline({ setData: next => { sets++; rows = next }, update: () => updates++ })
  cached.sync([candle(at)], 60)
  for (let i = 1; i <= 1440; i++) cached.sync([candle(at + i * 60)], 60)
  assert.equal(sets, 2); assert.equal(updates, 0); assert.ok(rows.length >= 129600 && rows.length <= 131040)

  const ticks = [], utc = { mode: 'utc', utcOffsetMinutes: 0 }
  chart = createChart(chartHost, { width: 800, height: 400, autoSize: false,
    layout: { colorParsers: [color => /^#[\da-f]{6}$/i.test(color) ? [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16)).concat(1) : null] },
    timeScale: { timeVisible: true, ignoreWhitespaceIndices: false, tickMarkFormatter: (time, type) => {
      ticks.push({ time, label: formatChartTick(time, type, utc) }); return ticks.at(-1).label
    } }, localization: { timeFormatter: time => formatChartCrosshairTime(time, utc) } })
  const price = chart.addSeries(CandlestickSeries)
  const timeSeries = chart.addSeries(LineSeries, { priceScaleId: '', visible: false, lineVisible: false, priceLineVisible: false,
    lastValueVisible: false, crosshairMarkerVisible: false })
  let futureSets = 0, futureUpdates = 0
  const future = createFutureTimeline({ setData: rows => { futureSets++; timeSeries.setData(rows) },
    update: row => { futureUpdates++; timeSeries.update(row) } })
  let bars = [candle(at - 60), candle(at)]
  price.setData(bars)
  const started = performance.now(); future.sync(bars, 60); const initialMs = performance.now() - started
  const scale = chart.timeScale(), futureTime = at + 2 * 86400
  scale.setVisibleLogicalRange({ from: 2870, to: 2900 }); paint()
  assert.ok(ticks.some(tick => tick.time > at && tick.label), 'The real chart formats native x-axis labels past the last candle')
  const x = scale.timeToCoordinate(futureTime)
  assert.notEqual(x, null); assert.equal(scale.coordinateToTime(x), futureTime)
  assert.equal(scale.timeToIndex(at + horizon), 129601, 'All 90 days have actual axis coordinates')
  assert.equal(price.data().length, 2); assert.equal(price.dataByIndex(100), null, 'Future slots have no candle prices')
  const originalPrices = price.data().map(row => [row.time, row.open, row.high, row.low, row.close])
  const hover = []
  chart.subscribeCrosshairMove(event => hover.push(event))
  const canvas = chart.panes()[0].getHTMLElement().querySelector('canvas:last-of-type')
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0 })
  for (const type of ['mouseenter', 'mousemove']) canvas.dispatchEvent(new dom.MouseEvent(type, { clientX: x, clientY: 100, view: dom }))
  paint()
  assert.equal(hover.at(-1).time, futureTime, 'Native crosshair exposes the future timestamp')
  assert.equal(hover.at(-1).seriesData.has(price), false, 'Future crosshair does not report fabricated prices')
  assert.equal(drawingCoordinates(chart, price, bars, 'M1').timeToX(futureTime), x)
  assert.equal(inspectorMarkerCoordinate(scale, { projection: { anchorTime: at, barsAhead: 2880 } }), x,
    'Event icons and drawing anchors share the native future axis')
  const window = scale.getVisibleLogicalRange()
  bars = [...bars, candle(at + 60)]
  const advanced = performance.now(); price.update(bars.at(-1)); future.sync(bars, 60); const advanceMs = performance.now() - advanced
  paint()
  assert.equal(futureSets, 1); assert.equal(futureUpdates, 0)
  assert.ok(Math.abs(scale.getVisibleLogicalRange().from - window.from) < 1e-6, 'Future-space pan stays put on a new candle')
  assert.deepEqual(price.data().slice(0, 2).map(row => [row.time, row.open, row.high, row.low, row.close]), originalPrices)
  // Removing an occupied retained slot must remove its old timestamp entirely.
  const corrected = [bars[0], bars[1], candle(at + 90), candle(at + 120)]
  price.setData(corrected); future.sync(corrected, 60, false, true); paint()
  assert.equal(scale.timeToIndex(at + 60), null, 'Interior timeline corrections leave no stale whitespace candle slots')
  // A session gap is not backfilled with whitespace after trading resumes.
  bars = [...corrected, candle(at + 3 * 86400)]
  price.setData(bars); future.sync(bars, 60, false, true); paint()
  assert.equal(scale.timeToIndex(at + 86400), null, 'A resumed session removes projected weekend slots from history')
  assert.equal(scale.timeToIndex(bars.at(-1).time), bars.length - 1)
  assert.equal(scale.timeToIndex(bars.at(-1).time + horizon), bars.length - 1 + 129600)
  future.clear(); paint(); assert.equal(scale.timeToIndex(bars.at(-1).time + horizon), null)
  // Also measure against a substantial loaded price history, not just two bars.
  const largeBars = Array.from({ length: 40000 }, (_, i) => candle(at - (39999 - i) * 60))
  price.setData(largeBars)
  const largeStart = performance.now(); future.sync(largeBars, 60); const largeInitialMs = performance.now() - largeStart
  const newBar = candle(at + 60), largeAdvance = performance.now()
  price.update(newBar); const priceAdvanceMs = performance.now() - largeAdvance
  const syncStart = performance.now()
  future.sync([...largeBars, newBar], 60); const largeAdvanceMs = performance.now() - largeAdvance
  const syncMs = performance.now() - syncStart
  paint()
  assert.equal(price.data().length, 40001)
  assert.equal(scale.timeToIndex(newBar.time + horizon), 40000 + 129600)
  console.log(`✓ Real chart future ticks/crosshair, 90-day horizon on seven timeframes, cached M1 work, prices, icons/drawings, corrections/session gaps; M1 setup/new candle ${initialMs.toFixed(1)}/${advanceMs.toFixed(1)}ms; with 40,000 candles ${largeInitialMs.toFixed(1)}/${largeAdvanceMs.toFixed(1)}ms (price ${priceAdvanceMs.toFixed(1)}ms, horizon reuse ${syncMs.toFixed(1)}ms; no-op canvas)`)
} finally {
  chart?.remove(); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
