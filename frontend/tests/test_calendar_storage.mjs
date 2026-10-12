import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, navigator: dom.navigator, IS_REACT_ACT_ENVIRONMENT: true }
const previous = new Map([...Object.keys(globals), 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const timers = new Map(), requests = []; let nextTimer = 0
dom.setTimeout = fn => { timers.set(++nextTimer, fn); return nextTimer }
dom.clearTimeout = id => timers.delete(id)
globalThis.fetch = (url, options) => new Promise(resolve => requests.push({ url: String(url), signal: options.signal, resolve }))
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const { createRoot } = await import('react-dom/client')
const root = createRoot(document.createElement('div'))
const at = Date.UTC(2026, 9, 12), range = { from: at, to: at + 86400000 }
const row = (id, actual = .3) => ({ value_id: id, event_id: '840030005', currency: 'USD', country_code: 'US', name: 'CPI m/m',
  release_at: at + 3600000, chart_time_seconds: at / 1000 + 3600, server_time_seconds: at / 1000 + 3600, actual, previous: .1,
  forecast: null, revised_previous: null, revision: 0, unit: 1, multiplier: 0, digits: 1, time_mode: 0, period_seconds: 0, availability: 'observed' })
const health = (revision, broker = 'A', coverage = {}) => ({ revision, sources: [{ id: broker, server_now: at / 1000, publisher_status: 'live', coverage }], collector_error: null })
const page = (events, revision, cursor = null, broker = 'A') => ({ source_id: broker, revision, events,
  timestamp_convention: 'trade_server_time', time_basis: 'chart', event_ids: null, coverage: {}, next_cursor: cursor })
const reply = (request, body, ok = true) => React.act(async () => request.resolve({ ok, status: ok ? 200 : 503, json: async () => body }))
const poll = async () => { const [id, fn] = [...timers][0]; timers.delete(id); await React.act(async () => { void fn() }) }
try {
  const { useStoredCalendar } = await server.ssrLoadModule('./src/economic-calendar/storage/useStoredCalendar.ts')
  let view
  function Harness({ broker = 'A', dates = range, enabled = true }) {
    const next = useStoredCalendar(broker, dates, enabled, { currencies: ['EUR','USD'] })
    React.useLayoutEffect(() => { view = next }, [next])
    return null
  }
  const render = props => React.act(async () => root.render(React.createElement(Harness, props)))
  await render({})
  await reply(requests[0], health(1))
  const params = new URL(requests[1].url, 'http://localhost').searchParams
  assert.equal(params.get('currencies'), 'EUR,USD'); assert.equal(params.get('event_ids'), null)
  assert.equal(params.get('r1_history'), null); assert.equal(params.get('r1_as_of'), null)
  const cursor = { after_time: at / 1000 + 3600, after_id: 'a' }
  await reply(requests[1], page([row('a')], 1, cursor))
  assert.equal(view.events.length, 0, 'Incomplete paging is not published')
  await reply(requests[2], page([row('b')], 1))
  assert.deepEqual(view.events.map(event => event.value_id), ['a','b'])
  const original = view.events, requestCount = requests.length
  await poll(); await reply(requests.at(-1), health(1))
  assert.equal(requests.length, requestCount + 1, 'Unchanged health performs no calendar fetch')
  assert.equal(view.events, original)
  // A moving revision retries the whole inventory, never splices pages.
  await poll(); await reply(requests.at(-1), health(2))
  await reply(requests.at(-1), page([row('a', .8)], 2, cursor))
  await reply(requests.at(-1), page([row('b')], 3))
  assert.equal(view.events, original)
  await reply(requests.at(-1), page([row('a', .8), row('b')], 3))
  assert.equal(view.events[0].actual, .8)
  const corrected = view.events
  await poll(); await reply(requests.at(-1), health(4))
  await reply(requests.at(-1), page([row('a', .8)], 4, cursor))
  await reply(requests.at(-1), page([row('b')], 4, cursor))
  assert.match(view.error, /repeated its page cursor/)
  assert.equal(view.events, corrected, 'A malformed page retains the last complete snapshot')
  await poll(); await reply(requests.at(-1), {}, false)
  assert.equal(view.events, corrected); assert.match(view.error, /HTTP 503/)
  await poll(); await reply(requests.at(-1), health(3))
  assert.equal(view.error, null); assert.equal(view.events, corrected)
  // Coverage changes require a refresh even if observations did not change.
  await poll(); await reply(requests.at(-1), health(3, 'A', { USD: { missing: [] } }))
  await reply(requests.at(-1), page([row('a', .8), row('b')], 3))
  assert.equal(view.events, corrected, 'Identical refreshed data retains array identity')
  await render({ dates: { from: at - 86400000, to: range.to } })
  await reply(requests.at(-1), health(3))
  const obsolete = requests.at(-1)
  await render({ broker: 'B' })
  assert.equal(obsolete.signal.aborted, true)
  assert.equal(view.events.length, 0, 'A new broker cannot show the old broker snapshot')
  await reply(requests.at(-1), health(1, 'B'))
  await reply(requests.at(-1), page([row('new')], 1, null, 'B'))
  await reply(obsolete, page([row('obsolete')], 3))
  assert.equal(view.events[0].value_id, 'new')
  await render({ enabled: false }); assert.equal(view.events.length, 0)
  assert.equal(timers.size, 0)
  console.log('✓ Currency-scoped stored calendar: complete/revision-consistent paging, correction propagation, identity, outage/recovery, coverage refresh, stale cancellation and cleanup')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
