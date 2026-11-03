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
const originalNow = Date.now
let now = Date.UTC(2026, 10, 2, 12), sequence = 0
Date.now = () => now
const pending = [], timers = new Map(), intervals = new Map()
dom.setTimeout = (fn, ms) => { timers.set(++sequence, { fn, ms }); return sequence }
dom.clearTimeout = id => timers.delete(id)
dom.setInterval = (fn, ms) => { intervals.set(++sequence, { fn, ms }); return sequence }
dom.clearInterval = id => intervals.delete(id)
globalThis.fetch = (url, options) => new Promise(resolve => {
  assert.equal(url, '/storage-api/market-watch/daily')
  pending.push({ resolve, options, body: JSON.parse(options.body) })
})
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  server: { middlewareMode: true, hmr: false }, plugins: [{ name: 'history-render-count', enforce: 'pre',
    transform(code, id) { if (id.endsWith('/MarketWatchPanel.tsx')) return code.replace('const positive = quote.dailyChange != null',
      'globalThis.__historyRows++; const positive = quote.dailyChange != null') } }] })
globalThis.__historyRows = 0
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.appendChild(host)
const root = createRoot(host)
const onSelect = () => {}
const quotes = ['EURUSD', 'GBPUSD'].map(symbol => ({ symbol, description: symbol, bid: 100, ask: 101, dailyChange: .3, precision: 2 }))
const props = node => node[Object.getOwnPropertyNames(node).find(key => key.startsWith('__reactProps$'))]
const button = label => host.querySelector(`button[aria-label="${label}"]`)
const input = () => host.querySelector('input[type="date"]')
const row = symbol => [...host.querySelectorAll('.market-watch-row')].find(node => node.textContent.includes(symbol))
const click = node => React.act(async () => { assert.ok(node); node.click() })
const selectDate = date => React.act(async () => props(input()).onChange({ target: { value: date } }))
const reply = async (request, records, overrides = {}) => React.act(async () => request.resolve({ ok: true,
  json: async () => ({ source_id: request.body.source_id, generation: request.body.generation,
    day: Date.parse(`${request.body.date}T00:00:00Z`) / 1000, observed_at: now / 1000, symbols: records, ...overrides }) }))
const daily = (open, high, low) => ({ open, high, low, checked_at: now / 1000 })
try {
  const { MarketWatchPanel } = await server.ssrLoadModule('./src/market-data/market-watch/MarketWatchPanel.tsx')
  const { maximumDailyChange } = await server.ssrLoadModule('./src/market-data/market-watch/daily-change.ts')
  const render = overrides => React.act(async () => root.render(React.createElement(MarketWatchPanel, {
    symbols: quotes, selectedSymbol: 'EURUSD', brokerId: 'Pepperstone-Demo', generation: 1,
    status: 'live', error: null, onSelect, ...overrides })))
  await render()
  assert.equal(host.querySelector('.market-watch-heading'), null)
  assert.equal(host.querySelector('.market-watch-count'), null)
  assert.equal(host.querySelector('.market-watch-date').nextElementSibling.className, 'market-watch-columns')
  assert.equal(button('Return to today').textContent, 'Today')
  assert.equal(button('Next day').disabled, true)
  assert.equal(pending.length, 0, 'Live values reuse the feed without a second daily poll')
  await selectDate('2026-10-30')
  assert.equal(button('Return to today').textContent, 'History')
  assert.ok(button('Return to today').classList.contains('history'))
  assert.ok(row('EURUSD').textContent.includes('—'), 'Date changes never leak today’s live values')
  const first = pending.shift()
  assert.equal(first.body.date, '2026-10-30')
  await reply(first, { EURUSD: daily(100, 102, 99), GBPUSD: daily(100, 101, 96) })
  assert.ok(row('EURUSD').textContent.includes('+2.00%'))
  assert.ok(row('GBPUSD').textContent.includes('-4.00%'))
  assert.equal(row('EURUSD').querySelector('.positive').textContent, '+2.00%')
  assert.equal(row('GBPUSD').querySelector('.negative').textContent, '-4.00%')
  const rendered = globalThis.__historyRows
  await React.act(async () => [...intervals.values()][0].fn())
  assert.equal(globalThis.__historyRows, rendered, 'The date clock does no row work')
  await render({ symbols: quotes.map(quote => ({ ...quote, bid: 99, dailyChange: -.9 })) })
  assert.ok(row('EURUSD').textContent.includes('+2.00%'), 'Live ticks do not overwrite historical percentages')
  assert.equal(globalThis.__historyRows, rendered, 'Live quote ticks do no historical row rendering')
  await click(button('Sort symbols'))
  await click([...host.querySelectorAll('.market-watch-sort-options button')].find(node => node.textContent.includes('highest first')))
  assert.equal(host.querySelector('.market-watch-row strong').textContent, 'EURUSD')
  await click(button('Previous day'))
  const obsolete = pending.shift()
  await click(button('Previous day'))
  const current = pending.shift()
  assert.ok(obsolete.options.signal.aborted, 'Rapid date changes abort the previous request')
  await reply(obsolete, { EURUSD: daily(100, 199, 99) })
  assert.ok(row('EURUSD').textContent.includes('—'), 'A late historical reply cannot repaint the selected date')
  await reply(current, { EURUSD: daily(100, 101, 99), GBPUSD: daily(100, 105, 99) })
  assert.equal(host.querySelector('.market-watch-row strong').textContent, 'GBPUSD', 'Sorting resets for each selected day')
  await click(button('Return to today'))
  assert.equal(input().value, '2026-11-02')
  assert.ok(row('EURUSD').textContent.includes('-0.90%'))
  await selectDate('2026-11-03')
  assert.equal(input().value, '2026-11-02', 'Future dates are rejected')
  await selectDate('2026-11-01')
  await reply(pending.shift(), { EURUSD: { ...daily(null, null, null), availability: 'no_candle' }, GBPUSD: { ...daily(null, null, null), availability: 'no_candle' } })
  assert.ok(row('EURUSD').textContent.includes('—'), 'Non-trading days stay empty rather than borrowing Friday')
  assert.ok(host.textContent.includes('No daily candle for 2 of 2 instruments'))
  assert.ok(!host.textContent.includes('Retry'), 'A confirmed empty broker date is informative, not a load error')
  await selectDate('2026-10-30')
  const oldSource = pending.shift()
  await render({ generation: 2 })
  assert.ok(oldSource.options.signal.aborted)
  await reply(oldSource, { EURUSD: daily(100, 199, 99) })
  assert.ok(row('EURUSD').textContent.includes('—'))
  await reply(pending.shift(), {}, { source_id: 'Other' })
  assert.ok(host.textContent.includes('Historical daily candles unavailable'))
  await click([...host.querySelectorAll('button')].find(node => node.textContent === 'Retry'))
  const partial = pending.shift()
  assert.equal(partial.body.retry, true, 'Explicit retry asks the service to bypass its missing-candle backoff')
  await reply(partial, { EURUSD: daily(100, 102, 99) })
  assert.ok(row('EURUSD').textContent.includes('+2.00%'))
  assert.ok(row('GBPUSD').textContent.includes('—'))
  const timer = [...timers].find(([, timer]) => timer.ms === 5000)
  timers.delete(timer[0]); await React.act(async () => { void timer[1].fn() })
  const loading = pending.shift()
  await render({ visible: false, generation: 2 })
  assert.ok(loading.options.signal.aborted)
  assert.equal(timers.size, 0)
  assert.equal(intervals.size, 0, 'Hiding the dock clears its date clock and history requests')
  await render({ generation: 2 })
  assert.equal(input().value, '2026-10-30', 'Hiding the dock preserves the chosen historical date')
  assert.equal(maximumDailyChange(100, 104, 98), 4)
  assert.equal(maximumDailyChange(100, 102, 95), -5)
  assert.equal(maximumDailyChange(100, 102, 98), 2)
  for (const values of [[null, 104, 98], [0, 104, 98], [100, Infinity, 98], [100, 99, 98], [100, 104, 101]])
    assert.equal(maximumDailyChange(...values), null)
  console.log('✓ Daily history navigation, maximum moves, colors/sorting, live isolation, missing days, stale replies, source guards, partial loading and cleanup')
} finally {
  await React.act(async () => root.unmount())
  await server.close(); await dom.happyDOM.close(); Date.now = originalNow
  delete globalThis.__historyRows
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
