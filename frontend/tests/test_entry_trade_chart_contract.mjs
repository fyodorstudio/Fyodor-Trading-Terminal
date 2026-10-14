import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

// Real chart API and production overlays; canvas painting is a no-op.
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node,
  navigator: dom.navigator, location: dom.location, ResizeObserver: dom.ResizeObserver,
  getComputedStyle: dom.getComputedStyle.bind(dom), IS_REACT_ACT_ENVIRONMENT: true }
const old = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const frames = new Map(), captures = new Set(); let sequence = 0
window.requestAnimationFrame = fn => { frames.set(++sequence, fn); return sequence }
window.cancelAnimationFrame = id => frames.delete(id)
dom.SVGElement.prototype.setPointerCapture = id => captures.add(id)
dom.SVGElement.prototype.hasPointerCapture = id => captures.has(id)
dom.SVGElement.prototype.releasePointerCapture = id => captures.delete(id)
const contexts = new WeakMap()
dom.HTMLCanvasElement.prototype.getContext = function () {
  if (!contexts.has(this)) contexts.set(this, new Proxy({ canvas: this, measureText: text => ({ width: String(text).length * 7, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 3 }) },
    { get: (target, key) => target[key] ?? (() => {}), set: (target, key, value) => { target[key] = value; return true } }))
  return contexts.get(this)
}
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const { createRoot } = await import('react-dom/client')
const { createChart, CandlestickSeries, LineSeries } = await import('../node_modules/lightweight-charts/dist/lightweight-charts.development.mjs')
const host = document.createElement('div'); document.body.append(host)
const chartHost = document.createElement('div'), overlayHost = document.createElement('div'); host.append(chartHost, overlayHost)
const root = createRoot(overlayHost)
let chart, committed = []
const close = (a, b, message) => assert.ok(Math.abs(a - b) < 0.001, `${message}: ${a} vs ${b}`)
async function paint() {
  await React.act(async () => { for (let pass = 0; frames.size && pass < 15; pass++) { const pending = [...frames]; frames.clear(); for (const [, fn] of pending) fn(performance.now()) } })
  assert.equal(frames.size, 0, 'Chart and overlay settle without redraw loops')
}
const pointer = (element, type, x, y) => React.act(async () => element.dispatchEvent(new dom.PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0, clientX: x + 37, clientY: y + 81 })))
try {
  const { PlannedTradePriceLines } = await server.ssrLoadModule('./src/entry-trade/chart-levels/PlannedTradePriceLines.tsx')
  const { createFutureTimeline } = await server.ssrLoadModule('./src/market-data/candlestick-chart/future-timeline.ts')
  const { drawingCoordinates } = await server.ssrLoadModule('./src/market-data/chart-drawings/drawing-coordinates.ts')
  const { arrowTimeAt, hasArrowCandle } = await server.ssrLoadModule('./src/entry-trade/chart-levels/arrow-time.ts')
  chart = createChart(chartHost, { width: 800, height: 400, autoSize: false, layout: { colorParsers: [color => /^#[\da-f]{6}$/i.test(color) ? [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16)).concat(1) : null] }, crosshair: { mode: 0 }, localization: { locale: 'en-US' } })
  const price = chart.addSeries(CandlestickSeries), timeline = chart.addSeries(LineSeries, { visible: false, priceScaleId: '', crosshairMarkerVisible: false })
  let bars = Array.from({ length: 10 }, (_, index) => ({ time: 1791950400 + index * 60, open: 10, high: 12, low: 8, close: 11 }))
  price.setData(bars); createFutureTimeline(timeline).sync(bars, 60)
  chart.timeScale().setVisibleLogicalRange({ from: -1, to: 18 }); await paint()
  const scope = () => drawingCoordinates(chart, price, bars, 'M1')
  let arrows = [{ id: 'future', symbol: 'EURUSD', time: bars.at(-1).time + 3 * 60, eventAt: '2026-10-14T12:30:00Z',
    direction: 'long', entryPrice: 10, slPrice: null, tpPrice: null, slPips: null, tpPips: null, rrRatio: null, note: 'Thesis', createdAt: 1 }]
  const initialPriceData = JSON.stringify(price.data()), anchor = arrows[0].eventAt
  const canvas = chart.panes()[0].getHTMLElement().querySelector('canvas:last-of-type')
  canvas.getBoundingClientRect = () => ({ left: 37, top: 81 })
  const moves = []; chart.subscribeCrosshairMove(event => moves.push(event))
  const props = { chartApi: chart, seriesApi: price, arrows, selectedArrowId: 'future', draftPlan: { direction: 'waiting', entryPrice: null, slPrice: null, tpPrice: null, showOnChart: false },
    precision: 5, dragEnabled: true, scopeKey: 'EURUSD:M1', bars, timeframe: 'M1', onSelectArrow() {}, onPriceChange() {},
    onTimeChange: (id, time) => { committed.push({ id, time }); arrows = arrows.map(item => item.id === id ? { ...item, time } : item) } }
  const render = async (extra = {}) => { await React.act(async () => root.render(React.createElement(PlannedTradePriceLines, { ...props, arrows, bars, ...extra }))); await paint() }
  await render()
  const glyph = () => overlayHost.querySelector('.trade-projected-arrow')
  assert.ok(glyph(), 'Future arrow has its own glyph, not a marker snapped to the last candle')
  const x = scope().timeToX(arrows[0].time), y = price.priceToCoordinate(10)
  close(Number(glyph().getAttribute('transform').match(/translate\(([^,]+)/)[1]), x, 'Future glyph uses the exact projected timestamp')
  assert.equal(JSON.stringify(price.data()), initialPriceData, 'Future arrows do not invent price candles')
  const handle = overlayHost.querySelector('.trade-arrow-handle'), svg = handle.closest('svg')
  await pointer(handle, 'pointerdown', x, y)
  const targetTime = bars.at(-1).time + 6 * 60, targetX = scope().timeToX(targetTime)
  await React.act(async () => { for (let i = 0; i < 100; i++) svg.dispatchEvent(new dom.PointerEvent('pointermove', { bubbles: true, pointerId: 1, pointerType: 'mouse', clientX: targetX + 37, clientY: y + 81 })) })
  assert.equal(committed.length, 0, 'Drag preview never persists intermediate timestamps')
  await paint()
  assert.ok(moves.length > 0)
  close(moves.at(-1).point.x, targetX, 'Native crosshair remains at the drag cursor')
  assert.equal(moves.at(-1).time, targetTime, 'Native crosshair exposes the future axis time')
  assert.equal(Number(glyph().dataset.arrowTime), targetTime)
  await pointer(svg, 'pointerup', targetX, y); await render()
  assert.equal(committed.at(-1).time, targetTime, 'Release saves a future time without clamping to the last candle')
  assert.equal(arrows[0].eventAt, anchor)
  assert.equal(captures.size, 0)
  const nextHandle = overlayHost.querySelector('.trade-arrow-handle')
  await pointer(nextHandle, 'pointerdown', targetX, y)
  await pointer(nextHandle.closest('svg'), 'pointermove', scope().timeToX(targetTime + 60), y); await paint()
  await React.act(async () => window.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape' }))); await paint()
  assert.equal(committed.length, 1, 'Escape restores preview without saving')
  assert.equal(Number(glyph().dataset.arrowTime), targetTime)
  assert.equal(captures.size, 0)
  await render({ dragEnabled: false })
  assert.ok(glyph(), 'Future arrows remain visible while other drawing tools are active')
  assert.equal(overlayHost.querySelector('.trade-arrow-handle'), null)
  for (const timeframe of ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1']) {
    assert.ok(arrowTimeAt(14, bars, timeframe) > bars.at(-1).time, `${timeframe}: future placement is not candle-clamped`)
  }
  assert.equal(hasArrowCandle(targetTime, bars), false)
  bars = [...bars, ...Array.from({ length: 6 }, (_, index) => ({ ...bars.at(-1), time: bars.at(-1).time + (index + 1) * 60 }))]
  price.setData(bars); await render()
  assert.equal(hasArrowCandle(targetTime, bars), true)
  assert.equal(glyph(), null, 'A real candle takes over without a duplicate future glyph')
  assert.equal(arrows[0].time, targetTime)
  await React.act(async () => root.unmount()); await paint()
  assert.equal(captures.size, 0)
  console.log('Trade arrows: real future projection without candles, native crosshair/time labels during drag, anchor independence, cancellation, seven timeframes and cleanup passed.')
} finally {
  await React.act(async () => root.unmount()); chart?.remove(); await server.close(); await dom.happyDOM.close()
  for (const [key, value] of old) { if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key] }
}
