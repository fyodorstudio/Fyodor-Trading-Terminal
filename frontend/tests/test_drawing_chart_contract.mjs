import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

// Exercise the installed chart's real coordinate APIs and drawing lifecycle.
// Canvas painting is a no-op: this is a terminal-based contract test, with no
// browser automation, screenshot inspection or visual assertions.
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node,
  navigator: dom.navigator, location: dom.location, ResizeObserver: dom.ResizeObserver, getComputedStyle: dom.getComputedStyle.bind(dom), IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const frames = new Map(); let frameId = 0
dom.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId }
dom.cancelAnimationFrame = id => frames.delete(id)
const contexts = new WeakMap()
dom.HTMLCanvasElement.prototype.getContext = function () {
  if (!contexts.has(this)) contexts.set(this, new Proxy({ canvas: this,
    measureText: text => ({ width: String(text).length * 7, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 3 }),
  }, { get: (target, key) => target[key] ?? (() => {}), set: (target, key, value) => { target[key] = value; return true } }))
  return contexts.get(this)
}
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const { createRoot } = await import('react-dom/client')
const { createChart, CandlestickSeries } = await import('../node_modules/lightweight-charts/dist/lightweight-charts.development.mjs')
const host = document.createElement('div'); document.body.appendChild(host)
const chartHost = document.createElement('div'); host.appendChild(chartHost)
const overlayHost = document.createElement('div'); host.appendChild(overlayHost)
const root = createRoot(overlayHost)
let chart
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} vs ${expected}`)
async function paint() {
  await React.act(async () => {
    for (let pass = 0; frames.size && pass < 10; pass++) {
      const pending = [...frames]; frames.clear()
      for (const [, frame] of pending) frame(performance.now())
    }
  })
  assert.equal(frames.size, 0, 'Chart and overlay settle without a redraw loop')
}

try {
  const { drawingCoordinates } = await server.ssrLoadModule('./src/market-data/chart-drawings/drawing-coordinates.ts')
  const { ChartDrawingOverlay } = await server.ssrLoadModule('./src/market-data/chart-drawings/ChartDrawingOverlay.tsx')
  const { drawingTools } = await server.ssrLoadModule('./src/market-data/chart-drawings/drawing-tool.ts')
  chart = createChart(chartHost, { width: 800, height: 400, autoSize: false,
    layout: { colorParsers: [color => {
      if (!/^#[\da-f]{6}$/i.test(color)) return null
      return [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16)).concat(1)
    }] },
    timeScale: { barSpacing: 40, rightOffset: 8 }, localization: { locale: 'en-US' } })
  const series = chart.addSeries(CandlestickSeries)
  let bars = Array.from({ length: 10 }, (_, i) => ({ time: 1700000000 + i * 60, open: 10, high: 12, low: 8, close: 11 }))
  series.setData(bars)
  chart.timeScale().setVisibleLogicalRange({ from: -2, to: 15 })
  await paint()
  const scale = chart.timeScale()
  const coordinates = () => drawingCoordinates(chart, series, bars, 'M1')
  // Integer chart slots are the contract; the drawing layer owns interpolation.
  const xAt = logical => {
    const index = Math.floor(logical)
    const left = scale.logicalToCoordinate(index)
    const right = scale.logicalToCoordinate(index + 1)
    assert.notEqual(left, null); assert.notEqual(right, null)
    return left + (right - left) * (logical - index)
  }
  const y = series.priceToCoordinate(10)
  assert.notEqual(y, null)
  for (const logical of [-.25, 0, .25, 3.75, 9, 10.5, 12.25]) {
    const x = xAt(logical)
    const point = coordinates().pointAt(x, y)
    assert.ok(point)
    close(point.time, bars[0].time + logical * 60, 'The real chart supports fractional historical and empty-space drawing input')
    close(coordinates().timeToX(point.time), x, 'Fractional projection returns to the cursor instead of collapsing to x=0')
  }

  const first = { time: bars[0].time + 3.25 * 60, price: 10 }
  const second = { time: bars[0].time + 5.75 * 60, price: 11 }
  const props = { chartApi: chart, seriesApi: series, bars, timeframe: 'M1', activeTool: null, selectedDrawingId: 'drawing',
    onSelectDrawing() {}, onCreateDrawing: () => 'drawing', onUpdateDrawingPoint() {}, onUpdateDrawingPoints() {}, onUpdatePositionWidth() {}, onExitDrawingMode() {} }
  const handles = () => [...overlayHost.querySelectorAll('.drawing-resize-handle')]
  for (const { id: tool } of drawingTools) {
    let points = [first, second]
    if (['horizontal-line', 'vertical-line', 'text', 'price-note'].includes(tool)) points = [first]
    if (tool === 'parallel-channel') points = [first, second, { ...first, price: 9 }]
    if (tool.includes('position')) points = [first, second, { ...second, price: 9 }]
    const drawing = { id: 'drawing', symbol: 'TEST', timeframe: 'M1', tool, points, createdAt: 1 }
    await React.act(async () => root.render(React.createElement(ChartDrawingOverlay, { ...props, drawings: [drawing] })))
    await paint()
    assert.ok(handles().length, `${tool}: the real chart projects visible editing handles`)
    close(Number(handles()[0].getAttribute('cx')), tool === 'horizontal-line' ? chart.paneSize().width / 2 : xAt(3.25),
      `${tool}: fractional anchors render at their actual chart location`)
    // Test the actual primitive rendering callback, not an emulated notifier.
    const snapshot = JSON.stringify(drawing)
    const prices = chart.priceScale('right').getVisibleRange()
    chart.priceScale('right').applyOptions({ autoScale: false })
    chart.priceScale('right').setVisibleRange({ from: prices.from + .1, to: prices.to + .1 })
    await paint()
    if (!tool.includes('position') && tool !== 'vertical-line') close(Number(handles()[0].getAttribute('cy')), series.priceToCoordinate(10), `${tool}: SVG follows the real price scale draw`)
    assert.equal(JSON.stringify(drawing), snapshot, 'Chart movement never rewrites drawing anchors')
  }
  const beforeAppend = coordinates().timeToX(first.time)
  bars = [...bars, { ...bars.at(-1), time: bars.at(-1).time + 60 }]
  series.setData(bars); await paint()
  // Preserve the viewport explicitly, as the production chart does on paging.
  chart.timeScale().setVisibleLogicalRange({ from: -2, to: 15 }); await paint()
  close(coordinates().timeToX(first.time), beforeAppend, 'Live candle updates preserve timestamp projection')
  console.log('✓ Installed chart API: fractional projection, future/past round-trips, all 14 tools, real primitive price-scale synchronization and live updates')
} finally {
  await React.act(async () => root.unmount())
  chart?.remove()
  if (chart) assert.equal(frames.size, 0, 'Real chart and drawing cleanup cancel pending render work')
  else frames.clear()
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
