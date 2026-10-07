import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ root: rootDir, server: { middlewareMode: true } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'ResizeObserver', 'IS_REACT_ACT_ENVIRONMENT']
const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const roots = []
const frames = new Map(); let frameId = 0
dom.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId }
dom.cancelAnimationFrame = id => frames.delete(id)
function flushFrames() { for (const [id, callback] of frames) { frames.delete(id); callback() } }
function mount(Component, props) {
  const container = document.createElement('div'); document.body.appendChild(container)
  const root = createRoot(container); roots.push(root)
  return { container, root, render: async (next = props) => React.act(async () => root.render(React.createElement(Component, next))) }
}
const originalNow = Date.now

try {
  const { calendarAdmissionTime } = await server.ssrLoadModule('./src/inspector/storage/calendar-admission-time.ts')
  const { candleTimeline } = await server.ssrLoadModule('./src/inspector/chart/candle-timeline.ts')
  const { indexMarkers, projectMarkers } = await server.ssrLoadModule('./src/inspector/chart/marker-projection.ts')
  const { InspectorChartMarkers } = await server.ssrLoadModule('./src/inspector/InspectorChartMarkers.tsx')
  const { InspectorScoringView } = await server.ssrLoadModule('./src/inspector/scoring/InspectorScoringView.tsx')
  const { useCalendarNow } = await server.ssrLoadModule('./src/inspector/useCalendarNow.ts')
  const { ChartDrawingOverlay } = await server.ssrLoadModule('./src/market-data/chart-drawings/ChartDrawingOverlay.tsx')

  // These are operation-count regressions, not machine-dependent timing tests.
  let reads = 0
  const inventory = Array.from({ length: 100_000 }, (_, i) => ({ get release_at() { reads++; return (i + 1) * 1000 } }))
  assert.equal(calendarAdmissionTime(inventory, 50_000_500), 50_000_000)
  const indexedReads = reads
  for (const now of [1, 1000, 1001, 50_000_500, 100_000_000, 0, NaN]) calendarAdmissionTime(inventory, now)
  assert.equal(reads, indexedReads, 'Hovering must not rescan an indexed calendar inventory')
  const replaced = [...inventory, { release_at: 100_001_000 }]
  assert.equal(calendarAdmissionTime(replaced, 100_000_999), 100_000_000, 'Future publications remain excluded')
  assert.equal(calendarAdmissionTime(replaced, 100_001_000), 100_001_000, 'A new inventory admits a new publication at its timestamp')

  const bars = Array.from({ length: 100_000 }, (_, time) => ({ time, open: 1, high: 2, low: 0, close: 1 }))
  const timeline = candleTimeline(bars)
  assert.equal(candleTimeline(bars), timeline)
  assert.equal(candleTimeline(bars.map(bar => ({ ...bar, close: 1.2 }))), timeline,
    'Price updates must reuse the time-only overlay snapshot')
  const interior = bars.map((bar, i) => i === 100 ? { ...bar, time: 100.5 } : bar)
  assert.notEqual(candleTimeline(interior), timeline, 'Interior timestamp corrections must invalidate the overlay')
  assert.notEqual(candleTimeline([...bars, { ...bars.at(-1), time: 100_000 }]), timeline)
  assert.notEqual(candleTimeline([{ ...bars[0], time: -1 }, ...bars]), timeline)

  const markers = bars.map(({ time }) => ({ time, symbol: 'cloud', release: {
    id: String(time), label: 'US CPI / core CPI', currency: 'USD', events: [], releaseAt: (1_700_000_000 + time) * 1000,
  } }))
  const subscriptions = new Set()
  let from = 45_000, calls = 0
  const scale = {
    getVisibleRange: () => ({ from, to: from + 9 }), width: () => 500,
    timeToCoordinate: time => { calls++; return (time - from) * 45 },
    timeToIndex: () => 0, logicalToCoordinate: () => 480,
    subscribeVisibleLogicalRangeChange: fn => subscriptions.add(fn), unsubscribeVisibleLogicalRangeChange: fn => subscriptions.delete(fn),
    subscribeSizeChange: fn => subscriptions.add(fn), unsubscribeSizeChange: fn => subscriptions.delete(fn),
  }
  const index = indexMarkers(markers)
  assert.equal(projectMarkers(scale, index).length, 10)
  assert.equal(calls, 10, 'Only visible historical markers should reach coordinate projection')
  const projected = { ...markers[0], projection: { anchorTime: 99_999, barsAhead: 1 } }
  assert.equal(projectMarkers(scale, indexMarkers([...markers, projected])).at(-1).markers[0], projected,
    'Blank future-space markers remain eligible outside the loaded candle range')
  calls = 0
  const markerApp = mount(InspectorChartMarkers, { chartApi: { timeScale: () => scale }, markers,
    timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 }, onSelectRelease: () => {} })
  await markerApp.render()
  assert.equal(calls, 10)
  assert.equal(markerApp.container.querySelectorAll('.inspector-chart-symbol').length, 10)
  calls = 0
  await React.act(async () => {
    from = 46_000
    for (let i = 0; i < 200; i++) for (const notify of subscriptions) notify()
  })
  assert.equal(calls, 0, 'Pan notifications must defer work to an animation frame')
  assert.equal(frames.size, 1, 'A burst of range and resize callbacks should schedule one projection')
  await React.act(async () => flushFrames())
  assert.equal(calls, 10, 'The entire notification burst should project the visible markers once')
  await React.act(async () => { for (const notify of subscriptions) notify() })
  await React.act(async () => markerApp.root.unmount())
  roots.splice(roots.indexOf(markerApp.root), 1)
  assert.equal(frames.size, 0, 'Unmount must cancel queued chart work')
  assert.equal(subscriptions.size, 0, 'Unmount must release chart subscriptions')

  let drawingReads = 0, priceOffset = 0
  const drawingProps = { chartApi: { timeScale: () => scale }, seriesApi: {
    priceToCoordinate: price => { drawingReads++; return price * 10 + priceOffset },
  }, drawings: [{ id: 'line', tool: 'horizontal-line', points: [{ time: from, price: 1 }] }],
    activeTool: null, selectedDrawingId: null, onSelectDrawing: () => {}, onCreateDrawing: () => 'new',
    onUpdateDrawingPoint: () => {}, onUpdatePositionWidth: () => {}, onExitDrawingMode: () => {} }
  const drawingApp = mount(ChartDrawingOverlay, drawingProps)
  await drawingApp.render()
  drawingReads = 0
  await React.act(async () => { for (let i = 0; i < 200; i++) for (const notify of subscriptions) notify() })
  assert.equal(drawingReads, 0)
  assert.equal(frames.size, 1, 'Drawing projections should also batch pan notifications')
  await React.act(async () => flushFrames())
  assert.equal(drawingReads, 1)
  const line = drawingApp.container.querySelector('line')
  assert.equal(line.getAttribute('y1'), '10')
  priceOffset = 7
  await drawingApp.render({ ...drawingProps })
  assert.equal(line.getAttribute('y1'), '17', 'A live price-scale change must still reposition saved drawings on the chart update')
  await React.act(async () => { for (const notify of subscriptions) notify() })
  await React.act(async () => drawingApp.root.unmount())
  roots.splice(roots.indexOf(drawingApp.root), 1)
  assert.equal(frames.size, 0)
  assert.equal(subscriptions.size, 0)

  let scoreRenders = 0
  const binding = { includesContext: true, Component: () => { scoreRenders++; return React.createElement('p', null, 'Scoring result') } }
  const scoreProps = { binding, release: markers[0].release, events: [], now: 1000 }
  const scoreApp = mount(InspectorScoringView, scoreProps)
  await scoreApp.render()
  for (let i = 0; i < 20; i++) await scoreApp.render({ ...scoreProps })
  assert.equal(scoreRenders, 1, 'Unrelated parent quote/bridge renders must not rebuild scoring content')
  await scoreApp.render({ ...scoreProps, now: 2000 })
  assert.equal(scoreRenders, 2, 'A meaningful scoring input update must still render')

  const timers = new Map(); let timerId = 0, starts = 0, stops = 0, wallTime = originalNow()
  dom.setInterval = callback => { starts++; timers.set(++timerId, callback); return timerId }
  dom.clearInterval = id => { stops++; timers.delete(id) }
  Date.now = () => wallTime
  let clock
  function Clock({ offset, enabled = true }) {
    const sample = useCalendarNow(offset, 10_000, enabled)
    React.useLayoutEffect(() => { clock = sample }, [sample])
    return null
  }
  const clockApp = mount(Clock, { offset: 0 })
  await clockApp.render()
  const initialClock = clock
  for (const offset of [2, -3, 9, -5, 12]) await clockApp.render({ offset })
  assert.equal(starts, 1)
  assert.equal(stops, 0, 'Polling corrections must not restart the calendar interval')
  assert.equal(clock, initialClock, 'Small polling corrections apply at the next sample, not as a second state update')
  wallTime += 10_000
  await React.act(async () => { for (const tick of timers.values()) tick() })
  assert.equal(clock, wallTime + 12)
  await clockApp.render({ offset: 5012 })
  assert.equal(clock, wallTime + 5012, 'A substantial clock correction must apply immediately')
  assert.equal(starts, 1)
  await clockApp.render({ offset: 5012, enabled: false })
  assert.equal(timers.size, 0, 'Disabled consumers must not keep redundant clocks running')
  await clockApp.render({ offset: 6000, enabled: true })
  assert.equal(clock, wallTime + 6000)
  assert.equal(timers.size, 1)
  await React.act(async () => clockApp.root.unmount())
  roots.splice(roots.indexOf(clockApp.root), 1)
  assert.equal(timers.size, 0)
  Date.now = originalNow

  const css = await readFile(path.join(rootDir, 'src/inspector/scoring/shared/ui/release-score.css'), 'utf8')
  assert.match(css, /\.inspector-publication-score\s*\{[^}]*overflow-y:\s*auto/)
  assert.match(css, /\.inspector-publication-score \.inspector-scoring-column \.inspector-scoring-view\s*\{[^}]*overflow:\s*visible/)
  assert.match(css, /\.inspector-publication-score \.inspector-scoring-column th\s*\{\s*position:\s*static/)
  console.log('Responsiveness: 100,000-row calendar indexed once; 100,000-marker chart projects 10 visible markers; 200 callbacks batch into one frame; clock and scoring render boundaries passed.')
} finally {
  Date.now = originalNow
  await React.act(async () => { for (const root of roots) root.unmount() })
  await server.close(); await dom.happyDOM.abort()
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
}
