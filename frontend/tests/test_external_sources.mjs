import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node,
  navigator: dom.navigator, localStorage: dom.localStorage, IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map([...Object.keys(globals), 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const timers = new Map(), intervals = new Map(); let timerId = 0, offline = false, malformed = false, hold = false, held = []
const realNow = Date.now
let now = Date.parse('2026-10-15T04:00:00Z')
Date.now = () => now
dom.setTimeout = (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId }
dom.clearTimeout = id => timers.delete(id)
dom.setInterval = (fn, ms) => { intervals.set(++timerId, { fn, ms }); return timerId }
dom.clearInterval = id => intervals.delete(id)
const sample = (key, currencies, overrides = {}) => ({ id: 'a'.repeat(32), key, title: 'Treasury buybacks', currencies,
  kind: 'headline', status: 'confirmed', facts: 'Larger long-end buybacks.', interpretation: 'Dated USD-negative interpretation.',
  event_at: '2026-08-19T12:33:00Z', event_date: null, published_utc: '2026-08-19T12:53:00Z', time_note: 'Provider and public clocks differ.',
  saved_utc: '2026-10-13T17:22:00Z', archived: false, expected_version: null, version_count: 1,
  sources: [{ kind: 'web', label: 'Treasury official', locator: 'https://home.treasury.gov/news/press-releases/sb0607', note: 'Effective September 9.' }], ...overrides })
let items = [sample('treasury-buybacks', ['USD']), sample('europe-policy', ['EUR', 'GBP'], { id: 'b'.repeat(32), title: 'Policy watch', kind: 'watch', event_at: null, published_utc: null }),
  sample('japan-date', ['JPY'], { id: 'c'.repeat(32), title: 'Date-only event', kind: 'scheduled', event_at: null, event_date: '2026-10-16', published_utc: null })]
let revision = 1
const requests = []
globalThis.fetch = async (url, options = {}) => {
  const route = new URL(String(url), 'http://localhost'); requests.push({ url: route, options })
  if (hold) return new Promise(resolve => held.push({ resolve, route }))
  if (offline) return { ok: false, status: 503, json: async () => ({}) }
  const key = route.pathname.split('/').at(-1)
  if (key !== 'external-sources') return { ok: true, json: async () => ({ key, items: items.filter(item => item.key === key) }) }
  const scope = route.searchParams.get('scope'), visibility = route.searchParams.get('visibility'), offset = Number(route.searchParams.get('offset'))
  const filtered = items.filter(item => (visibility === 'all' || item.archived === (visibility === 'archived')) && (scope === 'all' || item.currencies.includes(scope)))
  return { ok: true, json: async () => ({ revision: String(revision), scope, visibility, matches: filtered.length, offset,
    next_offset: offset + 100 < filtered.length ? offset + 100 : null,
    ...(route.searchParams.get('after_revision') === String(revision) ? { unchanged: true } : { items: malformed ? [{}] : filtered.slice(offset, offset + 100) }) }) }
}
const { createRoot } = await import('react-dom/client')
const rootNode = document.createElement('div'); document.body.append(rootNode)
const root = createRoot(rootNode)
const button = text => [...rootNode.querySelectorAll('button')].find(button => button.textContent === text)
const click = async element => { assert.ok(element); await React.act(async () => element.click()) }
const poll = async () => {
  const [id, timer] = [...timers].find(([, timer]) => timer.ms === 5000)
  timers.delete(id); await React.act(async () => timer.fn())
}
try {
  const { ExternalSourcesDock } = await server.ssrLoadModule('./src/external-sources/ExternalSourcesDock.tsx')
  const { validExternalItems } = await server.ssrLoadModule('./src/external-sources/external-source-model.ts')
  const { sortExternalDates, externalCountdown } = await server.ssrLoadModule('./src/external-sources/external-schedule.ts')
  const display = { mode: 'fixed-offset', utcOffsetMinutes: 420 }
  const today = sample('today', ['USD'], { event_at: null, event_date: '2026-10-15' })
  const soon = sample('soon', ['USD'], { event_at: '2026-10-15T04:01:00Z' })
  const tomorrow = sample('tomorrow', ['USD'], { event_at: null, event_date: '2026-10-16' })
  const undated = sample('undated', ['USD'], { kind: 'watch', event_at: null })
  const dates = [undated, items[0], tomorrow, soon, today], originalOrder = [...dates]
  assert.deepEqual(sortExternalDates(dates, 'upcoming', now, display).map(item => item.key), ['today', 'soon', 'tomorrow', 'treasury-buybacks', 'undated'])
  assert.deepEqual(sortExternalDates(dates, 'earliest', now, display).map(item => item.key), ['treasury-buybacks', 'today', 'soon', 'tomorrow', 'undated'])
  assert.deepEqual(sortExternalDates(dates, 'latest', now, display).map(item => item.key), ['tomorrow', 'soon', 'today', 'treasury-buybacks', 'undated'])
  assert.deepEqual(dates, originalOrder, 'Date sorting never mutates API records')
  assert.equal(externalCountdown(today, now, display), 'Today')
  assert.equal(externalCountdown(tomorrow, now, display), 'In 1 day')
  assert.equal(externalCountdown(soon, now, display), '1m 0s')
  assert.equal(externalCountdown(soon, now + 61_000, display), 'Elapsed')
  assert.equal(externalCountdown(tomorrow, Date.parse('2026-10-15T17:00:00Z'), display), 'Today', 'Date-only clocks follow Jakarta midnight')
  assert.equal(externalCountdown(today, Date.parse('2026-10-15T17:00:00Z'), display), '1 day ago')
  const render = () => React.act(async () => root.render(React.createElement(ExternalSourcesDock, { symbol: 'EURUSD', timeDisplay: { mode: 'fixed-offset', utcOffsetMinutes: 420 } })))
  assert.equal(validExternalItems(items), true)
  assert.equal(validExternalItems([sample('unsafe', ['USD'], { sources: [{ kind: 'web', label: 'Unsafe', locator: 'javascript:alert(1)', note: '' }] })]), false)
  await render()
  assert.equal(rootNode.querySelectorAll('.external-record').length, 3)
  assert.ok(rootNode.textContent.includes('19:33'))
  assert.ok(rootNode.textContent.includes('Hour unconfirmed'))
  assert.ok(rootNode.textContent.includes('Unscheduled'))
  await click(rootNode.querySelector('.external-record-toggle'))
  assert.ok(rootNode.textContent.includes('Interpretation at save time'))
  assert.ok(requests.every(request => request.url.pathname.startsWith('/storage-api/external-sources')), 'No broker/calendar/candle reads')
  assert.equal(button('Archive'), undefined)
  assert.ok(!rootNode.textContent.includes('Prompt'))
  assert.equal(rootNode.querySelectorAll('.external-record-row').length, 3)
  assert.equal(rootNode.querySelectorAll('.external-column-headings span').length, 6)
  assert.equal(rootNode.querySelector('.external-record').dataset.externalKey, 'japan-date', 'Upcoming dates precede historical records by default')
  assert.equal(rootNode.querySelector('[data-external-key="europe-policy"] input').disabled, true)
  const originalRecords = JSON.stringify(items)
  const icon = rootNode.querySelector('[data-external-key="treasury-buybacks"] input')
  await click(icon)
  assert.equal(icon.checked, false)
  assert.equal(JSON.stringify(items), originalRecords, 'Hiding icons preserves factual records and history')
  const search = rootNode.querySelector('[aria-label="Search External Sources"]')
  const props = element => element[Object.getOwnPropertyNames(element).find(key => key.startsWith('__reactProps$'))]
  await React.act(async () => props(search).onChange({ target: { value: 'date-only' } }))
  assert.equal(rootNode.querySelectorAll('.external-record').length, 1)
  await React.act(async () => props(search).onChange({ target: { value: '' } }))
  const card = rootNode.querySelector('.external-record')
  await poll()
  assert.equal(rootNode.querySelector('.external-record'), card, 'Unchanged polling retains card identity')
  await click(button('USD'))
  assert.equal(rootNode.querySelectorAll('.external-record').length, 1)
  if (!rootNode.querySelector('.external-expanded-record')) await click(rootNode.querySelector('.external-record-toggle'))
  await click(button('Version history (1)'))
  assert.ok(rootNode.textContent.includes('Recorded:'))
  assert.equal(rootNode.querySelector('.external-icon-toggle input').checked, false, 'Hidden icon remains off after filtering')
  await React.act(async () => root.render(null)); await render()
  assert.equal(rootNode.querySelector('.external-icon-toggle input').checked, false, 'Hidden icon preference survives remount')
  await click(rootNode.querySelector('.external-icon-toggle input'))
  assert.equal(rootNode.querySelector('.external-icon-toggle input').checked, true)
  const browserStorage = localStorage
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: {
    getItem: key => browserStorage.getItem(key),
    setItem: (key, value) => { if (key === 'fyodor.external-sources.chart-icons.v1') throw new Error('Storage full'); browserStorage.setItem(key, value) },
  } })
  await click(rootNode.querySelector('.external-icon-toggle input'))
  assert.ok(rootNode.textContent.includes('Could not save chart visibility'))
  assert.equal(rootNode.querySelector('.external-icon-toggle input').checked, true, 'Failed preference save is not shown as successful')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: browserStorage })
  assert.ok(requests.every(request => !request.options.method || request.options.method === 'GET'), 'Display preferences never write research/lifecycle APIs')
  offline = true; await poll()
  assert.ok(rootNode.textContent.includes('last loaded records'))
  assert.equal(rootNode.querySelectorAll('.external-record').length, 1)
  offline = false; malformed = true; revision++; await poll()
  assert.ok(rootNode.textContent.includes('Invalid External Sources page'))
  assert.equal(rootNode.querySelectorAll('.external-record').length, 1)
  malformed = false; await poll()
  items = [soon, tomorrow, today, undated]; revision++; await poll()
  const sort = rootNode.querySelector('[aria-label="Sort External Sources by date"]')
  assert.equal(sort.value, 'upcoming')
  const requestCount = requests.length
  assert.equal(rootNode.querySelector('[data-external-key="soon"] .external-record-countdown').textContent, '1m 0s')
  now += 2000
  await React.act(async () => { for (const timer of intervals.values()) timer.fn() })
  assert.equal(rootNode.querySelector('[data-external-key="soon"] .external-record-countdown').textContent, '0m 58s')
  assert.equal(requests.length, requestCount, 'Countdown ticks do not refetch research')
  assert.equal(rootNode.querySelector('[data-external-key="today"] .external-record-countdown').textContent, 'Today')
  assert.ok(rootNode.querySelector('[data-external-key="today"]').textContent.includes('Hour unconfirmed'))
  await React.act(async () => {
    const currentSort = rootNode.querySelector('[aria-label="Sort External Sources by date"]')
    currentSort.value = 'latest'; currentSort.dispatchEvent(new dom.Event('change', { bubbles: true }))
  })
  assert.equal(rootNode.querySelector('.external-record').dataset.externalKey, 'tomorrow')
  await React.act(async () => root.render(null)); await render()
  assert.equal(rootNode.querySelector('[aria-label="Sort External Sources by date"]').value, 'latest', 'Date sort survives remount')
  // Complete pagination; no silent truncation at the first 100 records.
  items = Array.from({ length: 101 }, (_, index) => sample(`event-${index}`, ['USD'])); revision++
  await poll()
  assert.equal(rootNode.querySelectorAll('.external-record').length, 101)
  assert.ok(requests.some(request => request.url.searchParams.get('offset') === '100'))
  await React.act(async () => root.render(null)); await render()
  assert.equal(button('USD').getAttribute('aria-pressed'), 'true', 'External filters persist independently')
  // A late reply from the old scope cannot replace a newer scope's records.
  hold = true; await click(button('EUR')); hold = false; await click(button('JPY'))
  await React.act(async () => { for (const request of held) request.resolve({ ok: true, json: async () => ({ revision: 'late', scope: 'EUR', visibility: 'all', matches: 1, offset: 0, next_offset: null, items: [sample('stale', ['EUR'])] }) }) })
  assert.equal(button('JPY').getAttribute('aria-pressed'), 'true')
  assert.equal(rootNode.querySelectorAll('.external-record').length, 0)
  await React.act(async () => root.render(null))
  assert.equal(timers.size, 0, 'Unmount cancels polling')
  assert.equal(intervals.size, 0, 'Unmount cancels countdown clock')
  console.log('✓ External Sources date sorting, local countdown, date-only clocks, separation, search, saved icon controls, history, pagination, stale replies, offline retention and cleanup')
} finally {
  Date.now = realNow
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
