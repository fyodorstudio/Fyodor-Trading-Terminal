import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

// Production component/hook contract; no browser or visual inspection.
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, navigator: dom.navigator, HTMLElement: dom.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map([...Object.keys(globals), 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
let now = Date.parse('2026-10-26T17:00:00Z'), sequence = 0, offline = false, malformed = false, hold = false
const realNow = Date.now; Date.now = () => now
const timers = new Map(), intervals = new Map(), requests = [], held = []
dom.setTimeout = (fn, ms) => { timers.set(++sequence, { fn, ms }); return sequence }
dom.clearTimeout = id => timers.delete(id)
dom.setInterval = (fn, ms) => { intervals.set(++sequence, { fn, ms }); return sequence }
dom.clearInterval = id => intervals.delete(id)
const anchor = { title: 'Supporting release', event_at: '2026-10-26T14:00:00Z', event_date: null, note: 'Original release time, not review time.', sources: [{ kind: 'web', label: 'Release', locator: 'https://www.federalreserve.gov/', note: '' }] }
const checkpoint = { title: 'Fed rate decision', event_at: '2026-10-28T16:00:00Z', event_date: null,
  note: 'Guidance can change the rate path.', verified_utc: '2026-10-26T16:00:00Z',
  sources: [{ kind: 'web', label: 'Official schedule', locator: 'https://www.federalreserve.gov/', note: '' }] }
let snapshot = { schema: 1, revision: 'one', review_id: 'a'.repeat(32), as_of_utc: '2026-10-26T16:00:00Z',
  rows: ['USD','EUR','GBP','JPY','CHF','CAD','AUD','NZD'].map((currency, index) => ({ currency,
    verdict: index ? 'POTENTIAL WEAKENING' : 'POTENTIAL STRENGTHENING', verified_utc: '2026-10-26T16:00:00Z',
    evidence_anchor: index ? null : anchor, reassessment: index ? null : checkpoint, reassessment_gap: '' })) }
function response(url) {
  return offline ? { ok: false, status: 503 } : { ok: true, json: async () => malformed ? { ...snapshot, rows: snapshot.rows.slice(1) }
    : url.includes(`after_revision=${snapshot.revision}`) ? { schema: 1, revision: snapshot.revision, unchanged: true } : structuredClone(snapshot) }
}
globalThis.fetch = async (url, options = {}) => {
  requests.push({ url, options })
  return hold ? new Promise(resolve => held.push({ resolve, url, options })) : response(url)
}
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.append(container)
const root = createRoot(container)
const poll = async () => {
  const [id, timer] = [...timers].find(([, timer]) => timer.ms === 5000)
  timers.delete(id); await React.act(async () => timer.fn())
}
try {
  const { CurrencySummary } = await server.ssrLoadModule('./src/thesis/CurrencySummary.tsx')
  const { validCurrencySummary, currencyUntil, currencyStaleness } = await server.ssrLoadModule('./src/thesis/currency-summary-model.ts')
  assert.equal(validCurrencySummary(snapshot), true)
  assert.equal(currencyStaleness(anchor, now), '3h 0m ago')
  assert.equal(currencyStaleness(null, now), 'Unknown')
  assert.equal(currencyStaleness({ ...anchor, event_at: null, event_date: '2026-10-25' }, now), 'Oct 25')
  assert.equal(currencyStaleness(anchor, Date.parse('2026-10-28T16:00:00Z')), '2d 2h ago')
  const future = structuredClone(snapshot); future.rows[0].evidence_anchor.event_at = '2026-10-27T00:00:00Z'
  assert.equal(validCurrencySummary(future), false)
  const both = structuredClone(snapshot); both.rows[0].evidence_anchor.event_date = '2026-10-26'
  assert.equal(validCurrencySummary(both), false)
  const unsafe = structuredClone(snapshot); unsafe.rows[0].reassessment.sources[0].locator = 'javascript:alert(1)'
  assert.equal(validCurrencySummary(unsafe), false)
  assert.equal(validCurrencySummary({ ...snapshot, rows: snapshot.rows.map(() => snapshot.rows[0]) }), false)
  assert.equal(currencyUntil(checkpoint, now).label, '1d 23h')
  const unknownHour = { ...checkpoint, event_at: null, event_date: '2026-10-28' }
  assert.equal(currencyUntil(unknownHour, now).due, false)
  assert.match(currencyUntil(unknownHour, Date.parse('2026-10-27T17:00:00Z')).label, /Review due/)
  await React.act(async () => root.render(React.createElement(CurrencySummary)))
  assert.equal(container.querySelectorAll('[data-currency-summary]').length, 8)
  assert.deepEqual([...container.querySelectorAll('thead th')].map(node => node.textContent), ['STALENESS','CUR','VERDICT','UNTIL'])
  const usd = () => container.querySelector('[data-currency-summary="USD"]')
  assert.match(usd().textContent, /Strengthening.*1d 23h/)
  assert.match(container.querySelector('[data-currency-summary="EUR"]').textContent, /Weakening.*Review not set/)
  assert.equal(requests[0].url, '/storage-api/theses/summary', 'Independent of chart, monthly selector and bottom dock')
  assert.match(usd().querySelector('td').textContent, /3h 0m ago/)
  assert.match(usd().querySelector('td').title, /Supporting release.*Oct 26, 2026.*9:00 PM/)
  assert.equal(usd().querySelector('td:last-child').textContent, '1d 23h')
  assert.match(usd().querySelector('td:last-child').title, /Fed rate decision/)
  const row = usd(); await poll()
  assert.equal(usd(), row, 'Unchanged polling retains rendered rows')
  assert.ok(requests.at(-1).url.includes('after_revision=one'))
  now = Date.parse(checkpoint.event_at)
  await React.act(async () => [...intervals.values()][0].fn())
  assert.match(usd().textContent, /Strengthening.*Review due/, 'An elapsed checkpoint never reverses the verdict')
  assert.equal(usd().className, 'currency-review-due')
  assert.equal(requests.length, 2, 'Countdown does not fetch or invoke research')
  snapshot = { ...snapshot, revision: 'two', as_of_utc: '2026-10-28T16:00:00Z', rows: snapshot.rows.map((row, index) => index ? row
    : { ...row, verdict: 'POTENTIAL WEAKENING', reassessment: { ...checkpoint, title: 'Fed press conference', event_at: '2026-10-28T16:30:00Z' } }) }
  await poll()
  assert.match(usd().textContent, /Weakening.*30m/)
  assert.equal(usd().querySelector('td').textContent, '2d 2h ago', 'A fresh review and reversed verdict do not reset a carried event clock')
  offline = true; await poll()
  assert.match(container.querySelector('[role="alert"]').textContent, /refresh failed.*last loaded snapshot/i)
  assert.match(usd().textContent, /Weakening/)
  offline = false; malformed = true; await poll()
  assert.match(container.querySelector('[role="alert"]').textContent, /Invalid/)
  assert.equal(container.querySelectorAll('[data-currency-summary]').length, 8)
  malformed = false; await poll(); assert.equal(container.querySelector('[role="alert"]'), null)
  hold = true
  const [timerId, timer] = [...timers][0]; timers.delete(timerId)
  await React.act(async () => { void timer.fn() })
  await React.act(async () => root.render(null))
  assert.equal(held[0].options.signal.aborted, true)
  await React.act(async () => held[0].resolve(response(held[0].url)))
  assert.equal(timers.size, 0); assert.equal(intervals.size, 0)
  hold = false
  snapshot = { schema: 1, revision: 'empty', review_id: null, as_of_utc: null, rows: snapshot.rows.map(row => ({ ...row, verdict: null, verified_utc: null, evidence_anchor: null, reassessment: null })) }
  await React.act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(CurrencySummary))))
  assert.match(container.textContent, /No current Thesis saved/)
  assert.equal(container.querySelectorAll('[data-currency-summary]').length, 8)
  assert.match(usd().textContent, /Not assessed/)
  console.log('✓ Currency summary: latest saved direction, explicit checkpoint countdown, expiry without reversal, refresh/correction, unknown hours, failures and cleanup')
} finally {
  await React.act(async () => root.unmount())
  assert.equal(timers.size, 0); assert.equal(intervals.size, 0)
  Date.now = realNow
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
