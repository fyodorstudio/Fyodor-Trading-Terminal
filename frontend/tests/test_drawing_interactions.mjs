import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node,
  navigator: dom.navigator, ResizeObserver: dom.ResizeObserver, getComputedStyle: dom.getComputedStyle.bind(dom), IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.appendChild(host)
const root = createRoot(host)
const primitives = new Set(), rangeListeners = new Set(), frames = new Map(), captures = new Set()
let frameId = 0, projectionReads = 0, seriesWrites = 0
dom.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId }
dom.cancelAnimationFrame = id => frames.delete(id)
dom.SVGElement.prototype.setPointerCapture = id => captures.add(id)
dom.SVGElement.prototype.hasPointerCapture = id => captures.has(id)
dom.SVGElement.prototype.releasePointerCapture = id => captures.delete(id)
let shiftX = 0, shiftY = 0, spacing = 40, priceSpacing = 10, width = 600, height = 300
let timeline = [1000, 1060, 1120, 1180].map(time => ({ time }))
const scale = {
  coordinateToLogical: x => Math.ceil((x - 100 - shiftX) / spacing),
  logicalToCoordinate: logical => Number.isInteger(logical) ? logical * spacing + 100 + shiftX : 0,
  // Real coordinateToTime cannot resolve empty space. The drawing layer must.
  coordinateToTime: x => timeline[Math.round((x - 100 - shiftX) / spacing)]?.time ?? null,
  timeToCoordinate: time => { const index = timeline.findIndex(bar => bar.time === time); return index < 0 ? null : index * spacing + 100 + shiftX },
  subscribeVisibleLogicalRangeChange: fn => rangeListeners.add(fn), unsubscribeVisibleLogicalRangeChange: fn => rangeListeners.delete(fn),
}
const chartApi = { timeScale: () => scale, paneSize: () => ({ width, height }) }
const seriesApi = {
  setData: () => { seriesWrites++ }, update: () => { seriesWrites++ },
  priceToCoordinate: price => { projectionReads++; return 200 - price * priceSpacing + shiftY },
  coordinateToPrice: y => (200 + shiftY - y) / priceSpacing,
  attachPrimitive: primitive => primitives.add(primitive), detachPrimitive: primitive => primitives.delete(primitive),
}
const chartFrame = () => { for (const primitive of primitives) for (const view of primitive.paneViews()) view.renderer().draw() }
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} vs ${expected}`)
let api, selected, liveUpdates = 0, persistedUpdates = 0

try {
  const { ChartDrawingOverlay } = await server.ssrLoadModule('./src/market-data/chart-drawings/ChartDrawingOverlay.tsx')
  const { useChartDrawings } = await server.ssrLoadModule('./src/market-data/chart-drawings/use-chart-drawings.ts')
  const { readChartDrawings } = await server.ssrLoadModule('./src/market-data/chart-drawings/chart-drawing-storage.ts')
  const { drawingTools } = await server.ssrLoadModule('./src/market-data/chart-drawings/drawing-tool.ts')
  const { drawingTimeToLogical, drawingLogicalToTime } = await server.ssrLoadModule('./src/market-data/chart-drawings/drawing-coordinates.ts')

  const gapBars = [1000, 1060, 200000].map(time => ({ time }))
  for (const logical of [-5.25, 0, .2, 1, 1.5, 2, 9.75]) {
    close(drawingTimeToLogical(drawingLogicalToTime(logical, gapBars, 60), gapBars, 60), logical, 'Session gaps and future/past fractional coordinates round-trip')
  }
  let timelineReads = 0
  const large = Array.from({ length: 100_000 }, (_, i) => ({ get time() { timelineReads++; return i * 60 } }))
  close(drawingTimeToLogical(50000.5 * 60, large, 60), 50000.5, 'Fractional historical placement')
  assert.ok(timelineReads < 45, 'Point conversion searches history logarithmically instead of scanning all candles')

  function Harness({ tool = null, initiallySelected = null }) {
    const drawings = useChartDrawings('TEST', 'M1')
    const [selection, setSelection] = React.useState(initiallySelected)
    React.useEffect(() => { api = drawings; selected = selection }, [drawings, selection])
    return React.createElement(ChartDrawingOverlay, { chartApi, seriesApi, bars: timeline, timeframe: 'M1',
      activeTool: tool, drawings: drawings.drawings, selectedDrawingId: selection, onSelectDrawing: setSelection,
      onCreateDrawing: drawings.addDrawing, onUpdateDrawingPoint: drawings.updateDrawingPoint,
      onUpdatePositionWidth: drawings.updatePositionWidth, onUpdateDrawingText: drawings.updateDrawingText,
      onUpdateDrawingPoints: (...args) => { if (args[2]) persistedUpdates++; else liveUpdates++; drawings.updateDrawingPoints(...args) },
      onExitDrawingMode() {} })
  }
  const render = (props = {}, key = 'initial') => React.act(async () => root.render(React.createElement(Harness, { ...props, key })))
  const svg = () => host.querySelector('svg')
  const body = () => host.querySelector('.drawing-object')
  const handles = () => [...host.querySelectorAll('.drawing-resize-handle')]
  const seed = record => dom.localStorage.setItem('fyodor.chart-drawings.v1', JSON.stringify(record ? [record] : []))
  async function pointer(node, type, x, y) {
    assert.ok(node, type)
    await React.act(async () => node.dispatchEvent(new dom.PointerEvent(type, { bubbles: true, button: 0, pointerId: 1, clientX: x, clientY: y })))
  }
  async function drag(node, fromX, fromY, toX, toY, end = 'pointerup') {
    await pointer(node, 'pointerdown', fromX, fromY)
    await pointer(svg(), 'pointermove', toX, toY)
    await pointer(svg(), end, toX, toY)
  }
  const pointsFor = tool => {
    const points = [{ time: 1000, price: 10 }, { time: 1120, price: 12 }]
    if (['horizontal-line', 'vertical-line', 'text'].includes(tool)) return points.slice(0, 1)
    if (tool === 'parallel-channel') return [...points, { time: 1000, price: 8 }]
    if (tool === 'short-position') return [points[0], { time: 1120, price: 8 }, { time: 1120, price: 12 }]
    if (tool === 'long-position') return [...points, { time: 1120, price: 8 }]
    if (tool === 'path') return [...points, { time: 1180, price: 9 }]
    return points
  }
  const recordFor = tool => ({ id: 'drawing', symbol: 'TEST', timeframe: 'M1', tool, points: pointsFor(tool), createdAt: 1, text: 'Example' })

  for (const { id: tool } of drawingTools) {
    const original = recordFor(tool)
    seed(original); await render({}, tool)
    await drag(body(), 140, 100, 150, 105)
    assert.equal(selected, 'drawing', `${tool}: first interaction only selects`)
    assert.deepEqual(api.drawings[0].points, original.points, `${tool}: unselected body cannot move`)
    assert.ok(handles().every(handle => handle.getAttribute('r') === '7'), `${tool}: visible handles are 14px`)
    assert.equal(host.querySelectorAll('.drawing-handle-hit-area').length, handles().length)
    await drag(body(), 140, 100, 141, 101)
    assert.deepEqual(api.drawings[0].points, original.points, `${tool}: click jitter cannot move geometry`)
    // A quarter-bar move must remain fractional, and the grab can be far from an anchor.
    await drag(body(), 140, 100, 150, 105)
    const moved = api.drawings[0].points
    close(Number(handles()[0].getAttribute('cx')), tool === 'horizontal-line' ? width / 2 : 110,
      `${tool}: fractional movement renders at the translated x coordinate, rather than the left edge`)
    original.points.forEach((point, index) => {
      close(moved[index].time, point.time + (tool === 'horizontal-line' ? 0 : 15), `${tool}: translates every time anchor equally`)
      close(moved[index].price, point.price + (tool === 'vertical-line' ? 0 : -.5), `${tool}: translates every price anchor equally`)
    })
    assert.deepEqual(readChartDrawings()[0].points, moved, `${tool}: body movement survives storage`)
    assert.equal(captures.size, 0, `${tool}: release ends pointer capture`)
    await drag(body(), 150, 105, 230, 140, 'pointercancel')
    assert.deepEqual(api.drawings[0].points, moved, `${tool}: cancellation restores the starting shape`)
    assert.deepEqual(readChartDrawings()[0].points, moved, `${tool}: cancellation leaves saved geometry intact`)
    await pointer(body(), 'pointerdown', 150, 105)
    await pointer(svg(), 'pointermove', 200, 120)
    await React.act(async () => window.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape' })))
    assert.deepEqual(api.drawings[0].points, moved, `${tool}: Escape restores live edits`)
    assert.equal(captures.size, 0)
  }

  // Every rectangle corner holds its diagonal opposite fixed, including when
  // dragged past it. Existing rectangles retain their two-anchor storage.
  const rectangleCoordinates = () => handles().map(handle => [Number(handle.getAttribute('cx')), Number(handle.getAttribute('cy'))])
  for (let index = 0; index < 4; index++) {
    seed(recordFor('rectangle')); await render({ initiallySelected: 'drawing' }, `rectangle-${index}`)
    const original = rectangleCoordinates()
    assert.deepEqual(original, [[100, 100], [180, 80], [100, 80], [180, 100]])
    const opposite = [1, 0, 3, 2][index]
    const [x, y] = original[index]
    await drag(handles()[index], x, y, x + 120, y - 35)
    assert.deepEqual(rectangleCoordinates()[index], [x + 120, y - 35], `Rectangle corner ${index}: the grabbed corner follows the cursor across its opposite`)
    assert.deepEqual(rectangleCoordinates()[opposite], original[opposite], `Rectangle corner ${index}: the diagonal opposite stays fixed`)
    assert.equal(readChartDrawings()[0].points.length, 2, 'Rectangle derived corners do not duplicate storage anchors')
    const saved = rectangleCoordinates()
    await render({ initiallySelected: 'drawing' }, `rectangle-reload-${index}`)
    assert.deepEqual(rectangleCoordinates(), saved, 'Four rectangle handles survive reload')
  }

  // An arrowhead is explicit geometry whose tip is exactly the second anchor.
  // It cannot disappear because of an SVG marker reference or duplicate ID.
  seed(recordFor('arrow')); await render({ initiallySelected: 'drawing' }, 'arrow-tip')
  const arrowTip = () => host.querySelector('.drawing-arrow-head').getAttribute('points').split(' ').map(pair => pair.split(',').map(Number))
  assert.deepEqual(arrowTip()[0], [180, 80])
  assert.equal(arrowTip().length, 3)
  assert.ok(arrowTip()[1][0] < 180 && arrowTip()[2][0] < 180, 'Arrowhead wings sit behind the endpoint')
  await drag(handles()[1], 180, 80, 60, 130)
  assert.deepEqual(arrowTip()[0], [60, 130], 'Reversing an arrow keeps its tip attached to the end anchor')
  assert.ok(arrowTip()[1][0] > 60 && arrowTip()[2][0] > 60, 'The arrowhead turns with the reversed line')

  // Price notes are trend-line gestures with two anchors and a live end price.
  seed(recordFor('price-note')); await render({ initiallySelected: 'drawing' }, 'price-note-line')
  assert.equal(handles().length, 2)
  assert.equal(body().querySelector('.drawing-stroke').getAttribute('x2'), '180')
  assert.equal(body().querySelector('.drawing-note').textContent, '12.00000')
  await drag(handles()[1], 180, 80, 230, 60)
  assert.equal(body().querySelector('.drawing-note').textContent, '14.00000', 'Editing the note endpoint updates its displayed price')
  assert.equal(body().querySelector('.drawing-stroke').getAttribute('x2'), '230')
  assert.equal(body().querySelector('.drawing-stroke').getAttribute('y2'), '60')
  const legacyNote = { ...recordFor('price-note'), points: [{ time: 1060, price: 10 }] }
  seed(legacyNote); await render({ initiallySelected: 'drawing' }, 'legacy-price-note')
  assert.deepEqual(rectangleCoordinates(), [[60, 100], [140, 100]], 'Legacy notes retain their original labeled endpoint and gain a line behind it')
  assert.deepEqual(readChartDrawings()[0], legacyNote, 'Viewing a legacy note does not write a migration')
  await drag(handles()[1], 140, 100, 160, 90)
  assert.equal(readChartDrawings()[0].points.length, 2, 'The first legacy note edit stores both actual line anchors')
  assert.equal(body().querySelector('.drawing-note').textContent, '11.00000')

  // Text can be reopened by double-click (including captured SVG events) or
  // keyboard; commit and cancellation are safe even if blur follows them.
  const reactProps = node => node[Object.getOwnPropertyNames(node).find(key => key.startsWith('__reactProps$'))]
  const key = async (node, value) => React.act(async () => node.dispatchEvent(new dom.KeyboardEvent('keydown', { bubbles: true, key: value })))
  seed(recordFor('text')); await render({ initiallySelected: 'drawing' }, 'text-edit')
  await React.act(async () => body().dispatchEvent(new dom.MouseEvent('dblclick', { bubbles: true })))
  let input = host.querySelector('[aria-label="Drawing text"]')
  assert.equal(document.activeElement, input, 'Text double-click focuses the inline editor')
  await React.act(async () => reactProps(input).onChange({ target: { value: 'Updated text' } }))
  await key(input, 'Enter')
  assert.equal(readChartDrawings()[0].text, 'Updated text')
  assert.equal(host.querySelector('input'), null)
  await key(window, 'Enter')
  input = host.querySelector('input')
  assert.equal(input.value, 'Updated text', 'Keyboard editing reopens saved text')
  await React.act(async () => reactProps(input).onChange({ target: { value: 'Cancelled text' } }))
  const cancelledBlur = reactProps(input).onBlur
  await key(input, 'Escape')
  await React.act(async () => cancelledBlur())
  assert.equal(readChartDrawings()[0].text, 'Updated text', 'Escape plus subsequent blur cannot commit cancelled text')
  await React.act(async () => svg().dispatchEvent(new dom.MouseEvent('dblclick', { bubbles: true })))
  assert.ok(host.querySelector('input'), 'A double-click retargeted to the captured SVG still opens the selected text')
  await key(host.querySelector('input'), 'Escape')

  // Create every gesture type wholly beyond the last available candle.
  for (const { id: tool, gesture } of drawingTools) {
    seed(null); await render({ tool }, `create-${tool}`)
    if (gesture === 'point') await pointer(svg(), 'pointerdown', 360, 120)
    else if (gesture === 'path') {
      await pointer(svg(), 'pointerdown', 360, 120)
      await pointer(svg(), 'pointerdown', 420, 100)
      await pointer(svg(), 'contextmenu', 420, 100)
    } else await drag(svg(), 360, 120, 420, 100)
    assert.equal(api.drawings.length, 1, `${tool}: creation works without a candle under any vertex`)
    assert.ok(api.drawings[0].points.every(point => point.time > timeline.at(-1).time), `${tool}: future timestamps are saved`)
    assert.ok(handles().length > 0, `${tool}: future shapes remain visible and editable`)
    close(Number(handles()[0].getAttribute('cx')), tool === 'horizontal-line' ? width / 2 : 360,
      `${tool}: a fractional future anchor stays at the creation cursor`)
    // Resize a real endpoint in empty past space. Axis lines lock their irrelevant dimension.
    const handle = handles()[tool.includes('position') ? 3 : 0]
    const x = Number(handle.getAttribute('cx')), y = Number(handle.getAttribute('cy'))
    await drag(handle, x, y, 50, y - 15)
    if (tool !== 'horizontal-line' && tool !== 'parallel-channel') assert.ok(api.drawings[0].points[tool.includes('position') ? 1 : 0].time < timeline[0].time, `${tool}: endpoint can move before loaded history`)
    if (tool === 'parallel-channel') assert.equal(api.drawings[0].points[0].time, 1390, 'Channel corners only resize vertically, even in empty space')
  }

  // Forgiving handle targets retain the offset at the initial grab.
  seed(recordFor('trend-line')); await render({ initiallySelected: 'drawing' }, 'handle-offset')
  await drag(host.querySelector('.drawing-handle-hit-area'), 108, 104, 128, 114)
  close(api.drawings[0].points[0].time, 1030, 'Handle movement does not jump to the edge of its expanded hit area')
  close(api.drawings[0].points[0].price, 9, 'Handle retains price offset at the grab')

  // Reproduce the missing vertical refresh: no time-scale event or parent render.
  const anchored = recordFor('parallel-channel')
  seed(anchored); await render({ initiallySelected: 'drawing' }, 'viewport')
  assert.equal(primitives.size, 1)
  const snapshot = JSON.stringify(readChartDrawings())
  const firstHandle = () => [Number(handles()[0].getAttribute('cx')), Number(handles()[0].getAttribute('cy'))]
  const before = firstHandle()
  const updatesBeforePan = liveUpdates + persistedUpdates
  projectionReads = 0
  shiftY = 23
  await React.act(async () => chartFrame())
  assert.deepEqual(firstHandle(), [before[0], before[1] + 23], 'Vertical pan updates the SVG within the chart draw call')
  assert.equal(projectionReads, 5, 'One frame projects the three channel anchors once, plus two constant scale probes')
  assert.equal(frames.size, 0, 'The overlay never schedules a trailing second frame')
  projectionReads = 0
  await React.act(async () => { for (let i = 0; i < 200; i++) chartFrame() })
  assert.equal(projectionReads, 400, 'Unchanged chart/crosshair draws only read two scale probes; no shapes are reprojected')
  shiftX = 17; spacing = 55; priceSpacing = 13
  await React.act(async () => chartFrame())
  close(firstHandle()[0], 117, 'Horizontal pan and zoom preserve the anchored time')
  close(firstHandle()[1], 200 - 10 * 13 + 23, 'Price zoom preserves the anchored price')
  assert.equal(liveUpdates + persistedUpdates, updatesBeforePan, 'Pan and zoom never mutate drawing data')
  assert.equal(JSON.stringify(readChartDrawings()), snapshot, 'Pan and zoom never rewrite saved anchors')
  const beforePaging = firstHandle()
  timeline = [{ time: 880 }, { time: 940 }, ...timeline]; shiftX -= 2 * spacing
  await render({ initiallySelected: 'drawing' }, 'viewport')
  await React.act(async () => chartFrame())
  assert.deepEqual(firstHandle(), beforePaging, 'Prepending history and restoring the viewport does not shift saved drawings')
  timeline = [...timeline, { time: 1240 }]
  await render({ initiallySelected: 'drawing' }, 'viewport')
  await React.act(async () => chartFrame())
  assert.deepEqual(firstHandle(), beforePaging, 'A newly appended candle does not move historical drawing anchors')
  width = 500; height = 250
  await React.act(async () => chartFrame())
  assert.equal(host.querySelector('clipPath rect').getAttribute('width'), '500', 'Resize updates the drawing pane clip')

  // Offscreen drawings skip price projection, but an offscreen timestamp does
  // not hide a horizontal line that still spans the visible pane.
  shiftX = 0; shiftY = 0; spacing = 40; priceSpacing = 10
  const outside = { ...recordFor('trend-line'), points: [{ time: 90000, price: 10 }, { time: 91000, price: 12 }] }
  seed(outside); await render({}, 'outside')
  projectionReads = 0; shiftY = 1
  await React.act(async () => chartFrame())
  assert.equal(projectionReads, 2, 'Invisible shapes avoid price projection work')
  assert.equal(handles().length, 0)
  seed({ ...outside, tool: 'horizontal-line', points: outside.points.slice(0, 1) }); await render({ initiallySelected: 'drawing' }, 'outside-horizontal')
  assert.equal(handles().length, 1, 'A horizontal line remains visible regardless of its original candle time')

  // Unmount during capture and reject stale library draw callbacks.
  const stale = [...primitives][0]
  await pointer(body(), 'pointerdown', 100, 100)
  assert.equal(captures.size, 1)
  await React.act(async () => root.unmount())
  assert.equal(captures.size, 0); assert.equal(primitives.size, 0); assert.equal(rangeListeners.size, 0)
  projectionReads = 0; stale.paneViews()[0].renderer().draw()
  assert.equal(projectionReads, 0, 'A detached primitive ignores stale draws')
  assert.equal(seriesWrites, 0, 'No fake candle data is added to support drawing coordinates')
  console.log('✓ All 14 drawing tools: selected body drag, fractional empty-space creation/editing, constraints, cancellation, storage, same-frame pan/zoom, history and bounded projection work')
} finally {
  await React.act(async () => root.unmount())
  assert.equal(frames.size, 0)
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
