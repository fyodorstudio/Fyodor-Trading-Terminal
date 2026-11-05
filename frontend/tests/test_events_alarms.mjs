import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
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
const scrolls = []
dom.HTMLElement.prototype.scrollTo = function(options) { scrolls.push({ node: this, ...options }); this.scrollTop = options.top }
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
  outside('undated', { kind: 'watch', event_at: null, visibility_scope: 'global', risk_status: 'ongoing', risk_checked_utc: '2026-10-22T17:00:00Z' })]
const alarms = { application: 'fyodor-alarms', schedule_schema: 2, revision: 1, now, native_available: true, settings: { enabled: false, release_minutes: 2 },
  schedule_error: null, refreshed_at: now / 1000, events: [], jobs: [], migration: { matches: [], issues: [] } }
const source = { publisher_status: 'live' }
let calendarOverride = null
let impactFailure = false, impactRevision = 1
const rating = (id, overrides = {}) => ({ id, source: 'highlight', reference: 'pin', broker, key: `highlight:${broker}:pin`,
  level: 'low', reason: 'This occurrence adds limited information to the current outlook.', as_of_utc: '2026-10-22T17:00:00Z',
  saved_utc: '2026-10-22T17:01:00Z', value_ids: ['1', '2'], sources: [{ kind: 'web', label: 'Assessment evidence', locator: 'https://www.bls.gov/cpi/' }], ...overrides })
let impacts = [rating('rating-calendar'), rating('rating-external', { source: 'external', reference: 'cpi-report', broker: '', key: 'external:cpi-report', level: 'A', value_ids: [] })]
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
      if (action.action === 'audio-settings') alarms.audio=action.audio
      if (action.action === 'preview') alarms.preview_playing=true
      if (action.action === 'stop-preview') alarms.preview_playing=false
      if (action.action === 'clear-missed') for(const job of alarms.jobs)if(['missed','failed','interrupted'].includes(job.status))job.status='dismissed'
      if (action.action === 'dismiss') for(const job of alarms.jobs)if(action.ids.includes(job.id))job.status='dismissed'
      alarms.revision++
    }
    return reply(alarms)
  }
  if (route.pathname === '/storage-api/alert-calendar') {
    assert.equal(params.get('source_id'), broker, 'Elev8 is never selected for the unified table')
    if (params.get('date') === delayDate) return new Promise(resolve => { delayed = { resolve, signal: options.signal, date: delayDate } })
    if (failure) return { ok: false, status: 503, json: async () => ({}) }
    if (calendarOverride) return reply({ source_id: broker, date: params.get('date'), revision: String(calendarRevision), source,
      coverage: {}, events: readings, ...calendarOverride })
    return reply({ source_id: broker, date: params.get('date'), revision: String(calendarRevision), source, coverage: {},
      ...(params.get('after_revision') === String(calendarRevision) ? { unchanged: true } : { events: params.get('date') === '2026-10-23' ? readings : [] }) })
  }
  if (route.pathname === '/storage-api/external-sources') return reply({ scope: params.get('scope'), visibility: params.get('visibility'), revision: 'external',
    ...(params.has('after_revision') ? { unchanged: true } : { offset: 0, matches: externalItems.length, next_offset: null, items: externalItems }) })
  if (route.pathname.startsWith('/storage-api/external-sources/')) return reply({ items: [] })
  if (route.pathname === '/storage-api/legacy-research') return reply({ highlight_schema: 2, source_id: null, revision: 'legacy', items: [] })
  if (route.pathname === '/storage-api/highlights') return reply({ source_id: params.get('source_id'), revision: 'pins', items: [] })
  if (route.pathname === '/storage-api/alert-impact') {
    if (impactFailure) return { ok: false, status: 503 }
    return reply({ broker: params.get('source_id'), revision: String(impactRevision),
      ...(params.get('after_revision') === String(impactRevision) ? { unchanged: true } : { items: params.get('source_id') === broker ? impacts : [] }) })
  }
  if (route.pathname === '/storage-api/highlight-limitations') return reply({ source_id: broker, revision: 'limits', items: [{
    id: 'issue', source_id: broker, key: 'calendar-gap', currency: 'USD', kind: 'missing-release', title: 'Calendar coverage gap',
    description: 'A release is missing from the broker feed.', action: 'Check the publisher.', checked_utc: '2026-10-22T17:00:00Z', status: 'open',
    official_schedule: '', stored_schedule: '', sources: [{ kind: 'web', label: 'Publisher', locator: 'https://www.bls.gov/', note: '' }],
  }] })
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
  const flush = () => React.act(async () => { for (const [id, fn] of frames) { frames.delete(id); fn() } })
  await render()
  const headerStyles = document.createElement('style')
  headerStyles.textContent = ['../src/alert/dock/alert-date-selector.css', '../src/alert/dock/alert-table.css', '../src/events-alarms/events-alarms.css']
    .map(file => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n')
  document.head.append(headerStyles)
  for (const selector of ['.alert-date-wheel', '.alert-month-wheel', '[aria-label="Alert year"]', '[aria-label="Alarm controls"]']) {
    assert.equal(dom.getComputedStyle(host.querySelector(selector)).height, '44px', `${selector} has the same outer height`)
    assert.equal(dom.getComputedStyle(host.querySelector(selector)).boxSizing, 'border-box')
  }
  assert.equal(requests.some(request => request.url.startsWith('/storage-api/highlight-limitations')), false, 'Alert does not load an invisible Feed notes collection')
  assert.equal(host.querySelector('[aria-label="Event view"]'), null)
  assert.equal(host.querySelectorAll('[aria-label="Alert currency"] button').length, 9)
  assert.ok(host.textContent.includes('Reuters'))
  assert.ok(!host.textContent.includes('External Source'))
  assert.ok(![...host.querySelectorAll('button')].some(node => /^(Archive|Research|Pin|Restore)$/.test(node.textContent)))
  const table = host.querySelector('.alert-event-table')
  const cpi = table.querySelector('[data-series-id="840030005"]').parentElement
  assert.equal(table.querySelectorAll('thead th').length, 8, 'Actual replaces the separate Countdown column')
  assert.ok(!table.querySelector('thead').textContent.includes('Countdown'))
  const cpiRows = () => [...table.querySelectorAll('.alert-event-group')].filter(node => node.dataset.alertId === cpi.dataset.alertId)
  assert.equal(cpiRows().flatMap(node => [...node.querySelectorAll('.alert-release-countdown')]).length, 5, 'Each pending broker/external row repeats its countdown in Actual')
  assert.equal(table.querySelector('.alert-release-countdown').textContent, 'Coming in 1h')
  assert.ok(table.querySelector('.alert-release-countdown').closest('td.alert-value'), 'Countdown stays under Actual')
  assert.equal(table.querySelector('.alert-time-cell .alert-release-countdown'), null)
  assert.ok([...cpi.querySelectorAll('.alert-value-pending')].every(cell => cell.textContent === 'Coming in 1h'), 'Pending Actuals are readable on every row')
  for (const row of table.querySelectorAll('.alert-summary-row')) assert.equal(dom.getComputedStyle(row).height, '36px', 'Single and grouped summary rows share one standard height')
  assert.equal(dom.getComputedStyle(cpi.querySelector('.event-alarm-toggle')).height, '24px', 'Shared controls fit inside a standard row')
  assert.equal(dom.getComputedStyle(cpi.querySelector('.alert-time-cell')).paddingTop, '2px', 'The two-line clock does not enlarge standalone rows')
  assert.equal(table.querySelector('[data-series-id="840030016"] .alert-value').textContent, '100%')
  assert.equal(table.querySelector('[data-external-key="date-only"] .alert-value').textContent, 'Time unconfirmed')
  assert.equal(cpiRows().length, 5, 'Four broker components plus linked Reuters each have their own flat entry')
  assert.ok(cpiRows().every(node => node.querySelectorAll('.alert-summary-row').length === 1))
  assert.equal(cpiRows().flatMap(node => [...node.querySelectorAll('.event-alarm-toggle')]).length, 1, 'One shared bell for the verified publication')
  assert.ok([...table.querySelectorAll('thead th')].some(node=>node.textContent==='Tier'))
  assert.equal(cpi.querySelector('[data-series-id="840030005"] .alert-ai-impact').textContent, 'S — essential', 'The shared CPI tier replaces historical impact and broker importance')
  assert.equal(table.querySelector('[data-series-id="840030007"] .alert-ai-impact').textContent, 'S — essential', 'Calendar tiers are available without an agent assessment')
  assert.equal(table.querySelector('tr[data-external-key="cpi-report"] .alert-ai-impact').textContent, 'A — major', 'A linked publisher keeps its own tier assessment')
  assert.equal(table.querySelector('[data-external-key="unrelated-same-time"] .alert-ai-impact').textContent, 'C — secondary', 'Matching time does not transfer a tier assessment')
  const cpiValueRow=table.querySelector('[data-series-id="840030005"]')
  assert.match(cpiValueRow.querySelector('.alert-source-cell a').href,/bls.gov/)
  assert.equal(cpiValueRow.querySelectorAll('.alert-value')[1].querySelector('a'),null,'A publisher link does not validate anonymous forecast consensus')
  assert.equal(cpi.querySelector('.event-alarm-toggle').getAttribute('aria-pressed'), 'false')
  assert.ok(!cpi.querySelector('.event-alarm-toggle').disabled, 'Selections can be saved while global delivery is paused')
  assert.ok(host.textContent.includes('Earlier payrolls'), 'Released events stay on their selected date')
  assert.ok(host.textContent.includes('saved-archived'), 'Historical records stay browsable without lifecycle filters')
  assert.equal(table.querySelector('[data-external-key="date-only"] .event-alarm-toggle').disabled, true)
  assert.equal(table.querySelector('[data-external-key="unrelated-same-time"]').querySelectorAll('tr').length, 1, 'Same-time unrelated events never merge')
  const groups = dayGroups(readings, externalItems, '2026-10-23', broker, defaultAlertPreferences())
  assert.equal(groups.find(group => group.release?.familyId === 'us-cpi').external.length, 1)
  assert.equal(moveDate('2026-12-31', 1), '2027-01-01')
  const riskToggle = () => [...host.querySelectorAll('button')].find(node => node.textContent.startsWith('Ongoing risks:'))
  const riskNotice = () => host.querySelector('[aria-label="Current ongoing risks"]')
  assert.ok(riskNotice())
  assert.match(riskNotice().textContent, /Next scheduled: cpi-report/)
  assert.match(riskNotice().textContent, /Coming in 1h/)
  assert.equal(riskToggle().closest('header'), host.querySelector('.alert-date-header'))
  assert.equal(riskToggle().parentElement.querySelector('[aria-label="Alarm controls"]') !== null, true, 'Risk controls sit beside Alarm Settings')
  await click(riskToggle())
  assert.equal(riskToggle().getAttribute('aria-pressed'), 'false')
  assert.equal(riskNotice(), null)
  assert.ok(host.querySelector('[data-external-key="undated"]'), 'Hiding a notice retains its saved event')
  assert.equal(mutations.length, 0, 'Notice visibility never changes alarms')
  assert.equal([...host.querySelectorAll('button')].some(node => node.textContent === 'Feed notes'), false)
  await click(cpi.querySelector('.event-alarm-toggle'))
  assert.equal(mutations.at(-1).action, 'subscribe')
  assert.equal(cpi.querySelector('.event-alarm-toggle').getAttribute('aria-pressed'), 'true')
  await click(cpi.querySelector('.event-alarm-toggle'))
  assert.equal(mutations.at(-1).action, 'toggle-many')
  assert.equal(cpi.querySelector('.event-alarm-toggle').getAttribute('aria-pressed'), 'false')
  assert.equal(cpi.querySelector('.alert-event-details'), null, 'Bell actions do not expand details')
  await click(cpi.querySelector('.alert-source-cell'))
  assert.match(cpi.querySelector('.alert-event-details').textContent, /limited information/)
  assert.ok(cpi.querySelector('.alert-ai-impact-details a[href="https://www.bls.gov/cpi/"]'))
  assert.match(cpi.querySelector('.alert-ai-impact-details').textContent, /Jakarta/)
  assert.equal(cpi.querySelector('[role="tablist"]'), null, 'Overview is compact and no longer has legacy tabs')
  assert.ok(cpi.querySelector('.alert-event-details > header .alert-overview-label'))
  assert.equal(cpi.querySelector('.alert-event-details > header button'), null, 'The summary row is the collapse control')
  assert.equal(cpi.querySelector('a[href^="https://www.reuters.com"]'), null, 'Broker expansion contains only its own event details')
  const linked = table.querySelector('tr[data-external-key="cpi-report"]').parentElement
  assert.equal(linked.querySelector('.alert-event-details'), null, 'Linked publisher expansion is independent')
  await click(linked.querySelector('.alert-event-name'))
  assert.ok(linked.querySelector('a[href^="https://www.reuters.com"]'))
  assert.equal(linked.querySelector('[aria-label="Show cpi-report icon on chart"]').checked, true)
  await click(linked.querySelector('[aria-label="Show cpi-report icon on chart"]'))
  assert.equal(JSON.parse(localStorage.getItem('fyodor.external-sources.chart-icons.v1'))['cpi-report'].visible, false)
  assert.equal(cpi.querySelector('select'), null, 'Expanded details no longer stacks view/scope/prompt dropdowns')
  await click(cpi.querySelector('.alert-event-name'))
  assert.equal(cpi.querySelector('.alert-event-details'), null)
  assert.ok(linked.querySelector('.alert-event-details'), 'Collapsing a broker event keeps the linked event open')
  assert.ok(cpi.classList.contains('alert-hover-dismissed'), 'Collapsing clears hover emphasis while the pointer remains')
  await click(cpi.querySelector('.alert-value'))
  assert.ok(cpi.querySelector('.alert-event-details'), 'Values also expand the publication')
  await click(host.querySelector('[aria-label="Alarm controls"]'))
  assert.match(document.querySelector('[aria-label="Alarm settings and status"]').textContent, /Alarms paused/)
  assert.ok(host.querySelector('[aria-label="Alarm controls"]').textContent.includes('Alarm Settings'))
  const popover=()=>document.querySelector('[aria-label="Alarm settings and status"]')
  const findSoundButton=label=>[...popover().querySelectorAll('button')].find(node=>node.textContent===label)
  const volume=popover().querySelector('[aria-label="Economic reminder volume"]')
  await React.act(async()=>volume[Object.keys(volume).find(k=>k.startsWith('__reactProps'))].onChange({target:{value:'17'}}))
  await click(findSoundButton('Save sound settings'))
  assert.equal(alarms.audio.volume,17);assert.equal(alarms.audio.duration,3);assert.equal(alarms.audio.repeat,false)
  assert.equal(alarms.settings.enabled,false,'Sound edits preserve global delivery pause')
  await click(findSoundButton('Preview'));assert.equal(alarms.preview_playing,true)
  await click(findSoundButton('Stop preview'));assert.equal(alarms.preview_playing,false)
  alarms.jobs=Array.from({length:16},(_,i)=>({id:'missed'+i,event_key:'old',title:'Old '+i,at:now-100000,due:now/1000-120,stage:'release',status:'missed',prompt:'Original prompt',error:null}))
  await tick('pollAlarms')
  assert.match(popover().textContent,/Missed \/ interrupted reminders \(16\)/,'Count includes the full unresolved backlog')
  await click(popover().querySelector('[aria-label="Clear missed reminder Old 0"]'))
  assert.equal(alarms.jobs[0].status,'dismissed')
  await click(findSoundButton('Clear all missed'))
  assert.ok(alarms.jobs.every(job=>job.status==='dismissed'))
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
  const impactRequests = requests.filter(request => request.url.startsWith('/storage-api/alert-impact')).length
  assert.equal(impactRequests, 1, 'Overview reuses one shared impact reader without legacy broker requests')
  await React.act(async () => { now += 1000; for (const { fn } of intervals.values()) fn() })
  assert.equal(host.querySelector('.alert-event-table .alert-release-countdown').textContent, 'Coming in 59:59')
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
  assert.equal(host.querySelector('[data-series-id="840030005"] .alert-value-pending'), null, 'A published actual replaces the countdown immediately')
  // Bad snapshots never replace good readings or advance the polling revision.
  const goodRow = host.querySelector('[data-series-id="840030005"]')
  for (const invalid of [{ coverage: { USD: null } }, { coverage: { USD: {} } }, { coverage: [] },
    { coverage: { USD: { missing: [[5, 1]] } } }, { events: [{ ...readings[0], name: null }] },
    { source: {} }, { unchanged: true, revision: 'wrong-revision' }]) {
    calendarOverride = invalid; await tick('pollAlertDay')
    assert.match(host.textContent, /Invalid date calendar response/)
    assert.equal(host.querySelector('[data-series-id="840030005"]'), goodRow, 'Malformed data retains the last valid row')
  }
  calendarOverride = { coverage: { USD: { missing: [[1, 5]] } } }; calendarRevision++
  await tick('pollAlertDay')
  assert.match(host.textContent, /Partial calendar coverage/)
  assert.ok(!host.textContent.includes('Invalid date calendar response'), 'A valid full snapshot recovers after rejection')
  calendarOverride = null; calendarRevision++; await tick('pollAlertDay')
  impactFailure = true; await tick('pollAlertImpact')
  assert.match(host.textContent, /Impact assessments unavailable/)
  assert.equal(host.querySelector('[data-series-id="840030005"] .alert-ai-impact').textContent, 'S — essential', 'Calendar tiers remain available through assessment outages')
  impactFailure = false; impactRevision++
  impacts = impacts.map(item => item.source === 'highlight' ? { ...item, value_ids: ['1','2','3'] } : item)
  await tick('pollAlertImpact')
  assert.equal(host.querySelector('[data-series-id="840030007"] .alert-ai-impact').textContent, 'S — essential', 'Membership updates cannot replace the shared calendar classification')
  const wheel = host.querySelector('[aria-label="Alert date selector"]')
  await React.act(async () => wheel.dispatchEvent(new dom.WheelEvent('wheel', { deltaY: -100, cancelable: true })))
  assert.equal(frames.size, 1, 'Wheel changes batch into one animation frame')
  await React.act(async () => { for (const [id, fn] of frames) { frames.delete(id); fn() } })
  assert.ok(host.querySelector('[aria-current="date"]').getAttribute('aria-label').endsWith('-22'))
  await React.act(async () => root.render(null)); await render()
  assert.equal(riskNotice(), null, 'Notice visibility survives a dock remount')
  await click(riskToggle())
  assert.ok(riskNotice(), 'The same control restores ongoing notices')
  const externalRequests = requests.filter(request => request.url.startsWith('/storage-api/external-sources?')).length
  await render({ focus: { request: 1, externalKey: 'cpi-report' } }); await flush()
  assert.equal(host.querySelector('[data-alert-focused="true"]').dataset.externalKey, 'cpi-report')
  assert.ok(host.querySelector('[data-alert-focused="true"] .alert-event-details'))
  assert.equal(scrolls.length, 1, 'A symbol selection scrolls only after its dated details are available')
  assert.equal(scrolls[0].node, host.querySelector('.alert-date-scroll'), 'Navigation scrolls the dock rather than the page')
  await render({ focus: { request: 2, externalKey: 'cpi-report' } }); await flush()
  assert.equal(scrolls.length, 2, 'Repeated selection of the same symbol scrolls again')
  assert.equal(requests.filter(request => request.url.startsWith('/storage-api/external-sources?')).length, externalRequests, 'Symbol navigation reuses mounted readers')
  await render({ focus: { request: 3, sourceId: broker, valueIds: ['1'], date: '2026-10-23', families: ['us-cpi'] } }); await flush()
  assert.ok(host.querySelector('[data-alert-focused="true"] [data-series-id="840030005"]'), 'Exact calendar value IDs navigate to their release package')
  assert.equal(scrolls.length, 3)
  await render({ focus: { request: 4, externalKey: 'undated' } }); await flush()
  assert.equal(host.querySelector('.alert-undated').open, true)
  assert.equal(host.querySelector('[data-alert-focused="true"]').dataset.externalKey, 'undated', 'Undated risks open before scrolling')
  const countBeforeTick = scrolls.length
  await React.act(async () => { now += 3600000; for (const { fn } of intervals.values()) fn() })
  await flush()
  assert.equal(scrolls.length, countBeforeTick, 'Clock movement never steals the user’s scroll position')
  assert.ok(!riskNotice().textContent.includes('Next scheduled:'), 'Elapsed and date-only saved risks cannot provide a future countdown')
  const beforeLegacyRequests = requests.filter(request => request.url === '/storage-api/legacy-research').length
  assert.equal(beforeLegacyRequests, 0, 'Ordinary Alert browsing never loads legacy archives')
  await click([...host.querySelectorAll('button')].find(node => node.textContent === 'Legacy pins & research'))
  await React.act(async () => { await server.ssrLoadModule('./src/alert/highlights/LegacyResearchBrowser.tsx') })
  assert.ok(host.querySelector('[aria-label="Legacy pins and research"]'), 'The header exposes the archive browser')
  assert.equal(requests.filter(request => request.url === '/storage-api/legacy-research').length, 1)
  const calendarBeforeReturn = host.querySelector('.alert-event-table')
  await click([...host.querySelectorAll('button')].find(node => node.textContent === 'Back to calendar'))
  assert.equal(host.querySelector('[aria-label="Legacy pins and research"]'), null)
  assert.equal(host.querySelector('.alert-event-table'), calendarBeforeReturn, 'Returning preserves the mounted calendar')
  const { AlertDateSelector } = await server.ssrLoadModule('./src/alert/dock/AlertDateSelector.tsx')
  function DateProbe({ initial }) {
    const [date, setDate] = React.useState(initial)
    return React.createElement(AlertDateSelector, { date, onChange: setDate })
  }
  const renderDate = initial => React.act(async () => root.render(React.createElement(DateProbe, { key: initial, initial })))
  await renderDate('2028-01-31')
  assert.equal(host.querySelector('select'), null, 'The month control is a revolver, not a dropdown')
  await click(host.querySelector('[aria-label="Next month"]'))
  assert.equal(host.querySelector('[aria-current="date"]').getAttribute('aria-label'), '2028-02-29', 'Month changes clamp to the leap day')
  const monthWheel = host.querySelector('[aria-label="Alert month selector"]')
  await React.act(async () => { for (let i = 0; i < 20; i++) monthWheel.dispatchEvent(new dom.WheelEvent('wheel', { deltaY: 30, cancelable: true })) })
  assert.equal(frames.size, 1, 'Month wheel events batch into one frame')
  await flush()
  assert.equal(host.querySelector('[aria-current="date"]').getAttribute('aria-label'), '2028-03-29')
  await renderDate('2026-12-31')
  await click(host.querySelector('[aria-label="Next month"]'))
  assert.equal(host.querySelector('[aria-current="date"]').getAttribute('aria-label'), '2027-01-31', 'The month revolver crosses year boundaries')
  await renderDate('2026-01-31')
  await click(host.querySelector('[aria-label="Next month"]'))
  assert.equal(host.querySelector('[aria-current="date"]').getAttribute('aria-label'), '2026-02-28')
  await React.act(async () => root.unmount())
  assert.equal(timers.size, 0); assert.equal(intervals.size, 0); assert.equal(frames.size, 0)
  console.log('✓ Unified Alert: all/date-only/released events, named sources, exact linked packages, one opt-in bell, saved selections, clean details, chart icons, filters, date/wheel navigation, stale replies and cleanup')
} finally {
  await React.act(async () => root.unmount())
  await server.close(); await dom.happyDOM.close(); Date.now = originalNow
  for (const [key, value] of previous) { if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key] }
}
