import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'IS_REACT_ACT_ENVIRONMENT']
const previous = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
let root
try {
  const { MagnitudeScatterPlot } = await server.ssrLoadModule('./src/scatter-plot/plot/MagnitudeScatterPlot.tsx')
  const { scatterPlotGeometry } = await server.ssrLoadModule('./src/scatter-plot/plot/scatter-plot-geometry.ts')
  const { scaleScatterAxis, limitScatterDates } = await server.ssrLoadModule('./src/scatter-plot/plot/scatter-plot-viewport.ts')
  const { magnitudeDistribution } = await server.ssrLoadModule('./src/inspector/magnitude/magnitude-distribution.ts')
  const points = [-120, 450, -30].map((delta, index) => ({ id: `point${index}`, releaseId: `release${index}`,
    at: Date.UTC(2026, index, 6, 13, 30), delta, actual: 500 + delta, previous: 500, tone: delta > 0 ? 'good' : 'bad' }))
  const distribution = magnitudeDistribution(points.slice(0, 2).map((p) => p.delta), points[2].delta)
  const model = { points, formatReading: String, formatDelta: (v) => `${v > 0 ? '+' : ''}${Math.round(v * 1e6) / 1e6}k`,
    inspection: { releaseId: points[2].releaseId, at: points[2].at, point: points[2], actual: points[2].actual, previous: 500,
      delta: points[2].delta, distribution, samples: points.slice(0, 2), excluded: 0, quantile: null } }
  const original = JSON.stringify(model)
  const inspected = []
  const container = document.createElement('div'); document.body.appendChild(container)
  root = createRoot(container)
  const props = { model, zoom: false, viewKey: 'EURUSD/USD/NFP/payrolls', onInspect: (id) => inspected.push(id) }
  const render = (next = props) => React.act(async () => root.render(React.createElement(MagnitudeScatterPlot, next)))
  await render()
  const svg = container.querySelector('svg')
  // Verify SVG/viewBox coordinate conversion under CSS scaling and a nonzero page offset.
  svg.getBoundingClientRect = () => ({ left: 100, top: 50, width: 450, height: 140, right: 550, bottom: 190 })
  const client = (x, y) => ({ clientX: 100 + x / 2, clientY: 50 + y / 2 })
  const pointer = (type, x, y, target = svg, extras = {}) => React.act(async () => target.dispatchEvent(new dom.PointerEvent(type,
    { ...client(x, y), pointerId: 1, isPrimary: true, button: 0, bubbles: true, cancelable: true, ...extras })))
  const doubleClick = (x, y) => React.act(async () => svg.dispatchEvent(new dom.MouseEvent('dblclick', { ...client(x, y), bubbles: true })))
  const key = (axis, value) => React.act(async () => container.querySelector(`[data-scale-axis="${axis}"]`).dispatchEvent(new dom.KeyboardEvent('keydown', { key: value, bubbles: true })))
  const wheel = async (x, y, extras = {}) => {
    const event = new dom.WheelEvent('wheel', { ...client(x, y), deltaY: -120, bubbles: true, cancelable: true, ...extras })
    // happy-dom's WheelEvent omits inherited MouseEvent coordinates/modifiers.
    Object.assign(event, client(x, y), { ctrlKey: false, metaKey: false, shiftKey: false }, extras)
    await React.act(async () => svg.dispatchEvent(event))
    return event
  }
  const range = () => ({ x: { from: Number(svg.dataset.dateFrom), to: Number(svg.dataset.dateTo) },
    y: { from: Number(svg.dataset.deltaFrom), to: Number(svg.dataset.deltaTo) } })
  const span = (r) => r.to - r.from
  const initial = range()
  const geometry = () => scatterPlotGeometry(points, distribution, false, 900, 280, points[2].at, range())
  let g = geometry()
  const x = g.x(points[1].at), y = g.y(points[1].delta)
  await pointer('pointermove', x, y)
  const crosshair = container.querySelector('.scatter-plot-crosshair')
  assert.ok(crosshair)
  assert.ok(Math.abs(Number(crosshair.dataset.crosshairDate) - points[1].at) < .001)
  assert.ok(Math.abs(Number(crosshair.dataset.crosshairDelta) - points[1].delta) < 1e-9)
  assert.match(crosshair.textContent, /\+450k.*2026-02-06 13:30/)
  await pointer('pointermove', 40, 100)
  assert.equal(container.querySelector('.scatter-plot-crosshair'), null, 'Crosshair hides over axis controls')

  const consumed = await wheel(500, 260)
  assert.ok(consumed.defaultPrevented, 'Non-passive wheel zoom prevents dock/page scrolling')
  assert.ok(span(range().x) < span(initial.x))
  assert.deepEqual(range().y, initial.y, 'Date-axis wheel leaves delta range alone')
  const xRange = range().x
  const yBefore = geometry().deltaAt(100)
  await wheel(40, 100)
  assert.deepEqual(range().x, xRange)
  assert.ok(span(range().y) < span(initial.y))
  assert.ok(Math.abs(geometry().deltaAt(100) - yBefore) < 1e-9, 'Wheel zoom anchors the delta under the cursor')
  assert.equal((await wheel(500, 100, { ctrlKey: true })).defaultPrevented, false, 'Browser zoom shortcut is preserved')
  await doubleClick(500, 260)
  assert.deepEqual(range().x, initial.x, 'Date-axis double-click restores only X')
  assert.notDeepEqual(range().y, initial.y)
  await doubleClick(40, 100)
  assert.deepEqual(range(), initial, 'Delta-axis reset restores Y')

  const drag = async (startX, startY, endX, endY, target = svg) => {
    await pointer('pointerdown', startX, startY, target)
    await pointer('pointermove', endX, endY, target)
    await pointer('pointerup', endX, endY, target)
  }
  await drag(500, 260, 560, 260, container.querySelector('[data-scale-axis="x"]'))
  assert.ok(span(range().x) < span(initial.x), 'Horizontal axis drag zooms X')
  assert.deepEqual(range().y, initial.y)
  const draggedX = range().x
  await drag(40, 140, 40, 100, container.querySelector('[data-scale-axis="y"]'))
  assert.ok(span(range().y) < span(initial.y), 'Vertical axis drag zooms Y')
  assert.deepEqual(range().x, draggedX)
  const beforePan = range()
  await drag(500, 100, 560, 130)
  assert.ok(range().x.from < beforePan.x.from, 'Dragging plot to the right pans to earlier dates')
  assert.ok(range().y.from > beforePan.y.from, 'Dragging down pans to higher deltas')
  assert.ok(Math.abs(span(range().x) - span(beforePan.x)) < .001)
  assert.ok(Math.abs(span(range().y) - span(beforePan.y)) < 1e-9)
  await React.act(async () => container.querySelector('[data-point-id="point1"]').dispatchEvent(new dom.MouseEvent('click', { bubbles: true })))
  assert.deepEqual(inspected, [], 'A drag ending over a point never changes the inspected release')
  await pointer('pointerdown', 500, 100)
  await pointer('pointerup', 500, 100)
  await React.act(async () => container.querySelector('[data-point-id="point1"]').dispatchEvent(new dom.MouseEvent('click', { bubbles: true })))
  assert.deepEqual(inspected, ['release1'], 'A simple point click still selects its release')
  await doubleClick(500, 100)
  assert.deepEqual(range(), initial, 'Plot double-click restores both axes')

  await key('x', '+'); await key('y', '+')
  assert.ok(span(range().x) < span(initial.x) && span(range().y) < span(initial.y))
  await key('x', '0'); await key('y', 'Home')
  assert.deepEqual(range(), initial)
  assert.deepEqual(inspected, ['release1'], 'Axis keyboard resets do not trigger publication navigation')
  await pointer('pointerdown', 500, 100)
  await pointer('pointercancel', 500, 100)
  await pointer('pointermove', 560, 130)
  assert.deepEqual(range(), initial, 'Cancelled pointer gestures cannot pan afterwards')
  await wheel(500, 100)
  const wheelX = range().x
  await wheel(500, 100, { shiftKey: true })
  assert.deepEqual(range().x, wheelX, 'Shift-wheel inside the plot changes only Y')
  await render({ ...props, zoom: true })
  assert.deepEqual(range().x, initial.x, 'P95 preset clears manual X navigation')
  assert.equal(range().y.to, distribution.threshold * 1.12)
  await wheel(500, 100)
  await render({ ...props, viewKey: 'EURUSD/USD/NFP/hours' })
  assert.deepEqual(range(), initial, 'Series/scope changes reset native-unit view ranges')
  assert.equal(JSON.stringify(model), original, 'All crosshair, zoom and pan operations leave samples and magnitude calculations unchanged')
  assert.equal(container.querySelectorAll('[data-point-id]').length, points.length, 'Viewport clipping never drops source observations')

  const hitTarget = container.querySelector('[data-point-id="point1"] circle')
  const captures = []
  hitTarget.setPointerCapture = (id) => captures.push(id)
  await pointer('pointerdown', 500, 100, hitTarget)
  assert.deepEqual(captures, [1], 'Capture belongs to the original point hit target, preserving ordinary click targeting')
  await pointer('lostpointercapture', 500, 100, hitTarget)
  const beforeCaptureLoss = range()
  await pointer('pointermove', 560, 130)
  assert.deepEqual(range(), beforeCaptureLoss, 'Losing capture terminates the drag')
  await wheel(500, 100); await wheel(500, 100, { shiftKey: true })
  const beforeResize = range()
  const canvas = container.querySelector('.scatter-plot-canvas')
  Object.defineProperties(canvas, { clientWidth: { configurable: true, value: 1200 }, clientHeight: { configurable: true, value: 360 } })
  await React.act(async () => dom.dispatchEvent(new dom.Event('resize')))
  assert.equal(svg.getAttribute('viewBox'), '0 0 1200 360')
  assert.deepEqual(range(), beforeResize, 'Resizing the dock preserves manually chosen ranges on both axes')

  const minimum = scaleScatterAxis({ from: 10, to: 20 }, 1e-10, 15, 1, 100)
  assert.equal(span(minimum), 1)
  assert.equal(span(scaleScatterAxis({ from: 10, to: 20 }, 1e10, 15, 1, 100)), 100)
  assert.ok(limitScatterDates({ from: Date.UTC(1800, 0, 1), to: Date.UTC(1801, 0, 1) }).from >= Date.UTC(1900, 0, 1))
  await React.act(async () => root.unmount()); root = null
  assert.equal((await wheel(500, 100)).defaultPrevented, false, 'Unmount removes the native wheel listener')
  console.log('✓ Crosshair coordinate readouts, independent axis drag/wheel/key zoom, anchored scaling, plot pan, reset, cancellation and calculation invariance')
} finally {
  if (root) await React.act(async () => root.unmount())
  await server.close(); await dom.happyDOM.abort(); dom.close()
  for (const key of keys) {
    if (previous[key]) Object.defineProperty(globalThis, key, previous[key])
    else delete globalThis[key]
  }
}
