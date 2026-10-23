import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, HTMLDialogElement: dom.HTMLDialogElement,
  Node: dom.Node, navigator: dom.navigator, localStorage: dom.localStorage, IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map([...Object.keys(globals), 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const timers = new Map(), requests = []; let serial = 0, rows = [], view
dom.setTimeout = fn => { timers.set(++serial, fn); return serial }; dom.clearTimeout = id => timers.delete(id)
const at = Date.UTC(2026, 9, 1, 12), chartAt = at / 1000 + 10800
const bars = [-1, 0, 1].map(hour => ({ time: chartAt + hour * 3600, open: 1, high: 2, low: .5, close: 1.5 }))
const utc = { mode: 'utc', utcOffsetMinutes: 0 }, broker = 'Pepperstone-Demo'
const clockOffsetMs = at - Date.now()
globalThis.fetch = async (url, options) => {
  requests.push({ url: String(url), signal: options.signal })
  const query = new URL(String(url), 'http://localhost').searchParams
  const body = String(url).endsWith('/health') ? { revision: 1, sources: [{ id: broker, publisher_status: 'live' }], collector_error: null }
    : { source_id: broker, revision: 1, timestamp_convention: 'trade_server_time', time_basis: 'chart', coverage: {}, next_cursor: null,
      // Deliberately return unrelated currencies too: client admission must still isolate the chart.
      events: rows, currencies: query.get('currencies') }
  return { ok: true, json: async () => body }
}
const scale = { getVisibleLogicalRange: () => ({ from: 0, to: 2 }), timeToCoordinate: () => 100,
  logicalToCoordinate: i => i * 100, timeToIndex: () => 1, width: () => 800,
  getVisibleRange: () => ({ from: bars[0].time, to: bars[2].time }),
  subscribeVisibleLogicalRangeChange() {}, unsubscribeVisibleLogicalRangeChange() {}, subscribeSizeChange() {}, unsubscribeSizeChange() {} }
const chartApi = { timeScale: () => scale, subscribeClick() {}, unsubscribeClick() {} }
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
const click = async selector => { const node = document.querySelector(selector); assert.ok(node, selector); await React.act(async () => node.click()) }
const action = async label => React.act(async () => [...document.querySelectorAll('dialog button')].find(node => node.textContent === label).click())
try {
  const data = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { chartEventSymbol, chartEventCurrencies, chartEventScope } = await server.ssrLoadModule('./src/economic-calendar/forex/chart-event-scope.ts')
  const { forexPair, majorForexPairs } = await server.ssrLoadModule('./src/economic-calendar/forex/pairs.ts')
  const { useInspector } = await server.ssrLoadModule('./src/inspector/useInspector.ts')
  const { InspectorPanel } = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  const { InspectorChartMarkers } = await server.ssrLoadModule('./src/inspector/InspectorChartMarkers.tsx')
  rows = ['JPY', 'EUR', 'USD', 'GBP'].map(currency => {
    const family = data.inspectorFamilies.find(f => f.currency === currency && f.category === 'inflation' && f.events.length)
    return { value_id: currency, event_id: family.events[0], currency, country_code: family.country, name: family.label,
      server_time_seconds: chartAt, chart_time_seconds: chartAt, release_at: at, availability: 'observed', period_seconds: 0,
      revision: 0, actual: .3, previous: .1, revised_previous: null, forecast: .4, unit: 1, multiplier: 0, digits: 1, time_mode: 0 }
  })
  function Harness({ symbol }) {
    const next = useInspector({ symbol, bars, timeframe: 'H1', timeDisplay: utc, clockOffsetMs, brokerId: broker, brokerOffsetSeconds: 10800 })
    React.useLayoutEffect(() => { view = next }, [next])
    return React.createElement(React.Fragment, null,
      React.createElement(InspectorChartMarkers, { chartApi, markers: next.markers, timeDisplay: utc, onSelectRelease: next.selectRelease }),
      React.createElement(InspectorPanel, { symbol, view: next, source: null, error: null, timeDisplay: utc }))
  }
  const render = symbol => React.act(async () => root.render(React.createElement(Harness, { symbol })))
  const scopes = { JPYX: 'JPY', EURX: 'EUR', USDX: 'USD', 'USDX-F': 'USD', JPN225: 'JPY', 'JPN225-F': 'JPY', XAUUSD: 'USD', 'XAUUSD-F': 'USD' }
  assert.equal(majorForexPairs.length, 28)
  for (const [symbol, currency] of Object.entries(scopes)) {
    assert.equal(forexPair(symbol), null, 'Instrument support must not change forex identities')
    assert.equal(chartEventScope(symbol), currency)
    assert.equal(chartEventSymbol(`${symbol}.pro`), symbol)
    assert.equal(chartEventCurrencies(symbol), chartEventCurrencies(`${symbol}.pro`), 'Scope arrays stay stable across reads/suffixes')
    await render(symbol)
    const query = new URL(requests.filter(request => request.url.includes('/calendar?')).at(-1).url, 'http://localhost').searchParams
    assert.equal(query.get('currencies'), currency, `${symbol}: stored calendar fetch is currency-scoped`)
    assert.equal(view.storage.error, null)
    assert.deepEqual(view.allReleases.map(release => release.currency), [currency])
    assert.equal(view.markers.length, 1)
    assert.equal(document.querySelector('[data-inspector-filter-trigger]').disabled, false)
    await click('.inspector-chart-symbol')
    assert.equal(view.selectedRelease.currency, currency)
    assert.match(host.querySelector('tbody').textContent, /0.3%/)
    await click('[data-inspector-filter-trigger]')
    assert.equal(document.querySelectorAll('dialog h3').length, 1)
    assert.ok(document.querySelector(`[aria-label="${currency} Events color"]`))
    await click(`[aria-label="Select all ${currency} Events"]`)
    assert.equal(view.markers.length, 0, 'Family changes preview immediately')
    await action('Cancel')
    assert.equal(view.markers.length, 1, 'Cancel restores icons')
  }
  for (const symbol of ['BTCUSD', 'EURUSDJPY', 'JPYXFAKE', 'XAUUSDT', 'USDX-PERP', 'JPN2250']) assert.equal(chartEventSymbol(symbol), null)
  // Save persists per instrument, while family selection is shared with FX.
  await render('JPYX')
  const jpyFamily = data.inspectorFamilies.find(f => f.currency === 'JPY' && f.category === 'inflation' && f.events.length)
  await React.act(async () => view.applyPreferences({ ...view.preferences, families: [jpyFamily.id], showSymbols: false, symbolGrouping: 'day' }))
  assert.equal(data.readInspectorPreferences('JPYX.pro').showSymbols, false)
  assert.equal(data.readInspectorPreferences('JPYX').symbolGrouping, 'day')
  assert.deepEqual(data.readInspectorPreferences('USDJPY').families.filter(id => id.startsWith('jp-') || id.startsWith('boj')), [jpyFamily.id])
  assert.equal(data.readInspectorPreferences('JPN225').showSymbols, true, 'Icon visibility stays per instrument')
  await render('USDX-F')
  await React.act(async () => view.applyPreferences({ ...view.preferences, showSymbols: false }))
  assert.equal(data.readInspectorPreferences('USDX-F').showSymbols, false)
  assert.equal(data.readInspectorPreferences('USDX').showSymbols, true, 'Forward and cash appearance remain separate')
  await render('JPYX')
  assert.equal(view.markers.length, 0, 'Saved appearance survives symbol switching')
  await React.act(async () => root.render(null))
  assert.equal(timers.size, 0)
  assert.ok(requests.every(request => request.signal.aborted), 'Symbol switches/unmount cancel outstanding calendar work')
  console.log('✓ Eight instrument charts: scoped broker reads, markers→raw tables, single-currency filters, Save/Cancel, shared FX families and independent appearance')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
