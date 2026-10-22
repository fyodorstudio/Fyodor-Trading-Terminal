import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'

const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window','document','HTMLElement','Node','navigator','localStorage','IS_REACT_ACT_ENVIRONMENT','fetch','requestAnimationFrame','cancelAnimationFrame']
const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys.slice(0, 7)) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const frames = new Map(), timers = new Map(), intervals = new Map(); let timerId = 0
globalThis.requestAnimationFrame = fn => { frames.set(++timerId, fn); return timerId }
globalThis.cancelAnimationFrame = id => frames.delete(id)
dom.requestAnimationFrame = globalThis.requestAnimationFrame
dom.cancelAnimationFrame = globalThis.cancelAnimationFrame
dom.setTimeout = (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId }
dom.clearTimeout = id => timers.delete(id)
dom.setInterval = (fn, ms) => { intervals.set(++timerId, { fn, ms }); return timerId }
dom.clearInterval = id => intervals.delete(id)
const originalNow = Date.now; let now = Date.parse('2026-10-22T18:00:00Z'); Date.now = () => now
const requests = [], mutations = []; let calendarRevision = 1, failure = false, delayDate = null, delayed = null
const broker = 'Pepperstone-Demo', at = now + 3600000
const reading = (id, value, overrides = {}) => ({ value_id: id, event_id: value, name: `CPI ${value}`, currency: 'USD', country_code: 'US', country_name: 'US', event_code: 'cpi',
  release_at: at, server_time_seconds: at / 1000 + 10800, chart_time_seconds: null, period_seconds: 1788220800, revision: 0, actual: null, forecast: .2,
  previous: .1, revised_previous: null, unit: 1, multiplier: 0, digits: 1, time_mode: 0, impact: 'none', importance: 'high', availability: 'observed', ...overrides })
let readings = ['840030005','840030006','840030007','840030008'].map((id, i) => reading(String(i + 1), id))
readings.push(reading('10', '840030016', { name: 'Earlier payrolls', release_at: now - 1800000, actual: 100 }))
const outside = (key, overrides = {}) => ({ id: 'a'.repeat(32), key, title: key, currencies: ['USD'], kind: 'scheduled', status: 'confirmed', facts: 'Verified source facts.', interpretation: 'Saved interpretation.',
  event_at: new Date(at).toISOString(), event_date: null, published_utc: null, time_note: 'Verified scheduled time', saved_utc: '2026-10-21T00:00:00Z', archived: false, version_count: 1,
  expected_version: null, sources: [{ kind: 'web', label: 'Story title, not publisher', locator: 'https://www.reuters.com/markets/example/', note: '' }], ...overrides })
const externalItems = [outside('cpi-report', { calendar_reference: { source_id: broker, value_ids: ['1','2'] } }),
  outside('unrelated-same-time'), outside('date-only', { event_at: null, event_date: '2026-10-23' }),
  outside('saved-archived', { archived: true, event_at: new Date(now - 60000).toISOString() }),
  outside('undated', { kind: 'watch', event_at: null })]
const alarms = { application: 'fyodor-alarms', schedule_schema: 2, revision: 1, now, native_available: true, settings: { enabled: false, release_minutes: 2 },
  schedule_error: null, refreshed_at: now / 1000, events: [], jobs: [], migration: { matches: [], issues: [] } }
const source = { publisher_status: 'live' }
const reply = body => ({ ok: true, status: 200, json: async () => structuredClone(body) })
globalThis.fetch = async (url, options = {}) => {
  const route = new URL(String(url), 'http://localhost'), params = route.searchParams
  requests.push({ url: String(url), signal: options.signal, method: options.method })
  if (route.pathname === '/alarm-api/alarms') {
    if (options.method === 'POST') {
      const action = JSON.parse(options.body); mutations.push(action)
      assert.equal(action.expected_revision, alarms.revision)
      if (action.action === 'subscribe') alarms.events.push({ key: 'calendar-choice', reference: 'calendar-choice', source: 'calendar', broker, value_ids: action.value_ids,
        title: action.title, currencies: ['USD'], at, date: null, eligible: true, selected: action.enabled, armed: false, note: '', prompt: 'Invoke exact occurrence' })
      if (action.action === 'toggle-many') for (const event of alarms.events) if (action.keys.includes(event.key)) event.selected = action.enabled
      alarms.revision++
    }
    return reply(alarms)
  }
  if (route.pathname === '/storage-api/alert-calendar') {
    assert.equal(params.get('source_id'), broker, 'Elev8 is never selected for the unified table')
    if (params.get('date') === delayDate) return new Promise(resolve => { delayed = { resolve, signal: options.signal, date: delayDate } })
    if (failure) return { ok: false, status: 503, json: async () => ({}) }
    return reply({ source_id: broker, date: params.get('date'), revision: String(calendarRevision), source, coverage: {},
      ...(params.get('after_revision') === String(calendarRevision) ? { unchanged: true } : { events: params.get('date') === '2026-10-23' ? readings : [] }) })
  }
  if (route.pathname === '/storage-api/external-sources') return reply({ scope: params.get('scope'), visibility: params.get('visibility'), revision: 'external',
    ...(params.has('after_revision') ? { unchanged: true } : { offset: 0, matches: externalItems.length, next_offset: null, items: externalItems }) })
  if (route.pathname.startsWith('/storage-api/external-sources/')) return reply({ items: [] })
  if (route.pathname === '/storage-api/highlights') return reply({ source_id: params.get('source_id'), revision: 'pins', items: [] })
  if (route.pathname === '/storage-api/alert-impact') return reply({ broker: params.get('source_id'), revision: 'impact', items: [] })
  if (route.pathname === '/storage-api/highlight-limitations') return reply({ source_id: broker, revision: 'limits', items: [] })
  throw new Error(`Unexpected request ${url}`)
}
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
const click = async node => { assert.ok(node); await React.act(async () => node.click()) }
const tick = async name => { const [id, timer] = [...timers].find(([, timer]) => timer.fn.name === name); timers.delete(id); await React.act(async () => timer.fn()) }
try {
  const { EventsDock } = await server.ssrLoadModule('./src/events-alarms/EventsDock.tsx')
  const { dayGroups, moveDate } = await server.ssrLoadModule('./src/alert/model/alert-day-model.ts')
  const { defaultAlertPreferences } = await server.ssrLoadModule('./src/alert/model/alert-preferences.ts')
  const render = props => React.act(async () => root.render(React.createElement(EventsDock, { brokerId: 'Elev8-Demo2', focusKey: null, ...props })))
  await render()
  assert.equal(host.querySelector('[aria-label="Event view"]'), null)
  assert.equal(host.querySelectorAll('[aria-label="Alert currency"] button').length, 9)
  assert.ok(host.textContent.includes('Reuters'))
  assert.ok(!host.textContent.includes('External Source'))
  assert.ok(![...host.querySelectorAll('button')].some(node => /^(Archive|Research|Pin|Restore)$/.test(node.textContent)))
  const table = host.querySelector('.alert-event-table')
  const cpi = table.querySelector('[data-series-id="840030005"]').parentElement
  assert.equal(cpi.querySelectorAll('tr:not(.alert-details-row)').length, 5, 'Four broker components plus linked Reuters retain separate rows')
  assert.equal(cpi.querySelectorAll('.event-alarm-toggle').length, 1, 'One shared bell for the verified publication')
  assert.equal(cpi.querySelector('.event-alarm-toggle').getAttribute('aria-pressed'), 'false')
  assert.ok(!cpi.querySelector('.event-alarm-toggle').disabled, 'Selections can be saved while global delivery is paused')
  assert.ok(host.textContent.includes('Earlier payrolls'), 'Released events stay on their selected date')
  assert.ok(host.textContent.includes('saved-archived'), 'Historical records stay browsable without lifecycle filters')
  assert.equal(table.querySelector('[data-external-key="date-only"] .event-alarm-toggle').disabled, true)
  assert.equal(table.querySelector('[data-external-key="unrelated-same-time"]').querySelectorAll('tr').length, 1, 'Same-time unrelated events never merge')
  const groups = dayGroups(readings, externalItems, '2026-10-23', broker, defaultAlertPreferences())
  assert.equal(groups.find(group => group.release?.familyId === 'us-cpi').external.length, 1)
  assert.equal(moveDate('2026-12-31', 1), '2027-01-01')
  await click(cpi.querySelector('.event-alarm-toggle'))
  assert.equal(mutations.at(-1).action, 'subscribe')
  assert.equal(cpi.querySelector('.event-alarm-toggle').getAttribute('aria-pressed'), 'true')
  await click(cpi.querySelector('.event-alarm-toggle'))
  assert.equal(mutations.at(-1).action, 'toggle-many')
  assert.equal(cpi.querySelector('.event-alarm-toggle').getAttribute('aria-pressed'), 'false')
  await click(cpi.querySelector('.alert-event-name'))
  assert.deepEqual([...cpi.querySelectorAll('[role="tab"]')].map(node => node.textContent), ['Overview','Sources & history','Saved research'])
  await click([...cpi.querySelectorAll('[role="tab"]')].find(node => node.textContent === 'Sources & history'))
  assert.ok(cpi.querySelector('a[href^="https://www.reuters.com"]'))
  assert.equal(cpi.querySelector('[aria-label="Show cpi-report icon on chart"]').checked, true)
  await click(cpi.querySelector('[aria-label="Show cpi-report icon on chart"]'))
  assert.equal(JSON.parse(localStorage.getItem('fyodor.external-sources.chart-icons.v1'))['cpi-report'].visible, false)
  await click([...cpi.querySelectorAll('[role="tab"]')].find(node => node.textContent === 'Saved research'))
  assert.match(cpi.textContent, /No saved research/)
  assert.equal(cpi.querySelector('select'), null, 'Expanded details no longer stacks view/scope/prompt dropdowns')
  await click(host.querySelector('[aria-label="Alarm controls"]'))
  assert.match(document.querySelector('[aria-label="Alarm settings and status"]').textContent, /Alarms paused/)
  assert.ok(host.querySelector('[aria-label="Alarm controls"]').textContent.includes('Alarm Settings'))
  await React.act(async () => document.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  const mutationsBefore = mutations.length
  await click(host.querySelector('[aria-label="Previous date"]'))
  assert.equal(host.querySelectorAll('.alert-event-group').length, 1, 'Changing date hides dated releases while retaining the undated section')
  await click(host.querySelector('[aria-label="Next date"]'))
  assert.equal(mutations.length, mutationsBefore, 'Date changes never subscribe, cancel or archive')
  await click(host.querySelector('[aria-label="Alert filters"]'))
  const modal = document.querySelector('[aria-labelledby="alert-filter-title"]')
  await click(modal.querySelector('[aria-label="Select all USD"]'))
  await click([...modal.querySelectorAll('button')].find(node => node.textContent === 'Cancel'))
  assert.ok(host.querySelector('[data-series-id="840030005"]'), 'Cancel keeps the applied filters')
  const requestCount = requests.length
  await React.act(async () => { now += 1000; for (const { fn } of intervals.values()) fn() })
  assert.equal(requests.length, requestCount, 'Countdown ticks do not request calendar or alarm data')
  delayDate = '2026-10-24'
  await click(host.querySelector('[aria-label="Next date"]'))
  assert.ok(delayed)
  await click(host.querySelector('[aria-label="Previous date"]'))
  assert.equal(delayed.signal.aborted, true)
  await React.act(async () => delayed.resolve(reply({ source_id: broker, date: delayed.date, revision: 'stale', source, events: [], coverage: {} })))
  assert.ok(host.querySelector('[data-series-id="840030005"]'), 'A stale date reply cannot replace the current date')
  failure = true; await tick('pollAlertDay')
  assert.ok(host.textContent.includes('HTTP 503'))
  assert.ok(host.querySelector('[data-series-id="840030005"]'), 'A failed poll keeps saved readings with an explicit error')
  failure = false; calendarRevision++
  readings = readings.map(event => ({ ...event, actual: .4 }))
  await tick('pollAlertDay')
  assert.ok(host.querySelector('[data-series-id="840030005"]').textContent.includes('0.4%'))
  const wheel = host.querySelector('[aria-label="Alert date selector"]')
  await React.act(async () => wheel.dispatchEvent(new dom.WheelEvent('wheel', { deltaY: -100, cancelable: true })))
  assert.equal(frames.size, 1, 'Wheel changes batch into one animation frame')
  await React.act(async () => { for (const [id, fn] of frames) { frames.delete(id); fn() } })
  assert.ok(host.querySelector('[aria-current="date"]').getAttribute('aria-label').endsWith('-22'))
  await React.act(async () => root.unmount())
  assert.equal(timers.size, 0); assert.equal(intervals.size, 0); assert.equal(frames.size, 0)
  console.log('✓ Unified Alert: all/date-only/released events, named sources, exact linked packages, one opt-in bell, saved selections, clean details, chart icons, filters, date/wheel navigation, stale replies and cleanup')
} finally {
  await React.act(async () => root.unmount())
  await server.close(); await dom.happyDOM.close(); Date.now = originalNow
  for (const [key, value] of previous) { if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key] }
}
