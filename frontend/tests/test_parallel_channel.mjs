import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'ResizeObserver', 'IS_REACT_ACT_ENVIRONMENT']
const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div')
document.body.appendChild(host)
const root = createRoot(host)
const subscriptions = new Set()

try {
  const { ChartDrawingOverlay } = await server.ssrLoadModule('./src/market-data/chart-drawings/ChartDrawingOverlay.tsx')
  const { useChartDrawings } = await server.ssrLoadModule('./src/market-data/chart-drawings/use-chart-drawings.ts')
  const { readChartDrawings } = await server.ssrLoadModule('./src/market-data/chart-drawings/chart-drawing-storage.ts')
  const legacy = { id: 'channel', symbol: 'EURUSD', timeframe: 'H1', tool: 'parallel-channel',
    points: [{ time: 10, price: 80 }, { time: 100, price: 70 }], createdAt: 1 }
  const seed = drawing => dom.localStorage.setItem('fyodor.chart-drawings.v1', JSON.stringify([drawing]))
  seed(legacy)
  let multiplier = 1
  const scale = {
    timeToCoordinate: time => time, coordinateToTime: x => Math.round(x),
    coordinateToLogical: x => x, timeToIndex: time => time,
    subscribeVisibleLogicalRangeChange: fn => subscriptions.add(fn),
    unsubscribeVisibleLogicalRangeChange: fn => subscriptions.delete(fn),
  }
  const chartApi = { timeScale: () => scale }
  const seriesApi = { priceToCoordinate: price => (100 - price) * multiplier,
    coordinateToPrice: y => 100 - y / multiplier }
  let api
  function Harness({ tool = null }) {
    const drawings = useChartDrawings('EURUSD', 'H1')
    const [selected, select] = React.useState('channel')
    React.useEffect(() => { api = drawings }, [drawings])
    return React.createElement(ChartDrawingOverlay, { chartApi, seriesApi, activeTool: tool,
      drawings: drawings.drawings, selectedDrawingId: selected, onSelectDrawing: select,
      onCreateDrawing: drawings.addDrawing, onUpdateDrawingPoint: drawings.updateDrawingPoint,
      onUpdateDrawingPoints: drawings.updateDrawingPoints, onUpdatePositionWidth: drawings.updatePositionWidth,
      onExitDrawingMode() {} })
  }
  const render = (props = {}, key = 'initial') => React.act(async () => root.render(React.createElement(Harness, { ...props, key })))
  const circles = () => [...host.querySelectorAll('.drawing-resize-handle')]
  const coordinates = () => circles().map(node => [Number(node.getAttribute('cx')), Number(node.getAttribute('cy'))])
  async function pointer(node, type, x, y) {
    node.setPointerCapture ??= () => {}
    await React.act(async () => node.dispatchEvent(new dom.PointerEvent(type, {
      bubbles: true, button: 0, pointerId: 1, clientX: x, clientY: y,
    })))
  }
  async function drag(index, x, y) {
    const circle = circles()[index]
    await pointer(circle, 'pointerdown', Number(circle.getAttribute('cx')), Number(circle.getAttribute('cy')))
    const svg = host.querySelector('svg')
    await pointer(svg, 'pointermove', x, y)
    await pointer(svg, 'pointerup', x, y)
  }

  await render()
  assert.deepEqual(coordinates(), [[10, 20], [100, 30], [10, 42], [100, 52]], 'Legacy channels show all four vertices at their existing height')
  await drag(2, 40, 62)
  assert.deepEqual(coordinates(), [[10, 20], [100, 30], [10, 62], [100, 72]], 'The first opposite corner resizes both ends without shifting time or baseline')
  assert.equal(readChartDrawings()[0].points[2].price, 38)
  await drag(3, 180, 82)
  assert.deepEqual(coordinates(), [[10, 20], [100, 30], [10, 72], [100, 82]], 'The second opposite corner also controls channel height')
  await drag(0, 20, 10)
  assert.deepEqual(coordinates(), [[10, 10], [100, 20], [10, 72], [100, 82]], 'The first upper corner resizes vertically while the lower edge, slope and times stay fixed')
  await drag(1, 120, 40)
  assert.deepEqual(coordinates(), [[10, 30], [100, 40], [10, 72], [100, 82]], 'The second upper corner controls the same vertical edge without horizontal movement')
  const saved = readChartDrawings()[0]
  await render({}, 'reload')
  assert.deepEqual(api.drawings[0], saved, 'All channel edits survive a remount through the real drawing store')
  multiplier = 2
  await render()
  assert.deepEqual(coordinates(), [[10, 60], [100, 80], [10, 144], [100, 164]], 'Saved height follows price-scale zoom')
  multiplier = 1

  seed({ ...legacy, points: [...legacy.points].reverse() })
  await render({}, 'reversed')
  await drag(3, 10, 12)
  assert.deepEqual(coordinates(), [[100, 30], [10, 20], [100, 22], [10, 12]], 'Reversed endpoints and crossing the baseline preserve parallel edges')

  await React.act(async () => api.clearAllDrawings())
  await render({ tool: 'parallel-channel' }, 'creation')
  const svg = host.querySelector('svg')
  await pointer(svg, 'pointerdown', 30, 30)
  await pointer(svg, 'pointermove', 90, 10)
  await pointer(svg, 'pointerup', 90, 10)
  assert.equal(readChartDrawings()[0].points.length, 3, 'New channels store their price height immediately')
  assert.deepEqual(coordinates(), [[30, 30], [90, 10], [30, 52], [90, 32]])
  console.log('✓ Parallel channel corner editing, legacy compatibility, creation, persistence and zoom')
} finally {
  await React.act(async () => root.unmount())
  assert.equal(subscriptions.size, 0, 'Drawing subscriptions are cleaned up')
  await server.close()
  await dom.happyDOM.close()
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
}
