import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node,
  navigator: dom.navigator, localStorage: dom.localStorage, IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map([...Object.keys(globals), 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
let oldService = false
let limitationOffline = false, limitationMalformed = false
const originalNow = Date.now
let now = Date.UTC(2026, 9, 12, 12), serial = 0, revision = 1, offline = false, malformed = false
let legacyTimeShift = 0
Date.now = () => now
const intervals = new Map(), timers = new Map(), calls = [], pins = []
dom.setInterval = (fn, ms) => { intervals.set(++serial, { fn, ms }); return serial }
dom.clearInterval = id => intervals.delete(id)
dom.setTimeout = (fn, ms) => { timers.set(++serial, { fn, ms }); return serial }
dom.clearTimeout = id => timers.delete(id)
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.append(container)
const root = createRoot(container)
const at = now + 60_000, day = 86400000, display = { mode: 'utc', utcOffsetMinutes: 0 }
const { SavedReleaseResearch } = await server.ssrLoadModule('./src/alert/highlights/SavedReleaseResearch.tsx')
const { useHighlights } = await server.ssrLoadModule('./src/alert/highlights/useHighlights.ts')
let highlights
function HighlightProbe({ brokerId = 'Broker-A', visibility = 'active' }) {
  const current = useHighlights(brokerId, 2000, visibility)
  React.useLayoutEffect(() => { highlights = current }, [current])
  return null
}
const { highlightRequest } = await server.ssrLoadModule('./src/alert/highlights/highlight-model.ts')
const { groupInspectorReleases } = await server.ssrLoadModule('./src/inspector/releases/group-releases.ts')
const { inspectorFamilies } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
const cpi = inspectorFamilies.find(family => family.id === 'us-cpi')
const cadLabor = inspectorFamilies.find(family => family.id === 'ca-labor')
const row = (id, currency, country, time) => ({ value_id: `${id}/${time}`, event_id: id, currency, country_code: country, country_name: country,
  name: `Series ${id}`, event_code: id, release_at: time, server_time_seconds: time / 1000, chart_time_seconds: time / 1000,
  period_seconds: at / 1000 - 30 * 86400, revision: 0, actual: null, forecast: .2, previous: .1, revised_previous: null,
  unit: 1, multiplier: 0, digits: 1, time_mode: 0, impact: 'none', importance: 'high', availability: 'observed' })
let rows = [row(cpi.events[0], 'USD', 'US', at), row(cpi.events[1], 'USD', 'US', at),
  row('840050014', 'USD', 'US', at + 3 * day), row(cadLabor.events[0], 'CAD', 'CA', at + 2 * day)]
function snapshot(sourceId, visibility = 'active') {
  return pins.filter(pin => pin.source_id === sourceId && (visibility === 'all' || !!pin.archived_utc === (visibility === 'archived'))).map(pin => {
    const events = rows.filter(row => pin.value_ids.includes(row.value_id)).map(row => pin.source_id === 'Elev8-Demo2' ? { ...row, release_at: row.release_at + legacyTimeShift } : row)
    return JSON.parse(JSON.stringify({ ...pin, events, release_at: Math.min(...events.map(row => row.release_at)),
      server_time: Math.min(...events.map(row => row.server_time_seconds)), missing_value_ids: [] }))
  }).sort((a, b) => a.release_at - b.release_at)
}
globalThis.fetch = async (url, options = {}) => {
  const route = new URL(String(url), 'http://localhost'); calls.push({ path: route.pathname, options })
  if (route.pathname === '/storage-api/highlight-limitations') {
    if (limitationOffline) return { ok: false, status: 503, json: async () => ({}) }
    const source_id = route.searchParams.get('source_id')
    return { ok: true, json: async () => limitationMalformed ? { source_id, revision: 'bad', items: [{}] } :
      route.searchParams.get('after_revision') === 'limit-1' ? { source_id, revision: 'limit-1', unchanged: true } :
      { source_id, revision: 'limit-1', items: source_id === 'Broker-A' ? [{ id: 'limit-1', source_id, key: 'rba-time', currency: 'AUD',
        kind: 'schedule-mismatch', title: 'RBA decision hour differs', description: 'Stored time differs from the official schedule.',
        action: 'Use the official decision time.', checked_utc: '2026-10-12T11:00:00Z', status: 'open',
        official_schedule: '10:30 Jakarta', stored_schedule: '11:30 Jakarta', sources: [{ kind: 'web', label: 'RBA calendar', locator: 'https://www.rba.gov.au/schedules-events/calendar/', note: '' }] }] : [] } }
  }
  if (route.pathname.startsWith('/storage-api/highlights')) {
    if (offline) return { ok: false, status: 503, json: async () => ({}) }
    if (options.method === 'POST') {
      if (/\/(archive|restore)$/.test(route.pathname)) {
        if (oldService) return { ok: false, status: 404, json: async () => ({ detail: 'Not Found' }) }
        const pin = pins.find(pin => pin.id === route.pathname.split('/').at(-2))
        pin.archived_utc = route.pathname.endsWith('/archive') ? new Date(now).toISOString() : null
        revision++
        return { ok: true, json: async () => ({ id: pin.id }) }
      }
      pins.push({ ...JSON.parse(options.body), id: `pin-${++serial}`, pinned_utc: new Date(now).toISOString() }); revision++
      return { ok: true, json: async () => ({ id: pins.at(-1).id }) }
    }
    if (options.method === 'DELETE') {
      pins.splice(pins.findIndex(pin => pin.id === route.pathname.split('/').at(-1)), 1); revision++
      return { ok: true, json: async () => ({}) }
    }
    const source_id = route.searchParams.get('source_id'), visibility = route.searchParams.get('visibility') ?? 'active', signature = `${revision}:${visibility}`
    if (malformed) return { ok: true, json: async () => ({ source_id, revision: signature, items: [{ id: 'invalid' }] }) }
    return { ok: true, json: async () => route.searchParams.get('after_revision') === signature ?
      { highlight_schema: oldService ? 1 : 2, source_id, revision: signature, unchanged: true } :
      { highlight_schema: oldService ? 1 : 2, source_id, revision: signature, items: snapshot(source_id, visibility) } }
  }
  if (route.pathname.endsWith('/health')) return { ok: true, json: async () => ({ revision, collector_error: null,
    sources: [{ id: 'Broker-A', publisher_status: 'live' }] }) }
  return { ok: true, json: async () => ({ source_id: 'Broker-A', revision, time_basis: 'chart', timestamp_convention: 'trade_server_time',
    event_ids: route.searchParams.get('event_ids')?.split(',') ?? null, events: rows,
    coverage: { USD: { missing: [] }, CAD: { missing: [] } }, next_cursor: null }) }
}
const click = async element => { assert.ok(element); await React.act(async () => element.click()) }
const render = async (props = {}) => React.act(async () => root.render(React.createElement(HighlightProbe, props)))
async function poll() {
  const timer = [...timers].find(([, value]) => value.ms === 2000)
  assert.ok(timer); timers.delete(timer[0]); await React.act(async () => timer[1].fn())
}
try {
  for (const release of groupInspectorReleases(rows)) pins.push({ ...highlightRequest(release, 'Broker-A'), id: `saved-${pins.length}`,
    pinned_utc: new Date(now).toISOString() })
  await render()
  assert.equal(highlights.items.length, 3, 'Legacy metadata remains readable independently of the Alert table')
  const captured = rows.filter(row => pins[0].value_ids.includes(row.value_id)).map(row => ({ ...row }))
  pins[0].journal = [{ id: 'research-1', highlight_id: pins[0].id, source_id: 'Broker-A', phase: 'before', scope: 'EURUSD',
    as_of_utc: '2026-10-12T11:00:00Z', saved_utc: '2026-10-12T11:01:00Z', body: 'Original inflation assessment.', direction: 'USD supportive',
    confidence: 'Moderate', counterevidence: 'Weak payrolls', expectations: [], sources: [{ kind: 'web', label: 'Official release', locator: 'https://www.bls.gov/cpi/', note: 'Release vintage' }],
    release_prompt: 'Check actuals against preserved expectations.', prior_highlight_ids: [], correction_of: null, price_reaction: '',
    readings: captured, calendar_revision: 1, reading_vintage: 'Captured when saved', missing_value_ids: [] }]
  revision++; await poll()
  const beforeUpdate = highlights.items
  await poll()
  assert.equal(highlights.items, beforeUpdate, 'Unchanged polling preserves the collection identity')
  rows = rows.map(row => pins[0].value_ids.includes(row.value_id) ? { ...row, actual: .4 } : row); revision++; await poll()
  assert.equal(pins[0].journal[0].readings[0].actual, null, 'Latest actuals cannot overwrite the saved pre-release vintage')
  malformed = true; await poll()
  assert.match(highlights.error, /Invalid Highlight response/)
  assert.equal(highlights.items.length, 3)
  malformed = false; offline = true; await poll()
  await React.act(async () => root.render(null)); await render()
  assert.equal(highlights.items.length, 3, 'Cached original metadata survives an outage')
  offline = false; await render({ brokerId: 'Broker-B' })
  assert.equal(highlights.items.length, 0, 'Different brokers cannot borrow a previous snapshot')
  await render()
  oldService = true
  await React.act(async () => highlights.archive(highlights.items[0].id))
  assert.match(highlights.error, /Restart calendar storage/)
  oldService = false
  const id = highlights.items[0].id
  await React.act(async () => highlights.archive(highlights.items[0].id))
  assert.equal(pins.length, 3)
  await render({ visibility: 'archived' })
  assert.equal(highlights.items[0].id, id)
  await React.act(async () => highlights.restore(id))
  assert.equal(highlights.items.length, 0)
  await render({ visibility: 'all' })
  assert.equal(highlights.items.length, 3, 'All-history cache is distinct from active/archive caches')
  await React.act(async () => root.render(React.createElement(SavedReleaseResearch, { sourceId: 'Broker-A', valueIds: pins[0].value_ids, currency: 'USD' })))
  assert.ok(container.textContent.includes('Saved research · Broker-A'))
  assert.ok(container.textContent.includes('Original inflation assessment.'))
  assert.equal(container.querySelector('select'), null, 'Saved research is presented without the old stacked action dropdowns')
  const originalPin = pins[0]
  pins.push({ ...structuredClone(originalPin), source_id: 'Elev8-Demo2', id: 'legacy-pin',
    journal: originalPin.journal.map(entry => ({ ...structuredClone(entry), source_id: 'Elev8-Demo2', highlight_id: 'legacy-pin' })) }); revision++
  const savedResearch = async () => React.act(async () => root.render(React.createElement(SavedReleaseResearch,
    { sourceId: 'Broker-A', valueIds: originalPin.value_ids, currency: 'USD', events: rows })))
  await React.act(async () => root.render(null)); await savedResearch()
  assert.ok(container.textContent.includes('Saved research · Elev8-Demo2'), 'A verified historical occurrence keeps its original broker attribution')
  legacyTimeShift = day
  await React.act(async () => root.render(null)); await savedResearch()
  assert.ok(!container.textContent.includes('Saved research · Elev8-Demo2'), 'Reused value IDs with a different publication time cannot attach another broker’s research')
  const { DiscoveredLimitations } = await server.ssrLoadModule('./src/external-sources/DiscoveredLimitations.tsx')
  const notes = async currency => React.act(async () => root.render(React.createElement(DiscoveredLimitations, { brokerId: 'Broker-A', currency })))
  await notes('all')
  assert.match(container.textContent, /RBA decision hour differs/)
  assert.equal(container.querySelector('.highlight-limitation a').getAttribute('rel'), 'noopener noreferrer')
  const beforeFilter = calls.length
  await notes('USD')
  assert.equal(container.querySelectorAll('.highlight-limitation').length, 0)
  await notes('AUD')
  assert.equal(calls.length, beforeFilter, 'Feed-note currency changes remain local')
  limitationOffline = true; await poll()
  assert.equal(container.querySelectorAll('.highlight-limitation').length, 1)
  limitationOffline = false
  await React.act(async () => root.render(null))
  const { useInspector } = await server.ssrLoadModule('./src/inspector/useInspector.ts')
  const { InspectorPanel } = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  pins.splice(0); revision++
  let inspector
  function InspectorHarness() {
    const next = useInspector({ symbol: 'EURUSD', events: rows, bars: [{ time: at / 1000, open: 1, high: 2, low: .5, close: 1 }], timeframe: 'H1', timeDisplay: display, clockOffsetMs: 0 })
    React.useLayoutEffect(() => { inspector = next }, [next])
    return React.createElement(React.Fragment, null,
      React.createElement(InspectorPanel, { view: { ...next, brokerId: 'Broker-A' }, symbol: 'EURUSD', source: null, error: null, timeDisplay: display }),
      React.createElement(HighlightProbe, { brokerId: 'Broker-A' }))
  }
  await React.act(async () => root.render(React.createElement(InspectorHarness)))
  await React.act(async () => inspector.selectRelease(inspector.releases.find(release => release.familyId === 'us-cpi').id))
  await click(container.querySelector('.inspector-pin button'))
  assert.equal(highlights.items.length, 1, 'Metadata listeners still synchronize Inspector saves')
  await React.act(async () => root.render(null))
  assert.equal(intervals.size, 0); assert.equal(timers.size, 0)
  console.log('✓ Saved research: original brokers/vintages, corrections, offline caches, archive history, simplified reader, feed notes and Inspector metadata synchronization')
} finally {
  await React.act(async () => root.unmount()); Date.now = originalNow
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
  }
}
