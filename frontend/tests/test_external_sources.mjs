import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

globalThis.__externalWork = { index: 0, lookup: 0 }
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false },
  plugins: [{ name: 'external-work-counts', enforce: 'pre', transform(code, id) {
    if (id.endsWith('/useExternalSources.ts')) return code
      .replace('old.items.map(item => [item.key, item])', 'old.items.map(item => { globalThis.__externalWork.index++; return [item.key, item] })')
      .replace('const previous = previousByKey.get(item.key)', 'globalThis.__externalWork.lookup++; const previous = previousByKey.get(item.key)')
  } }] })
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
  const { useExternalSources } = await server.ssrLoadModule('./src/external-sources/useExternalSources.ts')
  const { ExternalEventDetails } = await server.ssrLoadModule('./src/events-alarms/ExternalEventDetails.tsx')
  const { validExternalItems } = await server.ssrLoadModule('./src/external-sources/external-source-model.ts')
  let records
  function Probe({ scope = 'all', visibility = 'all' }) {
    const current = useExternalSources(scope, visibility)
    React.useLayoutEffect(() => { records = current }, [current])
    return null
  }
  const render = (props = {}) => React.act(async () => root.render(React.createElement(Probe, props)))
  assert.equal(validExternalItems(items), true)
  assert.equal(validExternalItems([sample('unsafe', ['USD'], { sources: [{ kind: 'web', label: 'Unsafe', locator: 'javascript:alert(1)', note: '' }] })]), false)
  await render()
  assert.equal(records.items.length, 3)
  const original = records.items
  await poll()
  assert.equal(records.items, original, 'Unchanged polling retains the collection and record identities')
  revision++; await poll()
  assert.equal(records.items, original, 'A changed collection revision reuses identical immutable versions')
  items[0] = { ...items[0], id: 'd'.repeat(32), version_count: 2, facts: 'Updated facts' }; revision++; await poll()
  assert.notEqual(records.items[0], original[0])
  assert.equal(records.items[1], original[1], 'Updating one record preserves unrelated identities')
  await render({ scope: 'USD' })
  assert.equal(records.items.length, 1)
  const usd = records.items
  offline = true; await poll()
  assert.match(records.error, /HTTP 503/)
  assert.equal(records.items, usd, 'An outage retains the last valid collection')
  offline = false; malformed = true; revision++; await poll()
  assert.match(records.error, /Invalid External Sources page/)
  assert.equal(records.items, usd)
  malformed = false; await poll()
  assert.equal(records.error, null)
  // Complete pagination and deterministic linear matching, including changed versions.
  items = Array.from({ length: 1000 }, (_, index) => sample(`event-${index}`, ['USD'], { id: index.toString(16).padStart(32, '0') })); revision++
  await poll()
  assert.equal(records.items.length, 1000)
  assert.ok(requests.some(request => request.url.searchParams.get('offset') === '900'))
  const large = records.items
  globalThis.__externalWork.index = 0; globalThis.__externalWork.lookup = 0
  items[500] = { ...items[500], id: 'f'.repeat(32), version_count: 2 }; revision++; await poll()
  assert.deepEqual(globalThis.__externalWork, { index: 1000, lookup: 1000 }, 'One previous-key index and one lookup per item; no pairwise searches')
  assert.equal(records.items[499], large[499]); assert.notEqual(records.items[500], large[500])
  globalThis.__externalWork.index = 0; globalThis.__externalWork.lookup = 0
  const unchanged = records.items
  await poll()
  assert.equal(records.items, unchanged)
  assert.deepEqual(globalThis.__externalWork, { index: 0, lookup: 0 }, 'Unchanged revisions do no matching work')
  const beforeRefresh = requests.length
  await React.act(async () => records.refresh())
  assert.ok(requests.length > beforeRefresh)
  // Old scope replies cannot replace the next scope, even if a transport ignores abort.
  hold = true; await render({ scope: 'EUR' }); hold = false; await render({ scope: 'JPY' })
  assert.equal(records.items.length, 0)
  await React.act(async () => { for (const request of held) request.resolve({ ok: true, json: async () => ({ revision: 'late', scope: 'EUR', visibility: 'all', matches: 1, offset: 0, next_offset: null, items: [sample('stale', ['EUR'])] }) }) })
  assert.equal(records.items.length, 0)
  await React.act(async () => root.render(null))
  assert.equal(timers.size, 0, 'Unmount cancels polling')
  assert.ok(requests.every(request => !request.options.method || request.options.method === 'GET'), 'Readers never mutate research or lifecycle records')
  // Exercise the live Alert details, chart preference and immutable history reader.
  items = [sample('treasury-buybacks', ['USD'])]
  const detail = () => React.act(async () => root.render(React.createElement(ExternalEventDetails, { item: items[0] })))
  await detail()
  assert.match(rootNode.textContent, /Interpretation at save time/)
  const originalRecords = JSON.stringify(items)
  const icon = () => rootNode.querySelector('[aria-label="Show Treasury buybacks icon on chart"]')
  assert.equal(icon().checked, true)
  await click(icon()); assert.equal(icon().checked, false)
  assert.equal(JSON.stringify(items), originalRecords, 'Display preferences preserve factual versions')
  await React.act(async () => root.render(null)); await detail()
  assert.equal(icon().checked, false, 'Chart preferences survive reopening details')
  await click(icon()); assert.equal(icon().checked, true)
  const browserStorage = localStorage
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: {
    getItem: key => browserStorage.getItem(key),
    setItem: () => { throw new Error('Storage full') },
  } })
  try {
    await click(icon())
    assert.match(rootNode.textContent, /Could not save chart visibility/)
    assert.equal(icon().checked, true, 'Failed preference writes never claim success')
  } finally { Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: browserStorage }) }
  await click(button('Version history (1)'))
  assert.ok(rootNode.querySelector('details').textContent.includes('Recorded:'))
  assert.ok(rootNode.querySelector('a[href^="https://home.treasury.gov"]'))
  await React.act(async () => root.render(null))
  assert.equal(timers.size, 0); assert.equal(intervals.size, 0)
  console.log('✓ External Sources: complete pagination, linear version matching, stable identities, outage/malformed retention, stale replies, live evidence/history and chart preferences')
} finally {
  Date.now = realNow
  delete globalThis.__externalWork
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
