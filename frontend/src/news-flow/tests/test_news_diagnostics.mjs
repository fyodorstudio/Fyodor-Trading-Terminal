import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const dom = new Window({ url: 'http://localhost:5173' }), requests = [], timers = new Map()
let timerId = 0, now = Date.parse('2026-11-16T04:49:00Z')
const originalNow = Date.now
Date.now = () => now
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node,
  navigator: dom.navigator, IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map([...Object.keys(globals), 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
dom.setTimeout = (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId }
dom.clearTimeout = id => timers.delete(id)
globalThis.fetch = (url, options = {}) => new Promise(resolve => requests.push({ url, ...options, resolve }))
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'), server: { middlewareMode: true, hmr: false }, appType: 'custom' })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.append(host)
const root = createRoot(host)
try {
  const { Headlines } = await server.ssrLoadModule('./src/news-flow/Headlines.tsx')
  const item = { id: 'late', source_id: 'reuters', source_name: 'Reuters', publisher: 'Reuters', title: 'Oil supply surprise', summary: '',
    url: 'https://example.com/late', published_at: now-32*60000, first_seen: now, previous_check_at: now-3000 }
  await React.act(async () => root.render(React.createElement(Headlines, { items: [item] })))
  assert.match(host.textContent, /Published 32m ago/)
  assert.match(host.textContent, /Collected Just now/)
  assert.equal(host.querySelectorAll('time').length, 2)
  assert.match(host.querySelectorAll('time')[1].title, /Previous successful check/)
  now += 60000
  await React.act(async () => { for (const [id, timer] of [...timers]) { timers.delete(id); timer.fn() } })
  assert.match(host.textContent, /Published 33m ago/)
  assert.match(host.textContent, /Collected 1m ago/, 'Both ages advance without resetting collection on refresh')
  await React.act(async () => root.render(React.createElement(Headlines, { items: [{ ...item, published_at: now+86400000 }] })))
  assert.equal(host.querySelectorAll('time').length, 1)
  assert.match(host.textContent, /First collected/, 'Scheduled publication uses the labelled stable collection fallback')

  const { NewsFetchDiagnostics } = await server.ssrLoadModule('./src/news-flow/NewsFetchDiagnostics.tsx')
  await React.act(async () => root.render(React.createElement(NewsFetchDiagnostics, { source: 'reuters' })))
  assert.equal(requests.length, 0, 'Diagnostics are fetched only on demand')
  await React.act(async () => host.querySelector('button').click())
  assert.match(requests.at(-1).url, /diagnostics\?source=reuters/)
  const body = { checks: [{ minute: now-60000, last_at: now, ok: 12, unchanged: 4, limited: 1, errors: 0,
    http_status: 200, cache_age: 34, item_count: 100, max_fetch_ms: 500, max_queue_ms: 1100 }],
    runs: [{ started_at: now-3600000, heartbeat_at: now, stopped_at: null }], retention_hours: 24 }
  await React.act(async () => requests.at(-1).resolve({ ok: true, json: async () => body }))
  assert.match(host.textContent, /Response Age header: 34s/)
  assert.match(host.textContent, /12 \/ 4/)
  assert.match(host.textContent, /1 \/ 0/)
  assert.match(host.textContent, /Collector started/)
  assert.match(host.textContent, /do not prove exact publisher\/index availability/)
  const timer = [...timers].find(([, value]) => value.ms === 10000)
  assert.ok(timer)
  await React.act(async () => { timers.delete(timer[0]); timer[1].fn() })
  const pending = requests.at(-1)
  await React.act(async () => root.render(null))
  assert.equal(pending.signal.aborted, true)
  assert.equal(timers.size, 0)
  console.log('✓ News diagnostics: separate advancing publication/collection ages, prior-check evidence, scheduled fallback, lazy minute summaries and request cleanup')
} finally {
  await React.act(async () => root.unmount())
  await server.close()
  Date.now = originalNow
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
  await dom.happyDOM.abort()
}
