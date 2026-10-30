import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node,
  navigator: dom.navigator, IS_REACT_ACT_ENVIRONMENT: true, fetch: undefined }
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
let now = Date.UTC(2026, 9, 28, 12), id = 0
const originalNow = Date.now
Date.now = () => now
const timers = new Map(), intervals = new Map(), pending = []
dom.setTimeout = (fn, ms) => { timers.set(++id, { fn, ms }); return id }
dom.clearTimeout = id => timers.delete(id)
dom.setInterval = (fn, ms) => { intervals.set(++id, { fn, ms }); return id }
dom.clearInterval = id => intervals.delete(id)
globalThis.fetch = (url, options) => new Promise((resolve, reject) => {
  assert.equal(url, '/storage-api/market-watch/daily')
  pending.push({ resolve, reject, options, body: JSON.parse(options.body) })
  options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
})
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.appendChild(host)
const root = createRoot(host)
let latest, renderCount = 0
try {
  const { useDailyMarketQuotes, pepperstoneDay } = await server.ssrLoadModule('./src/market-data/mt5-feed/use-daily-market-quotes.ts')
  const { ChartWorkspaceHeader } = await server.ssrLoadModule('./src/terminal-shell/ChartWorkspaceHeader.tsx')
  const { forexSessions } = await server.ssrLoadModule('./src/market-data/market-watch/forex-sessions.ts')
  const { dailyRangeLabel } = await server.ssrLoadModule('./src/market-data/market-watch/daily-range.ts')
  function Probe({ generation = 1, connected = true, selected = 'EURUSD' }) {
    const data = useDailyMarketQuotes(connected, generation, 'Pepperstone-Demo', selected)
    React.useEffect(() => { latest = data })
    renderCount++
    return React.createElement(ChartWorkspaceHeader, { symbol: selected,
      quote: data.symbols.find(quote => quote.symbol === selected) ?? null, timeframe: 'H1', onSelectTimeframe() {} })
  }
  const render = props => React.act(async () => root.render(React.createElement(Probe, props)))
  const raw = ['EURUSD', 'NZDUSD', 'USDIDR'].map(symbol => ({ symbol, description: symbol, bid: 1.108, ask: 1.109,
    dailyChange: 99, precision: 5 }))
  const update = quotes => React.act(async () => latest.updateQuotes(quotes))
  const reply = async ({ fail = false, generation = 1, day = pepperstoneDay(now), close = 1.1 } = {}) => {
    const request = pending.shift(); assert.ok(request)
    await React.act(async () => request.resolve({ ok: !fail, json: async () => ({ source_id: 'Pepperstone-Demo', generation,
      day, observed_at: now / 1000, symbols: Object.fromEntries(request.body.symbols.map(symbol => [symbol,
        { previous_close: close, high: 1.1088, low: 1.1038, checked_at: now / 1000 }])) }) }))
    return request
  }
  const poll = async () => {
    const timer = [...timers].find(([, timer]) => timer.ms === 5000); assert.ok(timer)
    timers.delete(timer[0]); await React.act(async () => { void timer[1].fn() })
  }
  await render()
  await update(raw)
  assert.equal(latest.symbols[0].dailyChange, null, 'Session change is never used as a fallback')
  await reply()
  assert.ok(Math.abs(latest.symbols[0].dailyChange - (1.108 / 1.1 - 1) * 100) < 1e-10)
  assert.ok(host.textContent.includes('8 pips below high · 42 pips above low'))
  assert.equal(host.querySelector('.quote-summary'), null)
  assert.equal(host.querySelectorAll('.session-timeline-labels span').length, 4)
  const quoteIdentity = latest.symbols, beforeRender = renderCount
  await poll(); await reply()
  assert.equal(latest.symbols, quoteIdentity, 'Unchanged daily replies retain the entire quote array')
  assert.equal(renderCount, beforeRender, 'An unchanged daily poll does not rerender the shell')
  const first = latest.symbols[0]
  await update(raw.map(quote => quote.symbol === 'NZDUSD' ? { ...quote, bid: 1.109 } : quote))
  assert.equal(latest.symbols[0], first, 'Only changed quote rows get new identities')
  await update(raw.map(quote => quote.symbol === 'EURUSD' ? { ...quote, bid: 1.11 } : quote))
  assert.equal(latest.symbols[0].dailyHigh, 1.11, 'A live quote extends the running daily high')
  await update(raw)
  assert.equal(latest.symbols[0].dailyHigh, 1.11, 'An intrapoll pullback cannot erase the new high')
  await poll(); await reply({ close: null })
  assert.equal(latest.symbols[0].dailyChange, null, 'Missing previous history stays unavailable')
  await poll(); await reply({ fail: true })
  assert.equal(latest.symbols[0].dailyHigh, null)
  await render({ selected: 'USDIDR' })
  assert.equal(host.querySelector('.market-instrument-badge').textContent, 'NDF')
  const obsolete = pending.shift(); assert.ok(obsolete)
  await render({ generation: 2, selected: 'USDIDR' })
  assert.ok(obsolete.options.signal.aborted)
  await update(raw)
  await reply({ generation: 2 })
  assert.equal(latest.symbols.length, 3)
  now += 86400000
  await update(raw)
  assert.equal(latest.symbols[0].dailyChange, null, 'Broker midnight invalidates the previous anchor immediately')
  await render({ connected: false, generation: 2 })
  assert.deepEqual(latest.symbols, [])
  assert.equal(timers.size, 0, 'Disconnect aborts daily requests and clears their timers')

  assert.equal(dailyRangeLabel({ ...raw[0], symbol: 'USDJPY', bid: 150, precision: 3, dailyHigh: 150.08, dailyLow: 149.58 }),
    'Today: 8 pips below high · 42 pips above low')
  assert.equal(dailyRangeLabel({ ...raw[0], symbol: 'XAUUSD', bid: 2700, precision: 2, dailyHigh: 2708, dailyLow: 2690 }),
    'Today: 8.00 price units below high · 10.00 price units above low')
  for (const [at, londonHour, nyHour, sydneyHour] of [
    [Date.UTC(2026, 0, 14, 12), 8, 13, 20], [Date.UTC(2026, 5, 15, 12), 7, 12, 21],
    [Date.UTC(2026, 2, 24, 12), 8, 12, 20], [Date.UTC(2026, 9, 28, 12), 8, 12, 20],
  ]) {
    const sessions = forexSessions(at).sessions
    const openHours = name => sessions.find(session => session.name === name).windows.map(window => new Date(window.open).getUTCHours())
    assert.ok(openHours('London').every(hour => hour === londonHour))
    assert.ok(openHours('New York').every(hour => hour === nyHour))
    assert.ok(openHours('Tokyo').every(hour => hour === 0))
    assert.ok(openHours('Sydney').every(hour => hour === sydneyHour))
    assert.ok(sessions.every(session => session.windows.length > 0))
  }
  assert.ok(forexSessions(Date.UTC(2026, 9, 31, 6)).sessions.every(session => !session.active), 'Weekend sessions are inactive')
  const beforeClock = renderCount
  now += 60000
  await React.act(async () => [...intervals.values()][0].fn())
  assert.equal(renderCount, beforeClock, 'Session timing ticks stay local to the session widget')
  await React.act(async () => root.unmount())
  assert.equal(intervals.size, 0)
  console.log('✓ Previous D1 close, daily extremes, missing history, source/rollover guards, stable polling, NDF details and four DST-aware sessions')
} finally {
  await React.act(async () => root.unmount())
  await server.close(); await dom.happyDOM.close(); Date.now = originalNow
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
