import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Node: dom.Node, navigator: dom.navigator,
  localStorage: dom.localStorage, IS_REACT_ACT_ENVIRONMENT: true }
const saved = new Map([...Object.keys(globals), 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
const timers = new Map(), intervals = new Map(); let id = 0, offline = false, invalid = false, hold = false, held
dom.setTimeout = (fn, ms) => { timers.set(++id, { fn, ms }); return id }; dom.clearTimeout = id => timers.delete(id)
dom.setInterval = (fn, ms) => { intervals.set(++id, { fn, ms }); return id }; dom.clearInterval = id => intervals.delete(id)
const originalNow = Date.now; let now = Date.parse('2026-10-15T04:00:00Z'); Date.now = () => now
const reading = { value_id: 'cpi-value', event_id: '840030005', name: 'CPI m/m', currency: 'USD', country_code: 'US', country_name: 'US', event_code: 'cpi',
  release_at: now + 3600000, server_time_seconds: (now + 3600000) / 1000, chart_time_seconds: (now + 3600000) / 1000,
  period_seconds: now / 1000 - 30 * 86400, revision: 0, actual: null, forecast: .2, previous: .1, revised_previous: null,
  unit: 1, multiplier: 0, digits: 1, time_mode: 0, impact: 'none', importance: 'high', availability: 'observed' }
const pin = { id: 'pin-cpi', source_id: 'demo', label: 'US CPI', family_id: 'us-cpi', currency: 'USD', value_ids: [reading.value_id], event_ids: [reading.event_id],
  pinned_utc: '2026-10-14T00:00:00Z', events: [reading], release_at: reading.release_at, server_time: reading.server_time_seconds, missing_value_ids: [] }
const external = (key, changes = {}) => ({ id: 'a'.repeat(32), key, title: key, currencies: ['USD'], kind: 'scheduled', status: 'confirmed', facts: 'Official schedule', interpretation: '',
  event_at: new Date(now + 1800000).toISOString(), event_date: null, published_utc: null, time_note: 'Verified schedule', saved_utc: '2026-10-14T00:00:00Z',
  archived: false, expected_version: null, version_count: 1, sources: [{ kind: 'web', label: 'Official', locator: 'https://home.treasury.gov/', note: '' }], ...changes })
const externalItems = [external('treasury', { title: 'Treasury' }), external('unknown-hour', { title: 'Unknown hour', event_at: null, event_date: '2026-10-15' })]
const event = (key, changes = {}) => ({ key, reference: pin.id, source: 'highlight', broker: 'demo', title: pin.label, currencies: ['USD'], at: now + 3600000,
  date: null, eligible: true, armed: true, note: 'Official schedule', prompt: '$one-minute-before-release US CPI', ...changes })
let data = { application: 'fyodor-alarms', revision: 1, now, native_available: true, schedule_error: null, refreshed_at: now / 1000,
  settings: { enabled: true, prepare_minutes: 10, release_minutes: 1 }, jobs: [], events: [event('stage-0'), event('stage-1', { at: now + 7200000 }),
    event('another-broker', { broker: 'other' }), event('treasury', { reference: 'treasury', source: 'external', broker: null }),
    event('unknown', { reference: 'unknown-hour', source: 'external', broker: null, at: null, date: '2026-10-15', eligible: false, armed: false })] }
const requests = []
globalThis.fetch = async (url, options = {}) => {
  requests.push({ url: String(url), options })
  if (String(url).startsWith('/alarm-api')) {
    if (hold) return new Promise(resolve => { held = resolve })
    if (offline) return { ok: false, status: 503, json: async () => ({ detail: 'Worker stopped' }) }
    if (options.method === 'POST') {
      const body = JSON.parse(options.body)
      assert.equal(body.expected_revision, data.revision)
      if (body.action === 'toggle') data = { ...data, revision: data.revision + 1, events: data.events.map(event => event.key === body.key ? { ...event, armed: body.enabled } : event) }
      if (body.action === 'settings') data = { ...data, revision: data.revision + 1, settings: body.settings }
      if (body.action === 'dismiss') data = { ...data, revision: data.revision + 1, jobs: data.jobs.map(job => body.ids.includes(job.id) ? { ...job, status: 'dismissed' } : job) }
      return { ok: true, json: async () => body.action === 'test' ? { accepted: true } : structuredClone(data) }
    }
    return { ok: true, json: async () => invalid ? {} : structuredClone(data) }
  }
  const route = new URL(String(url), 'http://localhost'), params = route.searchParams
  if (route.pathname.startsWith('/storage-api/external-sources/') && options.method === 'POST') {
    const [, , , key, action] = route.pathname.split('/')
    const item = externalItems.find(item => item.key === key)
    assert.equal(JSON.parse(options.body).expected_version, item.id)
    item.archived = action === 'archive'; item.version_count += 1
    item.id = (item.archived ? 'b' : 'c').repeat(32)
    return { ok: true, json: async () => ({ key, id: item.id }) }
  }
  if (route.pathname === '/storage-api/external-sources') return { ok: true, json: async () => structuredClone({ revision: 'external', scope: params.get('scope'), visibility: params.get('visibility'),
    offset: 0, matches: externalItems.length, next_offset: null, items: externalItems }) }
  if (route.pathname === '/storage-api/highlights') return { ok: true, json: async () => ({ source_id: 'demo', revision: 'pins', source_status: 'live', items: [pin] }) }
  if (route.pathname === '/storage-api/highlight-limitations') return { ok: true, json: async () => ({ source_id: params.get('source_id'), revision: 'limits', items: [
    { id: 'limit', source_id: 'demo', key: 'missing-release', currency: 'USD', kind: 'missing-release', title: 'Missing policy event',
      description: 'Outside-feed reference', action: 'Check the official schedule', checked_utc: '2026-10-14T00:00:00Z', status: 'open',
      official_schedule: '', stored_schedule: '', sources: [] }
  ] }) }
  if (route.pathname === '/storage-api/health') return { ok: true, json: async () => ({ revision: 1, collector_error: null,
    sources: [{ id: 'demo', publisher_status: 'live', server_now: now / 1000 }] }) }
  if (route.pathname === '/storage-api/calendar') return { ok: true, json: async () => ({ source_id: 'demo', revision: 1, timestamp_convention: 'trade_server_time', time_basis: 'chart',
    event_ids: params.get('event_ids')?.split(',') ?? null, events: [reading], coverage: {}, next_cursor: null }) }
  throw new Error(`Unexpected request ${url}`)
}
const { createRoot } = await import('react-dom/client')
const node = document.createElement('div'); document.body.append(node); const root = createRoot(node)
const button = text => [...document.querySelectorAll('button')].find(button => button.textContent === text)
const click = async target => { assert.ok(target); await React.act(async () => target.click()) }
const view = async value => click([...node.querySelectorAll('[aria-label="Event view"] button')].find(button => button.textContent === ({ highlight: 'Highlight', calendar: 'MT5 Calendar', external: 'External Source' }[value])))
const poll = async () => {
  const [key, timer] = [...timers].find(([, timer]) => timer.fn.name === 'pollAlarms')
  timers.delete(key); await React.act(async () => timer.fn())
}
try {
  const { EventsDock } = await server.ssrLoadModule('./src/events-alarms/EventsDock.tsx')
  const render = () => React.act(async () => root.render(React.createElement(EventsDock, { brokerId: 'demo', brokerOffsetSeconds: 0, focusKey: null })))
  await render()
  assert.deepEqual([...node.querySelectorAll('[aria-label="Event view"] button')].map(button => button.textContent), ['Highlight', 'MT5 Calendar', 'External Source'])
  assert.equal(button('Highlight').getAttribute('aria-pressed'), 'true')
  assert.equal(node.querySelectorAll('.unified-highlight-list .highlight-card').length, 3, 'One shortlist contains both saved sources')
  assert.equal(node.querySelectorAll('.highlight-source').length, 3)
  assert.ok(node.querySelector('[data-highlight-id="pin-cpi"]').textContent.includes('PM'), 'Highlight uses Jakarta AM/PM')
  assert.equal(node.querySelector('.event-timeline-row'), null)
  assert.ok(!node.textContent.includes('All events'))
  assert.equal(node.querySelectorAll('.events-dock-header').length, 1)
  assert.equal(node.querySelectorAll('[aria-label="Highlight currency"] button').length, 9)
  assert.deepEqual([...node.querySelector('[aria-label="Highlight view"]').options].map(option => option.value), ['active', 'archived'])
  assert.equal(node.querySelector('.events-header-filters').contains(node.querySelector('[aria-label="Highlight currency"]')), false)
  assert.equal(node.querySelector('.events-header-separator').nextElementSibling.getAttribute('aria-label'), 'Highlight currency', 'Currencies follow view controls and separator')
  assert.equal(document.querySelector('.alarm-popover'), null)
  const cards = () => [...node.querySelectorAll('.unified-highlight-list .highlight-card')].map(card => card.dataset.externalKey ?? card.dataset.highlightId)
  assert.deepEqual(cards(), ['unknown-hour', 'treasury', 'pin-cpi'], 'Date-only Today stays explicitly unconfirmed; both sources share date ordering')
  const sort = node.querySelector('[aria-label="Sort Highlight by date"]')
  await React.act(async () => { sort.value = 'latest'; sort.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.deepEqual(cards(), ['pin-cpi', 'treasury', 'unknown-hour'])
  await click([...node.querySelectorAll('[aria-label="Highlight currency"] button')].find(button => button.textContent === 'EUR'))
  assert.equal(cards().length, 0, 'Currency filter applies to both sources')
  await click([...node.querySelectorAll('[aria-label="Highlight currency"] button')].find(button => button.textContent === 'All'))
  let alarm = node.querySelector('[data-highlight-id="pin-cpi"] [aria-label="Alarm for US CPI"]')
  assert.ok(alarm, 'Alarm button lives directly on the existing Highlight pin')
  assert.equal(alarm.getAttribute('aria-pressed'), 'true')
  assert.equal(alarm.querySelector('path').getAttribute('fill'), 'currentColor')
  assert.ok(alarm.title.includes('Preparation:') && alarm.title.includes('Invoke agent:'), 'Hover shows both reminder times')
  await click(alarm)
  assert.ok(data.events.filter(event => event.broker === 'demo').every(event => !event.armed), 'One pin button toggles all its future stages')
  assert.equal(data.events.find(event => event.broker === 'other').armed, true, 'Other broker remains independent')
  assert.equal(node.querySelector('[aria-label="Alarm for US CPI"]').getAttribute('aria-pressed'), 'false')
  assert.equal(node.querySelector('[aria-label="Alarm for US CPI"] path').getAttribute('fill'), 'none')
  assert.equal(node.querySelector('[aria-label="Alarm for Unknown hour"]').disabled, true)
  await click(node.querySelector('[aria-label="Alarm for Treasury"]'))
  assert.equal(data.events.find(event => event.key === 'treasury').armed, false)
  const count = requests.length; now += 1000
  await React.act(async () => { for (const timer of intervals.values()) timer.fn() })
  assert.equal(requests.length, count, 'Countdowns do not poll or mutate alarms')
  await React.act(async () => root.render(null)); await render()
  assert.equal(node.querySelector('[aria-label="Alarm for US CPI"]').getAttribute('aria-pressed'), 'false', 'Pin alarm state survives refresh')
  assert.equal(node.querySelector('[aria-label="Sort Highlight by date"]').value, 'latest')
  await click(node.querySelector('[aria-label="Archive highlight Treasury"]'))
  assert.ok(!node.querySelector('[data-external-key="treasury"]'), 'Archived external leaves active shortlist')
  const visibility = node.querySelector('[aria-label="Highlight view"]')
  await React.act(async () => { visibility.value = 'archived'; visibility.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.ok(node.querySelector('[data-external-key="treasury"]'), 'External archive remains accessible')
  await click(node.querySelector('[aria-label="Restore highlight Treasury"]'))
  assert.equal(node.querySelector('[data-external-key="treasury"]'), null)
  await React.act(async () => { visibility.value = 'active'; visibility.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  await view('calendar')
  assert.ok(node.querySelector('.alert-row'), 'MT5 Calendar remains the original release browser')
  assert.equal(node.querySelector('[aria-label="Alert collection"]'), null, 'No nested Highlight or duplicate Upcoming selector')
  assert.equal(node.querySelector('[aria-label="Highlight view"]'), null, 'Active/Archived only belongs to Highlight')
  await view('external')
  assert.equal(node.querySelectorAll('.events-dock-header').length, 1)
  assert.equal(node.querySelectorAll('[aria-label="External Sources currency"] button').length, 9)
  assert.equal(node.querySelector('.event-alarm-toggle'), null, 'Alarms live in the combined Highlight shortlist')
  await click(node.querySelector('[aria-label="Unpin Treasury"]'))
  assert.ok(node.querySelector('[aria-label="Pin Treasury"]'), 'Unpin retains the external research in its source view')
  await click(node.querySelector('[aria-label="Pin Treasury"]'))
  const mutations = requests.filter(request => request.options.method === 'POST').length
  await click(node.querySelector('[data-external-key="treasury"] .external-icon-toggle input'))
  assert.equal(requests.filter(request => request.options.method === 'POST').length, mutations, 'Chart visibility does not change alarms')
  const externalView = node.querySelector('[aria-label="External Source view"]')
  await React.act(async () => { externalView.value = 'limitations'; externalView.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.ok(node.textContent.includes('Missing policy event'), 'External Source receives the current broker for reference issues')
  assert.equal(node.querySelector('.external-records'), null, 'Reference issues remain separate from event rows')
  await click([...node.querySelectorAll('[aria-label="External Sources currency"] button')].find(button => button.textContent === 'EUR'))
  assert.ok(node.textContent.includes('No recorded EUR limitations'))
  await click([...node.querySelectorAll('[aria-label="External Sources currency"] button')].find(button => button.textContent === 'All'))
  await view('highlight'); await view('external')
  assert.equal(node.querySelector('[aria-label="External Source view"]').value, 'limitations', 'Reference selection survives reopening')
  assert.ok(node.textContent.includes('Missing policy event'))
  await click(node.querySelector('[aria-label="Alarm controls"]')); await click(button('Test alarm'))
  assert.ok(document.body.textContent.includes('Test launched'))
  data = { ...data, revision: data.revision + 1, jobs: [{ id: 'j', event_key: 'stage-0', title: 'US CPI', at: now + 600000, due: now / 1000,
    stage: 'prepare', prompt: 'prepare', status: 'ringing', error: null }] }
  await poll(); assert.ok(document.body.textContent.includes('Reminder ringing'))
  await click(button('Dismiss')); assert.equal(document.querySelector('.alarm-ringing'), null)
  await view('highlight')
  offline = true; await poll()
  assert.ok(node.textContent.includes('Alarms unavailable'))
  assert.equal(node.querySelector('[aria-label="Alarm for Treasury"]').disabled, true)
  assert.equal(node.querySelectorAll('.highlight-card').length, 3, 'Worker outage does not hide either source')
  offline = false; invalid = true; await poll()
  await click(node.querySelector('[aria-label="Alarm controls"]'))
  assert.ok(document.body.textContent.includes('Invalid alarm worker response'))
  invalid = false; await poll()
  await React.act(async () => document.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.equal(document.querySelector('.alarm-popover'), null)
  assert.equal(document.activeElement, node.querySelector('[aria-label="Alarm controls"]'))
  hold = true; const pending = poll()
  await React.act(async () => root.render(null))
  held({ ok: true, json: async () => ({ ...data, revision: 100, events: [] }) }); await pending; hold = false
  assert.equal(timers.size, 0); assert.equal(intervals.size, 0)
  localStorage.setItem('fyodor.events.tab.v1', 'all')
  await render()
  assert.equal(button('Highlight').getAttribute('aria-pressed'), 'true', 'Legacy All view migrates to shared Highlight')
  assert.equal(node.querySelector('[aria-label="Alarm for US CPI"]').getAttribute('aria-pressed'), 'false')
  console.log('✓ Shared Highlight: ordered sources, source labels, date/currency filters, persistent external pins/archive/restore, bell states, reminder times, broker isolation and unchanged countdown work')
} finally {
  Date.now = originalNow
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
