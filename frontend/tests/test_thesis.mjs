import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

// Headless component contract, not a browser or visual audit.
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ root: frontend, server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node,
  navigator: dom.navigator, localStorage: dom.localStorage, IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map([...Object.keys(globals), 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
let id = 0, revision = 'one', offline = false, malformed = false, hold = false
const timers = new Map(), requests = [], held = []
const realNow = Date.now
Date.now = () => Date.parse('2026-07-16T05:59:59Z')
dom.setTimeout = (fn, ms) => { timers.set(++id, { fn, ms }); return id }
dom.clearTimeout = key => timers.delete(key)
const seed = JSON.parse(fs.readFileSync(path.join(frontend, '../Market Analyst Workflow/thesis/journal.json'), 'utf8')).entries
let past = [...seed].reverse().map(entry => ({ ...entry, versions: [entry] }))
const response = route => {
  if (offline) return { ok: false, status: 503, json: async () => ({}) }
  const scope = route.searchParams.get('scope'), sourceId = route.searchParams.get('source_id')
  const base = { schema: 1, scope, month: '2026-07', source_id: sourceId, revision }
  return { ok: true, json: async () => route.searchParams.get('after_revision') === revision ? { ...base, unchanged: true }
    : { ...base, past: malformed ? [{}] : scope === 'NZDCHF' ? past : [] } }
}
globalThis.fetch = async (url, options = {}) => {
  const route = new URL(String(url), 'http://localhost'); requests.push({ route, options })
  if (hold) return new Promise(resolve => held.push({ resolve, route, options }))
  return response(route)
}
let copied = ''
Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { copied = value } } })
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.append(container)
const root = createRoot(container)
const click = node => React.act(async () => { assert.ok(node); node.click() })
const button = text => [...container.querySelectorAll('button')].find(node => node.textContent === text)
const poll = async () => {
  const [key, timer] = [...timers].find(([, value]) => value.ms === 5000)
  timers.delete(key); await React.act(async () => timer.fn())
}
try {
  const { ThesisDock } = await server.ssrLoadModule('./src/thesis/ThesisDock.tsx')
  const { thesisPrompt, validThesisSnapshot } = await server.ssrLoadModule('./src/thesis/thesis-model.ts')
  await React.act(async () => root.render(React.createElement(ThesisDock)))
  assert.equal(container.querySelector('[aria-label="Thesis pair"]').value, 'NZDCHF')
  assert.equal(container.querySelectorAll('[aria-label="Thesis pair"] option').length, 28)
  assert.deepEqual([...container.querySelector('[aria-label="Thesis month"]').options].map(option => option.textContent), ['JUL 2026'])
  const rows = () => [...container.querySelectorAll('[data-thesis-row]')]
  assert.equal(rows().length, 15)
  assert.ok(rows()[0].textContent.includes('Jul 15, Wed'))
  assert.ok(rows().at(-1).textContent.includes('Jul 1, Wed'))
  assert.ok(rows()[0].textContent.includes('1:00 PM'))
  assert.ok(container.textContent.includes('researched retrospectively'))
  assert.ok(container.querySelectorAll('a[href^="https://"]').length > 15)
  assert.ok([...container.querySelectorAll('a')].every(node => node.rel.includes('noopener')))
  assert.equal(container.querySelectorAll('table').length, 1)
  assert.equal(container.querySelector('[aria-label="Upcoming highlighted events"]'), null)
  assert.ok(!container.textContent.includes('Upcoming rows follow active pins'))
  assert.ok(!container.textContent.includes('MT5 Highlight rows need'))
  assert.equal(button('Copy release prompt'), undefined)
  await click(button('Copy assessment prompt'))
  assert.ok(copied.includes('$assess-trade-now'))
  assert.ok(copied.includes('target null'))
  const originalRow = rows()[0]
  originalRow.querySelector('details').open = true
  await poll()
  assert.equal(rows()[0], originalRow)
  assert.equal(rows()[0].querySelector('details').open, true, 'Unchanged polls retain expanded details')
  const target = { kind: 'highlight', reference: 'a'.repeat(32), source_id: 'Broker', event_at: '2026-07-16T06:00:00Z', event_date: null }
  const entry = { ...seed[0], id: 'b'.repeat(32), row_id: 'c'.repeat(32), as_of_utc: '2026-07-16T06:00:01Z', saved_utc: '2026-07-16T06:00:02Z',
    title: 'Decision assessment', target, provenance: 'assessment', note: '', verdict: 'SELL', thesis: 'Fresh supported release thesis.' }
  const corrected = { ...entry, id: 'd'.repeat(32), expected_version: entry.id, verdict: 'BUY', thesis: 'Verified correction.' }
  past = [{ ...corrected, versions: [entry, corrected] }, ...past]; revision = 'two'
  await poll()
  assert.equal(rows().length, 16)
  assert.equal(rows()[1], originalRow, 'Unchanged past rows survive a different release update')
  assert.ok(rows()[0].textContent.includes('Verified correction.'))
  assert.ok(rows()[0].querySelector('[aria-label="Previous thesis versions"]').textContent.includes('Fresh supported release thesis.'))
  await click(rows()[0].querySelector('button'))
  assert.ok(copied.includes(`row_id ${entry.row_id}`))
  assert.ok(copied.includes('latest expected_version'))
  offline = true; await poll()
  assert.ok(container.textContent.includes('Showing last loaded assessments'))
  assert.equal(rows().length, 16)
  offline = false; malformed = true; revision = 'three'; await poll()
  assert.ok(container.textContent.includes('Invalid Thesis response'))
  assert.equal(rows().length, 16)
  malformed = false; await poll()
  // Untrusted source markup is rejected, not placed in an anchor.
  const unsafe = { schema: 1, scope: 'NZDCHF', month: '2026-07', source_id: null, revision: 'unsafe',
    past: [{ ...entry, sources: [{ kind: 'web', label: 'Unsafe', locator: 'javascript:alert(1)', note: '' }], versions: [entry] }] }
  assert.equal(validThesisSnapshot(unsafe, 'NZDCHF', '2026-07', null), false)
  assert.ok(!thesisPrompt('NZDCHF', '2026-07').includes('--broker'))
  const pair = container.querySelector('[aria-label="Thesis pair"]')
  hold = true
  await click(button('Refresh'))
  await React.act(async () => { pair.value = 'EURUSD'; pair.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.equal(rows().length, 0, 'Pair changes never display another pair\'s thesis')
  assert.ok(held[0].options.signal.aborted)
  hold = false
  await React.act(async () => { for (const item of held.splice(0).reverse()) item.resolve(response(item.route)) })
  assert.equal(rows().length, 0, 'Stale responses cannot restore the old pair')
  assert.ok(container.textContent.includes('No saved assessments for EURUSD'))
  await React.act(async () => root.render(null))
  assert.equal(timers.size, 0)
  await React.act(async () => root.render(React.createElement(ThesisDock)))
  assert.equal(container.querySelector('[aria-label="Thesis pair"]').value, 'EURUSD', 'Independent pair choice persists')
  assert.ok(requests.every(({ route, options }) => route.pathname === '/storage-api/theses' && !route.searchParams.has('source_id') && !options.method), 'Dock only reads compact research; no candle/raw/pin writes')
  console.log('✓ Thesis: July seed, pair/month, safe sources, saved-only table, assessment prompts, updates/history, stable polls, errors and stale-reply cleanup')
} finally {
  await React.act(async () => root.unmount())
  assert.equal(timers.size, 0)
  Date.now = realNow
  await server.close(); dom.happyDOM.abort()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
