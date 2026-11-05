import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node,
  navigator: dom.navigator, IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map([...Object.keys(globals), 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const originalNow = Date.now
let now = Date.UTC(2026, 10, 5, 1), sequence = 0, closes = 0
Date.now = () => now
const requests = [], intervals = new Map()
dom.setInterval = fn => { intervals.set(++sequence, fn); return sequence }
dom.clearInterval = id => intervals.delete(id)
globalThis.fetch = (url, options) => new Promise(resolve => requests.push({ url, signal: options.signal, resolve }))
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.append(container)
const root = createRoot(container)
const query = request => new URL(request.url, 'http://localhost').searchParams
const row = (id, currency = 'USD', at = now - 3600000) => ({ value_id: id, event_id: 'unknown-allowed', name: `${currency} event ${id}`,
  currency, release_at: at, actual: 0, forecast: null, previous: 1.2, revised_previous: 1.3, unit: 1, multiplier: 0, digits: 1,
  country_code: 'US', chart_time_seconds: null, availability: 'observed' })
async function reply(request, events = [], overrides = {}, status = 200) {
  const q = query(request)
  await React.act(async () => request.resolve({ ok: status === 200, status, json: async () => ({
    source_id: q.get('source_id'), from_utc_ms: Number(q.get('from_utc_ms')), to_utc_ms: Number(q.get('to_utc_ms')),
    currencies: q.get('currencies').split(','), source_available: true, events, ...overrides }) }))
}
try {
  const { RecentEventsPanel } = await server.ssrLoadModule('./src/recent-events/RecentEventsPanel.tsx')
  const { DisplayClockProvider } = await server.ssrLoadModule('./src/appearance/time-display/DisplayClock.tsx')
  const render = (symbol = 'EURUSD', brokerId = 'Pepperstone-Demo') => React.act(async () => root.render(
    React.createElement(DisplayClockProvider, { brokerId, preference: { mode: 'fixed-offset', utcOffsetMinutes: 420, hour12: true } },
      React.createElement(RecentEventsPanel, { symbol, brokerId, onClose: () => closes++ }))))
  const changeRange = days => React.act(async () => {
    const select = container.querySelector('select')
    select.value = String(days)
    select.dispatchEvent(new dom.Event('change', { bubbles: true }))
  })
  await render()
  assert.equal(query(requests[0]).get('currencies'), 'EUR,USD')
  assert.equal(Number(query(requests[0]).get('from_utc_ms')), now + 1)
  assert.equal(Number(query(requests[0]).get('to_utc_ms')), now + 3 * 86400000)
  assert.equal(requests.length, 1, 'Only one scoped read is needed to open the panel')
  assert.equal(document.activeElement, container.querySelector('select'))
  assert.deepEqual([...container.querySelectorAll('option')].map(option => option.value), ['3', '7', '14', '31'])
  assert.equal(container.querySelector('[role="tab"][aria-selected="true"]').textContent, 'Upcoming')
  assert.doesNotMatch(container.textContent, /Pepperstone-Demo|UTC\+07:00|EUR \/ USD/)
  await reply(requests[0], [row('later', 'EUR', now + 2 * 86400000), { ...row('soon', 'USD', now + 15000), actual: null }])
  assert.deepEqual([...container.querySelectorAll('th')].map(cell => cell.textContent), ['In', 'CUR', 'Event', 'A / F / P'])
  assert.match(container.querySelector('tbody tr').textContent, /<1mUSDUSD event soonA—/)
  assert.equal(container.querySelector('tbody tr:last-child time').textContent, '2d', 'Upcoming sorts nearest first')
  await React.act(async () => { now += 30000; for (const fn of [...intervals.values()]) fn() })
  assert.doesNotMatch(container.querySelector('tbody').textContent, /event soon/, 'An elapsed event leaves Upcoming at the next local clock update')
  await reply(requests.at(-1), [row('later', 'EUR', now + 2 * 86400000)])
  for (const days of [7, 14, 31]) {
    await changeRange(days)
    assert.equal(Number(query(requests.at(-1)).get('to_utc_ms')), now + days * 86400000)
    await reply(requests.at(-1), [])
    assert.match(container.textContent, new RegExp(`No timed events in the next ${days} days`))
  }
  await changeRange(3)
  const staleUpcoming = requests.at(-1)
  await React.act(async () => container.querySelector('#event-panel-recent').dispatchEvent(new dom.KeyboardEvent('keydown', { bubbles: true, key: 'End' })))
  assert.equal(staleUpcoming.signal.aborted, true)
  assert.equal(container.querySelector('select option').textContent, 'Last 3 Days')
  assert.equal(container.querySelector('tbody'), null, 'Switching tabs never shows the other time window')
  const recentRequest = requests.at(-1)
  assert.equal(Number(query(recentRequest).get('from_utc_ms')), now - 3 * 86400000)
  await reply(recentRequest, [row('old', 'EUR', now - 2 * 86400000), row('new')])
  await reply(staleUpcoming, [row('stale-future', 'USD', now + 3600000)])
  assert.doesNotMatch(container.textContent, /stale-future/)
  assert.deepEqual([...container.querySelectorAll('th')].map(cell => cell.textContent), ['Age', 'CUR', 'Event', 'A / F / P'])
  assert.match(container.querySelector('tbody tr').textContent, /1hUSDUSD event newA0%F—P1.2%/)
  assert.match(container.querySelector('time').title, /07:00 AM/, 'Hover uses Jakarta publication time without requiring chart placement')
  assert.equal(container.querySelector('tbody tr:last-child time').textContent, '2d')
  const firstRows = container.querySelectorAll('tbody tr')
  await React.act(async () => { now += 30000; for (const fn of [...intervals.values()]) fn() })
  await reply(requests.at(-1), [
    { ...row('old', 'EUR', now - 2 * 86400000 - 30000), impact: 'negative', actual: 2, forecast: 1 },
    { ...row('new', 'USD', now - 3600000 - 30000), impact: 'positive', actual: 0, forecast: 1 },
    { ...row('missing'), impact: 'positive', actual: null },
    { ...row('unclassified'), impact: 'none', actual: 5, forecast: 1 },
    { ...row('legacy'), actual: -2 },
  ])
  const actualFor = id => [...container.querySelectorAll('tbody tr')].find(tr => tr.querySelector('.recent-events-name').textContent.endsWith(`event ${id}`))
    .querySelector('.recent-events-values span')
  assert.equal(actualFor('new').dataset.mt5Impact, 'positive', 'Zero actual follows MT5, even when below forecast and USD is the quote currency')
  assert.equal(actualFor('new').title, 'Actual · MT5: bullish for USD')
  assert.equal(actualFor('old').dataset.mt5Impact, 'negative', 'A larger actual still follows the provider negative flag')
  assert.equal(actualFor('old').title, 'Actual · MT5: bearish for EUR')
  for (const id of ['missing', 'unclassified', 'legacy']) assert.equal(actualFor(id).hasAttribute('data-mt5-impact'), false)
  assert.equal(container.querySelectorAll('.recent-events-values [data-mt5-impact]').length, 2, 'Forecast and Previous are never colored')
  await React.act(async () => { now += 30000; for (const fn of [...intervals.values()]) fn() })
  await reply(requests.at(-1), [{ ...row('new', 'USD', now - 3600000 - 60000), impact: 'negative', actual: 0, forecast: 1 }])
  assert.equal(actualFor('new').dataset.mt5Impact, 'negative', 'A provider impact correction updates even if numeric values are unchanged')
  await React.act(async () => { now += 30000; for (const fn of [...intervals.values()]) fn() })
  await reply(requests.at(-1), [row('old', 'EUR', now - 2 * 86400000 - 30000), row('new', 'USD', now - 3600000 - 30000)])
  assert.equal(container.querySelector('tbody tr'), firstRows[0], 'Polling reuses keyed row DOM')
  for (const days of [7, 14, 31]) {
    await changeRange(days)
    assert.equal(Number(query(requests.at(-1)).get('from_utc_ms')), now - days * 86400000)
    await reply(requests.at(-1), [])
    assert.match(container.textContent, new RegExp(`No timed events in the last ${days} days`))
  }
  await render('GBPJPY.a')
  assert.equal(query(requests.at(-1)).get('currencies'), 'GBP,JPY')
  const obsolete = requests.at(-1)
  await render('AUDCAD', 'Other-Broker')
  assert.equal(obsolete.signal.aborted, true)
  assert.equal(container.querySelector('tbody'), null, 'A new scope never displays stale rows')
  assert.equal(query(requests.at(-1)).get('source_id'), 'Other-Broker')
  await reply(requests.at(-1), [row('aud', 'AUD')])
  await reply(obsolete, [row('stale', 'GBP')])
  assert.match(container.querySelector('tbody').textContent, /AUD event aud/)
  assert.doesNotMatch(container.textContent, /stale/)
  await React.act(async () => { now += 30000; for (const fn of [...intervals.values()]) fn() })
  await reply(requests.at(-1), [], {}, 503)
  assert.match(container.querySelector('[role="alert"]').textContent, /HTTP 503/)
  assert.match(container.querySelector('tbody').textContent, /AUD event aud/, 'Transient failures retain the last good snapshot')
  await React.act(async () => { now += 30000; for (const fn of [...intervals.values()]) fn() })
  await reply(requests.at(-1), [row('future', 'AUD', now + 1)])
  assert.match(container.querySelector('[role="alert"]').textContent, /Invalid events/)
  await React.act(async () => { now += 30000; for (const fn of [...intervals.values()]) fn() })
  await reply(requests.at(-1), [row('aud', 'AUD')])
  assert.equal(container.querySelector('[role="alert"]'), null)
  await React.act(async () => container.querySelector('select').dispatchEvent(new dom.KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })))
  assert.equal(closes, 1)
  await React.act(async () => container.querySelector('[aria-label="Close events"]').click())
  assert.equal(closes, 2)
  const beforeUnsupported = requests.length
  await render('BTCUSD')
  assert.match(container.textContent, /No calendar currency scope/)
  assert.equal(requests.length, beforeUnsupported)
  await render('EURUSD', null)
  assert.match(container.textContent, /Connect a broker/)
  assert.equal(requests.length, beforeUnsupported)
  await render()
  const outstanding = requests.at(-1)
  await React.act(async () => root.render(null))
  assert.equal(outstanding.signal.aborted, true)
  assert.equal(intervals.size, 0)
  console.log('✓ Recent events: pair/broker scopes, four ranges, UTC ages and values, scoped reads, stale cancellation, polling recovery and cleanup')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  Date.now = originalNow
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
