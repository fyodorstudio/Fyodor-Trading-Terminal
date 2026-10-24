import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node, navigator: dom.navigator,
  localStorage: dom.localStorage, IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map([...Object.keys(globals), 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const frames = new Map(), timers = new Map(), rangeListeners = new Set(), sizeListeners = new Set(), clickListeners = new Set()
let serial = 0, coordinateReads = 0, itemReads = 0, selected = null
dom.requestAnimationFrame = fn => { frames.set(++serial, fn); return serial }; dom.cancelAnimationFrame = id => frames.delete(id)
dom.setTimeout = (fn, ms) => { timers.set(++serial, { fn, ms }); return serial }; dom.clearTimeout = id => timers.delete(id)
const last = Date.UTC(2026, 9, 14, 12) / 1000
const bars = [last - 3600, last].map(time => ({ time, open: 1, high: 2, low: .5, close: 1.5 }))
const utcClock = { brokerId: null, brokerOffsetSeconds: 0 }
const item = (key, event_at, extra = {}) => ({ id: 'a'.repeat(32), key, title: key, currencies: ['USD'], kind: 'scheduled', status: 'confirmed', facts: 'Verified schedule', interpretation: '',
  event_at, event_date: null, published_utc: null, time_note: 'Official schedule.', saved_utc: '2026-10-13T17:00:00Z', archived: false, expected_version: null,
  sources: [{ kind: 'web', label: 'Treasury', locator: 'https://home.treasury.gov/', note: '' }], ...extra })
let items = [item('future', '2026-10-14T15:00:00Z')]
const scale = { width: () => 600, getVisibleRange: () => ({ from: last - 3600, to: last }),
  timeToCoordinate: time => { coordinateReads++; return 40 + (time - last + 3600) / 3600 * 40 },
  timeToIndex: time => { coordinateReads++; return bars.findIndex(bar => bar.time === time) },
  logicalToCoordinate: logical => { coordinateReads++; return 40 + logical * 40 },
  subscribeVisibleLogicalRangeChange: fn => rangeListeners.add(fn), unsubscribeVisibleLogicalRangeChange: fn => rangeListeners.delete(fn),
  subscribeSizeChange: fn => sizeListeners.add(fn), unsubscribeSizeChange: fn => sizeListeners.delete(fn) }
const chartApi = { timeScale: () => scale, subscribeClick: fn => clickListeners.add(fn), unsubscribeClick: fn => clickListeners.delete(fn) }
globalThis.fetch = async url => {
  itemReads++
  const query = new URL(String(url), 'http://localhost').searchParams
  return { ok: true, json: async () => ({ revision: '1', scope: query.get('scope'), visibility: 'all', offset: 0, matches: items.length, next_offset: null,
    ...(query.has('after_revision') ? { unchanged: true } : { items }) }) }
}
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
try {
  const { buildExternalMarkers, projectExternalMarkers } = await server.ssrLoadModule('./src/external-sources/external-markers.ts')
  const { ExternalChartMarkers } = await server.ssrLoadModule('./src/external-sources/ExternalChartMarkers.tsx')
  const { DisplayClockContext } = await server.ssrLoadModule('./src/appearance/time-display/useDisplayClock.ts')
  const { setExternalIconVisibility, externalIconEnabled } = await server.ssrLoadModule('./src/external-sources/external-icon-visibility.ts')
  const requested = item('requested', '2026-10-14T15:00:00Z', { chart_icon_request_id: 'b'.repeat(32) })
  assert.equal(externalIconEnabled(requested, { requested: false }), true, 'Agent request supersedes a legacy hidden preference')
  assert.equal(externalIconEnabled(requested, { requested: { visible: false, requestId: 'b'.repeat(32) } }), false, 'User can hide the icon again after the request')
  assert.equal(externalIconEnabled({ ...requested, id: 'c'.repeat(32) }, { requested: { visible: false, requestId: 'b'.repeat(32) } }), false, 'Research corrections do not undo a later user choice')
  assert.equal(externalIconEnabled({ ...requested, chart_icon_request_id: 'c'.repeat(32) }, { requested: { visible: false, requestId: 'b'.repeat(32) } }), true, 'A subsequent assessment can explicitly show it again')
  assert.equal(externalIconEnabled({ ...requested, archived: true }, {}), false, 'Archived records still default off')
  const durations = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400 }
  for (const [timeframe, duration] of Object.entries(durations)) {
    const future = item('scheduled', new Date((last + duration * 2.5) * 1000).toISOString())
    const marker = buildExternalMarkers([future], bars, timeframe, utcClock)[0]
    assert.deepEqual(marker.projection, { anchorTime: last, barsAhead: 2 }, timeframe)
    assert.equal(marker.item.event_at, future.event_at, 'Chart bucket retains the exact publication clock')
  }
  const beforeDst = item('october', '2026-10-14T15:00:00Z'), afterDst = item('november', '2026-11-04T13:30:00Z')
  assert.equal(buildExternalMarkers([beforeDst], bars, 'H1', { brokerId: 'Elev8-Demo2', brokerOffsetSeconds: 10800 })[0].time, Date.UTC(2026, 9, 14, 18) / 1000)
  assert.equal(buildExternalMarkers([afterDst], bars, 'H1', { brokerId: 'Elev8-Demo2', brokerOffsetSeconds: 10800 })[0].time, Date.UTC(2026, 10, 4, 15) / 1000)
  assert.equal(buildExternalMarkers([item('watch', null, { kind: 'watch' }), item('archived', beforeDst.event_at, { archived: true })], bars, 'H1', utcClock).length, 0)
  assert.equal(buildExternalMarkers([item('gap', '2026-10-13T00:00:00Z')], bars, 'H1', utcClock).length, 0)
  const dateOnly = buildExternalMarkers([item('date-only', null, { event_date: '2026-11-04' })], bars, 'H1', utcClock)[0]
  assert.equal(dateOnly.item.event_at, null); assert.equal(dateOnly.dayEnd - dateOnly.time, 86400)
  const historical = Array.from({ length: 10000 }, (_, index) => ({ item: beforeDst, time: last - 20000 - index }))
  coordinateReads = 0; projectExternalMarkers(scale, historical)
  assert.equal(coordinateReads, 0, 'Offscreen historical markers perform no chart coordinate queries')
  const anchoredBars = [...bars, ...[1, 2, 3].map(hours => ({ ...bars[0], time: last + hours * 3600 }))]
  assert.equal(buildExternalMarkers([beforeDst], anchoredBars, 'H1', utcClock)[0].projection, undefined)
  const { CalendarLayers } = await server.ssrLoadModule('./src/terminal-shell/chart-overlays/CalendarLayers.tsx')
  const render = async (rows, symbol = 'EURUSD', composed = false) => {
    await React.act(async () => root.render(React.createElement(DisplayClockContext.Provider,
      { value: { scope: utcClock, preference: { mode: 'fixed-offset', utcOffsetMinutes: 420 } } },
      React.createElement(composed ? CalendarLayers : ExternalChartMarkers, { chartApi, symbol, bars, timeframe: 'H1', brokerRows: rows,
        supported: false, markers: [], currencyColors: {}, timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 }, onSelectRelease: () => {},
        onSelectExternal: key => { selected = key }, onSelect: key => { selected = key } }))))
    await React.act(async () => { for (const [id, fn] of frames) { frames.delete(id); fn() } })
  }
  await render(1)
  assert.equal(container.querySelector('.external-chart-markers').style.bottom, '68px')
  const star = container.querySelector('.external-chart-star')
  assert.equal(star.textContent, '★'); assert.ok(star.title.includes('22:00'))
  await React.act(async () => star.click()); assert.equal(selected, 'future')
  await render(2)
  assert.equal(container.querySelector('.external-chart-markers').style.bottom, '102px', 'Custom row clears both daily currency icons')
  coordinateReads = 0
  await React.act(async () => { for (let count = 0; count < 50; count++) for (const fn of rangeListeners) fn() })
  assert.equal(frames.size, 1, 'Pan notifications share one animation frame')
  await React.act(async () => { for (const [id, fn] of frames) { frames.delete(id); fn() } })
  assert.equal(coordinateReads, 2, 'One projected star needs one anchor lookup and one logical coordinate')
  coordinateReads = 0
  const timer = [...timers][0]; timers.delete(timer[0]); await React.act(async () => timer[1].fn())
  assert.equal(coordinateReads, 0, 'Unchanged external polling does not reproject stars')
  assert.equal(itemReads, 2)
  await React.act(async () => { assert.equal(setExternalIconVisibility('future', false), true) }); await render(2)
  assert.equal(container.querySelector('.external-chart-star'), null)
  await React.act(async () => setExternalIconVisibility('future', true)); await render(2)
  assert.ok(container.querySelector('.external-chart-star'))
  await render(1, 'GBPJPY')
  assert.equal(container.querySelector('.external-chart-star'), null, 'USD news cannot leak onto non-USD pairs even if a response includes it')
  await render(1, 'USDJPY')
  assert.ok(container.querySelector('.external-chart-star'), 'USD news and its shared visibility preference follow a different USD pair')
  for (const symbol of ['USDX', 'USDX-F', 'XAUUSD', 'XAUUSD-F']) {
    await render(1, symbol)
    assert.ok(container.querySelector('.external-chart-star'), `${symbol}: USD external context follows the mapped currency`)
  }
  for (const symbol of ['JPYX', 'JPN225', 'JPN225-F', 'EURX']) {
    await render(1, symbol)
    assert.equal(container.querySelector('.external-chart-star'), null, `${symbol}: unrelated USD context is excluded`)
  }
  const oldItems = items
  items = [item('oil-supply', '2026-10-14T15:00:00Z', { currencies: [], instruments: ['BRENT'], chart_icon_request_id: 'b'.repeat(32) })]
  await render(1, 'SpotBrent', true)
  assert.ok(container.querySelector('.external-chart-star'), 'Instrument-only source appears on its Brent chart')
  await render(1, 'EURUSD')
  assert.equal(container.querySelector('.external-chart-star'), null, 'Commodity facts do not imply USD currency relevance')
  await render(1, 'XAUUSD')
  assert.equal(container.querySelector('.external-chart-star'), null, 'Brent source does not leak onto gold')
  items = oldItems
  await render(1, 'EURUSD')
  // A new persisted request travels through polling, marker construction and the chart.
  await React.act(async () => setExternalIconVisibility('future', false)); await render(1)
  assert.equal(container.querySelector('.external-chart-star'), null)
  items = [{ ...items[0], id: 'b'.repeat(32), chart_icon_request_id: 'b'.repeat(32) }]
  await React.act(async () => root.render(null)); await render(1)
  assert.ok(container.querySelector('.external-chart-star'), 'Saved agent request shows an existing hidden USD event')
  await React.act(async () => setExternalIconVisibility('future', false, 'b'.repeat(32))); await render(1)
  assert.equal(container.querySelector('.external-chart-star'), null, 'User hide works after the persisted request')
  await React.act(async () => setExternalIconVisibility('future', true, 'b'.repeat(32))); await render(1)
  // Custom collisions open a separate chooser; no Inspector occurrence is manufactured.
  items = [beforeDst, item('neighbor', '2026-10-14T15:01:00Z')]
  await React.act(async () => root.render(null)); await render(1)
  await React.act(async () => container.querySelector('.external-chart-star').click())
  assert.ok(container.querySelector('.external-chart-popup'))
  await React.act(async () => [...container.querySelectorAll('.external-chart-popup button')].find(button => button.textContent.startsWith('neighbor')).click())
  assert.equal(selected, 'neighbor')
  await React.act(async () => root.render(null))
  assert.equal(timers.size, 0); assert.equal(frames.size, 0); assert.equal(rangeListeners.size, 0); assert.equal(sizeListeners.size, 0); assert.equal(clickListeners.size, 0)
  console.log('✓ Custom stars: seven timeframes, DST, exact/date-only/untimed clocks, future→candle placement, separate elevated rows, clicks, collisions, deterministic work and cleanup')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
