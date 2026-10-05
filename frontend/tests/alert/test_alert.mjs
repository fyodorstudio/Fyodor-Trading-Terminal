import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT', 'fetch']
const previous = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys.slice(0, 7)) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.appendChild(container)
const root = createRoot(container), originalNow = Date.now
let now = Date.UTC(2026, 9, 5, 12)
Date.now = () => now
const intervals = new Map(), polls = new Map()
let timerId = 0
dom.setInterval = (callback, delay) => { intervals.set(++timerId, { callback, delay }); return timerId }
dom.clearInterval = (id) => intervals.delete(id)
dom.setTimeout = (callback) => { polls.set(++timerId, callback); return timerId }
dom.clearTimeout = (id) => polls.delete(id)
const requests = []
globalThis.fetch = (url, options = {}) => new Promise((resolve) => requests.push({ url: String(url), signal: options.signal, resolve }))
const respond = (request, body, ok = true) => React.act(async () => request.resolve({ ok, status: ok ? 200 : 503, json: async () => body }))
try {
  const { AlertDock } = await server.ssrLoadModule('./src/alert/index.ts')
  const { alertEpisodes, alertCountdown, alertSeriesIds } = await server.ssrLoadModule('./src/alert/model/alert-episodes.ts')
  const { defaultInspectorPreferences, inspectorFamilies } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const preferences = { ...defaultInspectorPreferences(), families: ['us-cpi'] }
  const day = 86400000, nextAt = now + 60_000
  const row = (id, at, value = null, extra = {}) => ({ value_id: `${id}-${at}`, event_id: id, name: id, currency: 'USD', country_code: 'US', country_name: 'United States',
    event_code: id, server_time_seconds: at / 1000 + 10800, chart_time_seconds: at / 1000 + 10800, release_at: at,
    period_seconds: at / 1000 - 30 * 86400, revision: 0, time_mode: 0, importance: 'high', impact: 'none', availability: 'observed',
    unit: 1, multiplier: 0, digits: 1, actual: value, previous: .1, forecast: null, revised_previous: null, ...extra })
  const cpi = inspectorFamilies.find((family) => family.id === 'us-cpi')
  const schedule = cpi.events.map((id) => row(id, nextAt))
  const initial = [...schedule, row('840030016', nextAt), row(cpi.events[0], now + 61 * day),
    row(cpi.events[0], now - day, .2), row(cpi.events[0], now - day * 40),
    row(cpi.events[0], nextAt + day, null, { availability: 'not-returned-by-latest-query' })]
  assert.equal(alertEpisodes(initial, preferences, now).length, 1, 'One card per episode, exact applied family filters, no completed/withdrawn/out-of-window releases')
  assert.equal(alertEpisodes(schedule, preferences, nextAt)[0].state, 'awaiting')
  assert.equal(alertEpisodes(schedule.map((event, index) => index ? event : { ...event, actual: .3 }), preferences, nextAt)[0].state, 'partial')
  assert.equal(alertEpisodes(schedule.map((event) => ({ ...event, actual: .3 })), preferences, nextAt).length, 0)
  assert.equal(alertEpisodes([row(cpi.events[0], nextAt, null, { time_mode: 1 })], preferences, now)[0].state, 'unconfirmed')
  assert.equal(alertEpisodes([row(cpi.events[0], now - day, .3, { time_mode: 1 })], preferences, now).length, 0,
    'Completed date-only releases leave Alert even if their exact clock remains unconfirmed')
  assert.equal(alertEpisodes([row(cpi.events[0], now - day, .3, { release_at: null })], preferences, now).length, 0,
    'Actual arrival resolves a numeric alert even when UTC timing is unavailable')
  assert.equal(alertCountdown(now + 50 * day + 23 * 3600000 + 20 * 60000, now), '50 days · 23 hours · 20 minutes remaining')
  assert.equal(alertCountdown(now - 1, now), '0 days · 0 hours · 0 minutes remaining')
  const policyPreferences = { ...preferences, families: ['fomc', 'fed-chair'] }
  const policy = [row('840050014', nextAt), row('840050018', nextAt + 30 * 60000, null, { previous: null }),
    row('840050005', nextAt + 45 * 60000, null, { previous: null })]
  const policyCards = alertEpisodes(policy, policyPreferences, now)
  assert.equal(policyCards.length, 2, 'Known FOMC companion attaches to rate decision; generic Chair speech stays independent')
  assert.equal(policyCards[0].release.events.length, 2)
  assert.equal(policyCards[0].release.releaseAt, nextAt)
  assert.equal(alertEpisodes([policy[2]], policyPreferences, nextAt + 45 * 60000).length, 0, 'No numerical wait for completed speeches')

  const health = (revision = 1, id = 'Broker-A', status = 'live') => ({ revision, collector_error: null, sources: [{ id, publisher_status: status }] })
  const page = (events, revision = 1, id = 'Broker-A', eventIds = alertSeriesIds(preferences)) => ({ source_id: id, revision,
    timestamp_convention: 'trade_server_time', time_basis: 'chart', event_ids: eventIds,
    events, coverage: { USD: { missing: [] } }, next_cursor: null })
  const props = { brokerId: 'Broker-A', preferences, timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 } }
  const render = (overrides = {}) => React.act(async () => root.render(React.createElement(AlertDock, { ...props, ...overrides })))
  await render()
  assert.match(container.textContent, /Loading upcoming/)
  await respond(requests[0], health())
  const params = new URL('http://localhost' + requests[1].url).searchParams
  assert.equal(params.get('source_id'), 'Broker-A')
  assert.deepEqual(params.get('event_ids').split(',').sort(), cpi.events.slice().sort())
  assert.ok(Number(params.get('to_server_seconds')) * 1000 >= now + 60 * day)
  await respond(requests[1], page(initial))
  assert.equal(container.querySelectorAll('.alert-card').length, 1)
  assert.match(container.textContent, /US CPI \/ core CPIUpcoming.*0 days · 0 hours · 1 minute remaining/)
  const deadline = container.querySelector('[data-alert-id]').dataset.alertId
  const count = requests.length
  await render({ timeDisplay: { mode: 'fixed-offset', utcOffsetMinutes: 420 } })
  assert.equal(container.querySelector('[data-alert-id]').dataset.alertId, deadline)
  assert.equal(requests.length, count, 'Display timezone does not change the storage query or deadline')
  now = nextAt
  await React.act(async () => [...intervals.values()].forEach(({ callback }) => callback()))
  assert.match(container.textContent, /Awaiting release data/)
  assert.equal(container.querySelector('.alert-countdown'), null)
  assert.equal(requests.length, count, 'Countdown ticks perform no network requests')
  const poll = [...polls.entries()].at(-1); polls.delete(poll[0])
  await React.act(async () => { void poll[1]() })
  await respond(requests[count], health(2, 'Broker-A', 'offline'))
  await respond(requests[count + 1], page(schedule.map((event, index) => index ? event : { ...event, actual: .3 }), 2))
  assert.match(container.textContent, /Partial release data/)
  assert.match(container.textContent, /Publisher offline/)
  const nextPoll = [...polls.entries()].at(-1); polls.delete(nextPoll[0])
  const completedStart = requests.length
  await React.act(async () => { void nextPoll[1]() })
  await respond(requests[completedStart], health(3))
  const rescheduled = schedule.map((event) => ({ ...event, release_at: nextAt + day, server_time_seconds: (nextAt + day) / 1000 + 10800,
    chart_time_seconds: (nextAt + day) / 1000 + 10800 }))
  await respond(requests[completedStart + 1], page(rescheduled, 3))
  assert.match(container.textContent, /Upcoming.*1 day · 0 hours · 0 minutes remaining/)
  assert.notEqual(container.querySelector('[data-alert-id]').dataset.alertId, deadline)

  // Release arrival removes the completed card; a subsequent outage retains
  // the last stored schedule with an explicit error rather than inventing data.
  const completionPoll = [...polls.entries()].at(-1); polls.delete(completionPoll[0])
  const completionStart = requests.length
  await React.act(async () => { void completionPoll[1]() })
  await respond(requests[completionStart], health(4))
  await respond(requests[completionStart + 1], page(schedule.map((event) => ({ ...event, actual: .3 })), 4))
  assert.equal(container.querySelectorAll('.alert-card').length, 0)
  const unknownPoll = [...polls.entries()].at(-1); polls.delete(unknownPoll[0])
  const unknownStart = requests.length
  await React.act(async () => { void unknownPoll[1]() })
  await respond(requests[unknownStart], health(5))
  await respond(requests[unknownStart + 1], { ...page([row(cpi.events[0], nextAt + day, null, { release_at: NaN })], 5),
    coverage: { USD: { missing: [[now / 1000, now / 1000 + 86400]] } } })
  assert.match(container.textContent, /Time unconfirmed/)
  assert.match(container.textContent, /Partial schedule coverage/)
  assert.equal(container.querySelector('.alert-countdown'), null)
  const outagePoll = [...polls.entries()].at(-1); polls.delete(outagePoll[0])
  const outageStart = requests.length
  await React.act(async () => { void outagePoll[1]() })
  await respond(requests[outageStart], {}, false)
  assert.match(container.textContent, /HTTP 503/)
  assert.match(container.textContent, /Time unconfirmed/, 'A failed poll retains stored schedules with visible stale/error status')

  const switchStart = requests.length
  await render({ brokerId: 'Broker-B' })
  assert.equal(container.querySelectorAll('.alert-card').length, 0, 'Old broker schedule is hidden immediately')
  await respond(requests[switchStart], health(1, 'Broker-B'))
  const obsolete = requests[switchStart + 1]
  const jobsPreferences = { ...preferences, families: ['jobs'] }
  await render({ brokerId: 'Broker-B', preferences: jobsPreferences })
  assert.equal(obsolete.signal.aborted, true)
  await respond(requests[switchStart + 2], health(1, 'Broker-B'))
  await respond(requests[switchStart + 3], page([row('840030016', now + day)], 1, 'Broker-B', alertSeriesIds(jobsPreferences)))
  await respond(obsolete, page(initial, 1, 'Broker-B'))
  assert.match(container.textContent, /US Jobs report \/ NFP/); assert.doesNotMatch(container.textContent, /US CPI \/ core CPI/)
  const emptyStart = requests.length
  await render({ preferences: { ...preferences, families: [] } })
  assert.equal(requests.length, emptyStart); assert.match(container.textContent, /No families selected/)
  await render({ supported: false }); assert.match(container.textContent, /currently supports EURUSD/)
  await render({ brokerId: null }); assert.match(container.textContent, /needs calendar storage/)
  await React.act(async () => root.render(null))
  assert.equal(intervals.size, 0); assert.equal(polls.size, 0, 'Closing Alert stops countdown and polling')
  console.log('✓ Alert episodes, Inspector family filters, selected broker, bounded schedules, local countdown, due/partial/rescheduled/offline states, timezone invariance and cleanup')
} finally {
  await React.act(async () => root.unmount()); Date.now = originalNow
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of Object.entries(previous)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
}
