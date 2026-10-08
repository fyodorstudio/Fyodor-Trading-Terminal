import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'),
  server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const animationFrames = new Map(); let nextFrame = 0
// Projection is deferred to one animation frame, as in the real chart.
dom.requestAnimationFrame = fn => { animationFrames.set(++nextFrame, fn); return nextFrame }
dom.cancelAnimationFrame = id => animationFrames.delete(id)
const flushAnimationFrames = () => { for (const [id, fn] of animationFrames) { animationFrames.delete(id); fn() } }

const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT', 'fetch']
const previous = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys.slice(0, 7)) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.appendChild(container)
const root = createRoot(container)
const now = Date.UTC(2026, 9, 5, 12), lastTime = now / 1000 + 10800
const clockOffsetMs = now - Date.now()
const at = now + 75 * 60000
const event = (overrides = {}) => ({ value_id: 'upcoming-cpi', event_id: '840030005', name: 'CPI m/m',
  currency: 'USD', country_code: 'US', country_name: 'United States', event_code: 'cpi',
  server_time_seconds: at / 1000 + 10800, chart_time_seconds: at / 1000 + 10800, release_at: at,
  period_seconds: 0, revision: 0, time_mode: 0, importance: 'high', impact: 'none',
  unit: 1, multiplier: 0, digits: 1, actual: null, previous: .2, forecast: .3, revised_previous: null, ...overrides })
const bars = [lastTime - 3600, lastTime].map((time) => ({ time, open: 1, high: 2, low: .5, close: 1.5 }))

try {
  const data = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { inspectorMarkerCoordinate } = await server.ssrLoadModule('./src/inspector/marker-position.ts')
  const { InspectorChartMarkers } = await server.ssrLoadModule('./src/inspector/InspectorChartMarkers.tsx')
  const { useInspector } = await server.ssrLoadModule('./src/inspector/useInspector.ts')
  const { InspectorPanel } = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  const preferences = { ...data.defaultInspectorPreferences(), families: ['us-cpi'] }
  const releases = data.groupInspectorReleases([event()])
  const markers = data.buildInspectorMarkers(releases, preferences, bars, 'H1')
  assert.equal(markers.length, 1)
  assert.equal(markers[0].time, lastTime + 3600)
  assert.deepEqual(markers[0].projection, { anchorTime: lastTime, barsAhead: 1 })
  assert.equal(markers[0].release.events[0].actual, null, 'Symbols do not require an Actual')
  const durations = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400 }
  for (const [timeframe, seconds] of Object.entries(durations)) {
    const target = lastTime + 2 * seconds + seconds / 2
    const rows = data.groupInspectorReleases([event({ release_at: (target - 10800) * 1000,
      chart_time_seconds: target, server_time_seconds: target })])
    const marker = data.buildInspectorMarkers(rows, preferences, bars, timeframe)[0]
    assert.deepEqual(marker.projection, { anchorTime: lastTime, barsAhead: 2 }, timeframe)
  }
  assert.equal(data.buildInspectorMarkers(releases, { ...preferences, showSymbols: false }, bars, 'H1').length, 0)
  assert.equal(data.buildInspectorMarkers(releases, preferences, [], 'H1').length, 0)
  for (const overrides of [{ time_mode: 1 }, { chart_time_seconds: null }, { chart_time_seconds: NaN }]) {
    assert.equal(data.buildInspectorMarkers(data.groupInspectorReleases([event(overrides)]), preferences, bars, 'H1').length, 0)
  }
  const candle = { ...bars[1], time: lastTime + 3600 }
  const actual = data.groupInspectorReleases([event({ actual: .4 })])
  const anchored = data.buildInspectorMarkers(actual, preferences, [...bars, candle], 'H1')[0]
  assert.equal(anchored.projection, undefined)
  assert.equal(anchored.time, candle.time)
  assert.equal(anchored.release.id, markers[0].release.id, 'Upcoming→released keeps the same selectable release')
  assert.equal(data.buildInspectorMarkers(actual, preferences, bars, 'H1')[0].time, markers[0].time,
    'Actual arriving before a candle does not remove the marker')

  const subscriptions = new Set()
  let origin = 100, spacing = 40, width = 500
  const anchorIndex = 20
  const scale = { timeToCoordinate: (time) => time <= lastTime + 3600 ? 160 : null,
    timeToIndex: (time) => time === lastTime ? anchorIndex : null,
    logicalToCoordinate: (index) => origin + (index - 20) * spacing,
    width: () => width, subscribeVisibleLogicalRangeChange: (fn) => subscriptions.add(fn),
    subscribeSizeChange: (fn) => subscriptions.add(fn), unsubscribeVisibleLogicalRangeChange: (fn) => subscriptions.delete(fn),
    unsubscribeSizeChange: (fn) => subscriptions.delete(fn) }
  assert.equal(inspectorMarkerCoordinate(scale, markers[0]), 140)
  assert.equal(inspectorMarkerCoordinate(scale, anchored), 160)
  assert.equal(inspectorMarkerCoordinate({ ...scale, timeToIndex: () => null }, markers[0]), null)
  assert.equal(inspectorMarkerCoordinate({ ...scale, logicalToCoordinate: () => NaN }, markers[0]), null)

  let view
  function App({ chartBars = bars, rows = [event()] }) {
    const inspector = useInspector({ events: rows, symbol: 'EURUSD', bars: chartBars, timeframe: 'H1',
      timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 }, clockOffsetMs })
    React.useEffect(() => { view = inspector }, [inspector])
    return React.createElement(React.Fragment, null,
      React.createElement(InspectorChartMarkers, { chartApi: { timeScale: () => scale }, markers: inspector.markers,
        timeDisplay: { mode: 'fixed-offset', utcOffsetMinutes: 420 }, onSelectRelease: inspector.selectRelease }),
      React.createElement(InspectorPanel, { view: inspector, symbol: 'EURUSD', source: null, error: null,
        timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 } }))
  }
  globalThis.fetch = () => { throw new Error('Upcoming releases must not fetch magnitude history') }
  const render = (props = {}) => React.act(async () => root.render(React.createElement(App, props)))
  await render()
  const markerButton = () => container.querySelector('.inspector-chart-symbol')
  assert.ok(markerButton()); assert.equal(container.querySelector('.inspector-marker-cluster').style.left, '140px')
  assert.match(container.querySelector('.inspector-release').textContent, /Upcoming/)
  assert.match(markerButton().title, /20:15/)
  await React.act(async () => markerButton().click())
  assert.equal(view.selectedRelease.id, markers[0].release.id)
  assert.match(container.querySelector('table').textContent, /CPI m\/m/)
  await React.act(async () => { origin = 600; for (const fn of subscriptions) fn(); flushAnimationFrames() })
  assert.equal(markerButton(), null, 'Future markers outside the visible viewport stay off-screen')
  await React.act(async () => { origin = 100; spacing = 80; for (const fn of subscriptions) fn(); flushAnimationFrames() })
  assert.equal(container.querySelector('.inspector-marker-cluster').style.left, '180px', 'Zoom changes projected positions')
  await React.act(async () => { width = 150; for (const fn of subscriptions) fn(); flushAnimationFrames() })
  assert.equal(markerButton(), null)
  await React.act(async () => { width = 500; for (const fn of subscriptions) fn(); flushAnimationFrames() })
  assert.ok(markerButton())
  await render({ chartBars: [...bars, candle], rows: [event({ actual: .4 })] })
  assert.equal(view.selectedRelease.id, markers[0].release.id)
  assert.equal(view.markers[0].projection, undefined)
  assert.equal(container.querySelector('.inspector-marker-cluster').style.left, '160px')
  await React.act(async () => view.applyPreferences({ ...preferences, families: [] }))
  assert.equal(markerButton(), null, 'Applied family filters also remove projected symbols')
  await React.act(async () => root.unmount())
  assert.equal(subscriptions.size, 0)
  console.log('✓ Upcoming markers across every timeframe, exact broker clock, pan/zoom/resize, click-to-inspect, filters, missing timing, released transition and cleanup')
} finally {
  await React.act(async () => root.unmount())
  await server.close(); await dom.happyDOM.abort(); dom.close()
  for (const key of keys) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key] }
}
