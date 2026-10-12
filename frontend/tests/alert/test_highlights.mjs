import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

globalThis.__highlightSeriesWork = 0
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false },
  plugins: [{ name: 'highlight-work', enforce: 'pre', transform(code, id) {
    if (id.endsWith('/HighlightList.tsx')) return code.replace('return <div className="highlight-series">',
      'globalThis.__highlightSeriesWork++; return <div className="highlight-series">')
  } }] })
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node,
  navigator: dom.navigator, localStorage: dom.localStorage, IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map([...Object.keys(globals), 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const originalNow = Date.now
let now = Date.UTC(2026, 9, 12, 12), serial = 0, revision = 1, offline = false, malformed = false
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
const { AlertDock } = await server.ssrLoadModule('./src/alert/index.ts')
const { inspectorFamilies } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
const { alertPreferencesKey, defaultAlertPreferences } = await server.ssrLoadModule('./src/alert/model/alert-preferences.ts')
const cpi = inspectorFamilies.find(family => family.id === 'us-cpi')
const cadLabor = inspectorFamilies.find(family => family.id === 'ca-labor')
const row = (id, currency, country, time) => ({ value_id: `${id}/${time}`, event_id: id, currency, country_code: country, country_name: country,
  name: `Series ${id}`, event_code: id, release_at: time, server_time_seconds: time / 1000, chart_time_seconds: time / 1000,
  period_seconds: at / 1000 - 30 * 86400, revision: 0, actual: null, forecast: .2, previous: .1, revised_previous: null,
  unit: 1, multiplier: 0, digits: 1, time_mode: 0, impact: 'none', importance: 'high', availability: 'observed' })
let rows = [row(cpi.events[0], 'USD', 'US', at), row(cpi.events[1], 'USD', 'US', at),
  row('840050014', 'USD', 'US', at + 3 * day), row(cadLabor.events[0], 'CAD', 'CA', at + 2 * day)]
function snapshot(sourceId) {
  return pins.filter(pin => pin.source_id === sourceId).map(pin => {
    const events = rows.filter(row => pin.value_ids.includes(row.value_id))
    return { ...pin, events, release_at: Math.min(...events.map(row => row.release_at)),
      server_time: Math.min(...events.map(row => row.server_time_seconds)), missing_value_ids: [] }
  }).sort((a, b) => a.release_at - b.release_at)
}
globalThis.fetch = async (url, options = {}) => {
  const route = new URL(String(url), 'http://localhost'); calls.push({ path: route.pathname, options })
  if (route.pathname.startsWith('/storage-api/highlights')) {
    if (offline) return { ok: false, status: 503, json: async () => ({}) }
    if (options.method === 'POST') {
      pins.push({ ...JSON.parse(options.body), id: `pin-${++serial}`, pinned_utc: new Date(now).toISOString() }); revision++
      return { ok: true, json: async () => ({ id: pins.at(-1).id }) }
    }
    if (options.method === 'DELETE') {
      pins.splice(pins.findIndex(pin => pin.id === route.pathname.split('/').at(-1)), 1); revision++
      return { ok: true, json: async () => ({}) }
    }
    const source_id = route.searchParams.get('source_id'), signature = String(revision)
    if (malformed) return { ok: true, json: async () => ({ source_id, revision: signature, items: [{ id: 'invalid' }] }) }
    return { ok: true, json: async () => route.searchParams.get('after_revision') === signature ?
      { source_id, revision: signature, unchanged: true } : { source_id, revision: signature, items: snapshot(source_id) } }
  }
  if (route.pathname.endsWith('/health')) return { ok: true, json: async () => ({ revision, collector_error: null,
    sources: [{ id: 'Broker-A', publisher_status: 'live' }] }) }
  return { ok: true, json: async () => ({ source_id: 'Broker-A', revision, time_basis: 'chart', timestamp_convention: 'trade_server_time',
    event_ids: route.searchParams.get('event_ids')?.split(',') ?? null, events: rows,
    coverage: { USD: { missing: [] }, CAD: { missing: [] } }, next_cursor: null }) }
}
const click = async element => { assert.ok(element); await React.act(async () => element.click()) }
const button = text => [...container.querySelectorAll('button')].find(button => button.textContent === text)
let prepared
const renderAlert = async overrides => React.act(async () => root.render(React.createElement(AlertDock,
  { brokerId: 'Broker-A', timeDisplay: display, onPrepareResearch: release => { prepared = release }, ...overrides })))
async function poll() {
  const timer = [...timers].find(([, value]) => value.ms === 2000)
  assert.ok(timer); timers.delete(timer[0]); await React.act(async () => timer[1].fn())
}
try {
  localStorage.setItem(alertPreferencesKey, JSON.stringify({ ...defaultAlertPreferences(), families: ['us-cpi', 'fomc', 'ca-labor'] }))
  await renderAlert()
  assert.deepEqual([...container.querySelectorAll('[aria-label="Alert currency"] button')].slice(0, 2).map(button => button.textContent), ['Highlight', 'All'])
  assert.equal(container.querySelectorAll('.alert-row').length, 3)
  const pinButtons = [...container.querySelectorAll('.alert-pin')]
  for (const pin of pinButtons) await click(pin)
  assert.equal(pins.length, 3)
  assert.equal(pins[0].value_ids.length, 2, 'Pin keeps every series in the selected CPI package')
  await click(button('Highlight'))
  assert.equal(container.querySelectorAll('.highlight-card').length, 3)
  assert.equal(container.querySelector('[aria-label="Alert horizon"]'), null, 'Pinned releases are independent of the upcoming horizon')
  assert.equal(container.querySelector('.highlight-card').dataset.highlightId, pins[0].id, 'Soonest pin appears first')
  assert.equal(container.querySelectorAll('.highlight-series').length, 0, 'Collapsed cards avoid rendering series tables')
  const first = container.querySelector('.highlight-card'), detail = first.querySelector('details')
  await React.act(async () => { detail.open = true; detail.dispatchEvent(new dom.Event('toggle')) })
  assert.equal(first.querySelectorAll('tr[data-series-id]').length, 2)
  assert.match(first.textContent, /Forecast.*Previous.*Revised previous/)
  const work = globalThis.__highlightSeriesWork, network = calls.length
  assert.ok(work > 0)
  now = at + 1000
  for (let tick = 0; tick < 10; tick++) await React.act(async () => { now += 1000; for (const timer of intervals.values()) timer.fn() })
  assert.match(first.textContent, /Awaiting release data/)
  assert.equal(calls.length, network, 'Countdown ticks never fetch or regroup data')
  assert.equal(globalThis.__highlightSeriesWork, work, 'Countdown ticks do not render unchanged expanded series')
  rows = rows.map(row => row.release_at === at ? { ...row, actual: .3, revised_previous: .15, revision: 1 } : row); revision++
  await poll()
  assert.equal(container.querySelectorAll('.highlight-card').length, 3, 'Publication never removes a pin')
  assert.equal(detail.open, true, 'Arrival retains expansion state')
  assert.match(first.textContent, /Released/); assert.match(first.textContent, /0.3%/); assert.match(first.textContent, /Revision 1/)
  await click(first.querySelector('[aria-label^="Prepare research"]'))
  assert.equal(prepared.events.length, 2, 'Research retains the whole highlighted release package after publication')
  assert.ok(prepared.events.every(event => event.actual === .3))
  rows = rows.map(row => row.value_id === pins[0].value_ids[0] ? { ...row, availability: 'not-returned-by-latest-query' } : row); revision++
  await poll()
  assert.match(first.textContent, /Readings unavailable/, 'Withdrawn observations never imply a complete verified release')
  rows = rows.map(row => ({ ...row, availability: 'observed' })); revision++
  rows = rows.map(row => row.event_id === '840050014' ? { ...row, release_at: at - day, server_time_seconds: (at-day)/1000 } : row); revision++
  await poll()
  assert.equal(container.querySelector('.highlight-card').dataset.highlightId, pins[2].id, 'A corrected schedule re-sorts the same pinned occurrence')
  assert.equal(detail.open, true)
  const beforeZone = calls.length
  await renderAlert({ timeDisplay: { mode: 'fixed-offset', utcOffsetMinutes: 420 } })
  assert.equal(calls.length, beforeZone, 'Display timezone never refetches highlights')
  malformed = true; await poll()
  assert.match(container.textContent, /Invalid Highlight response/)
  assert.equal(container.querySelectorAll('.highlight-card').length, 3, 'Malformed responses retain the last valid snapshot')
  malformed = false; await poll()
  offline = true; await poll()
  assert.equal(container.querySelectorAll('.highlight-card').length, 3, 'Outages retain readings and pins')
  await React.act(async () => root.render(null)); await renderAlert()
  assert.equal(container.querySelectorAll('.highlight-card').length, 3, 'Cached pins survive a remount while storage is offline')
  offline = false
  localStorage.setItem('fyodor.highlights.Broker-B', JSON.stringify([{ source_id: 'Broker-B', events: [], value_ids: [] }]))
  await renderAlert({ brokerId: 'Broker-B' })
  assert.equal(container.querySelectorAll('.highlight-card').length, 0, 'A different broker never sees the previous broker pins')
  await renderAlert(); await poll()
  await click(container.querySelector('[aria-label^="Remove highlight"]'))
  assert.equal(container.querySelectorAll('.highlight-card').length, 2, 'Only explicit removal deletes the pin')
  await React.act(async () => root.render(null))
  assert.equal(intervals.size, 0); assert.equal(timers.size, 0)

  const { useInspector } = await server.ssrLoadModule('./src/inspector/useInspector.ts')
  pins.splice(0); revision++
  const { InspectorPanel } = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  let view
  function InspectorHarness() {
    const next = useInspector({ symbol: 'EURUSD', events: rows, bars: [{ time: at/1000, open: 1, high: 2, low: .5, close: 1 }],
      timeframe: 'H1', timeDisplay: display, clockOffsetMs: 0 })
    React.useLayoutEffect(() => { view = next }, [next])
    return React.createElement(React.Fragment, null,
      React.createElement(InspectorPanel, { view: { ...next, brokerId: 'Broker-A' }, symbol: 'EURUSD', source: null, error: null, timeDisplay: display }),
      React.createElement(AlertDock, { brokerId: 'Broker-A', timeDisplay: display }))
  }
  await React.act(async () => root.render(React.createElement(InspectorHarness)))
  await React.act(async () => view.selectRelease(view.releases.find(release => release.familyId === 'us-cpi').id))
  assert.ok(container.querySelector('.inspector-header > .inspector-pin'), 'Inspector pin is at the far-right end of the header')
  await click(container.querySelector('.inspector-pin button'))
  assert.match(container.querySelector('.inspector-pin button').textContent, /Unpin/)
  assert.equal(container.querySelectorAll('.highlight-card').length, 1, 'Inspector pin immediately updates the open Highlight tab')
  await click(container.querySelector('[aria-label^="Remove highlight"]'))
  assert.equal(container.querySelector('.inspector-pin button').textContent, 'Pin', 'Removing a pin immediately updates Inspector without a polling tick')
  await React.act(async () => view.applyPreferences({ ...view.preferences, symbolGrouping: 'day' }, 'preview'))
  await React.act(async () => view.selectRelease(view.releases.find(release => release.currency === 'USD').id))
  assert.ok(container.querySelector('.inspector-pin-menu button'), 'Daily Inspector lets the user select individual releases to pin')
  await React.act(async () => root.render(null))
  assert.equal(intervals.size, 0); assert.equal(timers.size, 0)
  console.log('✓ Highlight: both pin entry points, all series, sorting/rescheduling, publication/revisions, retained expansion, offline persistence, broker isolation, removal and zero countdown table/network work')
} finally {
  await React.act(async () => root.unmount()); Date.now = originalNow
  delete globalThis.__highlightSeriesWork
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
  }
}
