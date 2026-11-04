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
globalThis.fetch = (url, options = {}) => String(url).startsWith('/storage-api/highlights') ? Promise.resolve({ ok: true, json: async () => ({ source_id: new URL(String(url), 'http://localhost').searchParams.get('source_id'), revision: 'empty', items: [] }) }) : new Promise((resolve) => requests.push({ url: String(url), signal: options.signal, resolve }))
try {
  const { alertComingIn, alertSeriesIds } = await server.ssrLoadModule('./src/alert/model/alert-format.ts')
  const { dayGroups } = await server.ssrLoadModule('./src/alert/model/alert-day-model.ts')
  const { currentTimePosition } = await server.ssrLoadModule('./src/alert/model/alert-timeline.ts')
  const { indexAlarmEvents, groupAlarmEvents } = await server.ssrLoadModule('./src/events-alarms/alarm-event-index.ts')
  const { inspectorFamilies } = await server.ssrLoadModule('./src/inspector/catalog/inspector-families.ts')
  const { alertPreferencesKey, defaultAlertPreferences, readAlertPreferences, validAlertPreferences } = await server.ssrLoadModule('./src/alert/model/alert-preferences.ts')
  const cpi = inspectorFamilies.find(family => family.id === 'us-cpi')
  const preferences = { ...defaultAlertPreferences(), families: ['us-cpi'] }
  const at = now + 60000
  const row = (id, extra = {}) => ({ value_id: id, event_id: id, name: id, currency: 'USD', country_code: 'US', country_name: 'United States',
    event_code: id, server_time_seconds: at / 1000 + 10800, chart_time_seconds: null, release_at: at,
    period_seconds: at / 1000 - 30 * 86400, revision: 0, time_mode: 0, importance: 'high', impact: 'none', availability: 'observed',
    unit: 1, multiplier: 0, digits: 1, actual: null, previous: .1, forecast: .4, revised_previous: null, ...extra })
  const events = cpi.events.map(id => row(id))
  const { validAlertDayResponse } = await server.ssrLoadModule('./src/alert/model/alert-day-snapshot.ts')
  const response = { source_id: 'Pepperstone-Demo', date: '2026-10-05', revision: 'one', source: null, coverage: {}, events }
  assert.equal(validAlertDayResponse(response, response.source_id, response.date, ''), true)
  assert.equal(validAlertDayResponse({ ...response, events: [row('unknown-new-series')] }, response.source_id, response.date, ''), true, 'New IDs are admitted without a catalog gate')
  assert.equal(validAlertDayResponse({ ...response, unchanged: true }, response.source_id, response.date, ''), false, 'An initial unchanged reply cannot stand in for a snapshot')
  assert.equal(validAlertDayResponse({ ...response, unchanged: true }, response.source_id, response.date, 'one'), true)
  const groups = dayGroups(events, [], '2026-10-05', 'Pepperstone-Demo', preferences)
  assert.equal(groups.length, 1, 'The date table groups a CPI publication without chart placement')
  assert.equal(groups[0].at, at)
  assert.equal(groups[0].release.events[0].forecast, .4)
  assert.ok(dayGroups(events.map(event => ({ ...event, time_mode: 1 })), [], '2026-10-05', 'Pepperstone-Demo', preferences).every(group => group.at === null), 'Date-only packages never acquire an exact countdown')
  assert.equal(dayGroups(events.map(event => ({ ...event, actual: .3 })), [], '2026-10-05', 'Pepperstone-Demo', preferences).length, 1, 'Published readings stay on their selected date')
  assert.equal(dayGroups(events, [], '2026-10-05', 'Pepperstone-Demo', { ...preferences, currency: 'EUR' }).length, 0)
  assert.equal(alertComingIn(now + 1584000, now), 'Coming in 26:24')
  assert.equal(alertComingIn(now + 149 * 60000, now), 'Coming in 2h 29m')
  assert.equal(alertComingIn(now + 2 * 86400000, now), 'Coming in 2d')
  assert.equal(alertComingIn(now - 1, now), 'Coming in 0:00')
  localStorage.removeItem(alertPreferencesKey)
  assert.equal(readAlertPreferences().days, 7)
  for (const days of [7, 30, 60, 90]) {
    localStorage.setItem(alertPreferencesKey, JSON.stringify({ ...preferences, days }))
    assert.equal(validAlertPreferences(readAlertPreferences()), true, 'Legacy stored horizons remain readable without restoring their UI')
    assert.equal(readAlertPreferences().days, days)
  }
  assert.equal(alertSeriesIds(defaultAlertPreferences()).length, 1051)
  const { HighlightDock } = await server.ssrLoadModule('./src/events-alarms/HighlightDock.tsx')
  const external = (key, currency, time = at) => ({ key, title: key, currencies: [currency], kind: 'scheduled', status: 'confirmed',
    event_at: time === null ? null : new Date(time).toISOString(), event_date: '2026-10-05', sources: [], facts: 'Saved source facts.' })
  const simultaneous = [...events, row('840030016', { name: 'Payrolls' }), row('840030001', { name: 'Producer prices' }),
    row('840030002', { name: 'Later producer prices', value_id: 'later', release_at: at + 1000 })]
  const outside = [external('A UK budget', 'GBP'), external('B external USD release', 'USD'),
    external('Unknown hour one', 'USD', null), external('Unknown hour two', 'USD', null)]
  const globalRisk = { ...external('Global election', 'USD'), visibility_scope: 'global' }
  const scheduleGroups = [0, 60, 180].map((seconds, i) => ({ key: `scheduled-${i}`, at: now + seconds * 1000,
    title: `Scheduled ${i}`, currency: 'USD', valueIds: [`value-${i}`], external: [external(`external-${i}`, 'USD', now + seconds * 1000)] }))
  const timelineGroups = [
    { ...scheduleGroups[0], key: 'archived', at: now - 1000, external: [{ ...external('archived', 'USD'), archived: true }] },
    scheduleGroups[0],
    { ...scheduleGroups[0], key: 'simultaneous', currency: 'JPY' },
    { ...scheduleGroups[0], key: 'headline', at: now + 20000, external: [{ ...external('headline', 'USD'), kind: 'headline' }] },
    scheduleGroups[1], scheduleGroups[2], { ...scheduleGroups[0], key: 'unknown', at: null },
  ]
  assert.equal(currentTimePosition(timelineGroups, now - 2000), 0, 'Before all known events, the line is at the top')
  assert.equal(currentTimePosition(timelineGroups, now), 3, 'Every same-time elapsed row precedes the line, independent of currency/source')
  assert.equal(currentTimePosition(timelineGroups, now + 30000), 4, 'The line follows elapsed headlines rather than snapping to a nearby schedule')
  assert.equal(currentTimePosition(timelineGroups, now + 999999), 6, 'Unknown-time rows never count as elapsed')
  let indexReads = 0
  const large = new Proxy(Array.from({ length: 10000 }, (_, i) => ({ at: now + i * 60000, index: i, key: String(i) })), {
    get(target, key) { if (/^\d+$/.test(String(key))) indexReads++; return Reflect.get(target, key) },
  })
  assert.equal(currentTimePosition(large, now + 5100 * 60000), 5101)
  assert.ok(indexReads < 25, `10,000 schedules require fewer than 25 anchor reads, got ${indexReads}`)
  let eligibilityReads = 0
  const inventory = Array.from({ length: 10000 }, (_, i) => ({ key: `alarm-${i}`, reference: `external-${i}`, source: 'external', at: now + i * 60000,
    get eligible() { eligibilityReads++; return true } }))
  const alarmIndex = indexAlarmEvents(inventory)
  assert.equal(eligibilityReads, 10000, 'One linear inventory pass builds the shared alarm index')
  for (let i = 0; i < 1000; i++) {
    const matches = groupAlarmEvents(alarmIndex, { ...scheduleGroups[0], at: inventory[i].at, external: [{ key: `external-${i}` }] }, 'Pepperstone-Demo')
    assert.equal(matches[0].key, `alarm-${i}`)
  }
  assert.equal(eligibilityReads, 10000, '1,000 bell lookups never rescan the inventory')
  assert.equal(dayGroups([], [globalRisk], '2026-10-05', 'Pepperstone-Demo', { ...preferences, currency: 'JPY' }).length, 1,
    'A global US event remains visible under the JPY filter without changing its currency tags')
  assert.equal(dayGroups([], [globalRisk], '2026-10-06', 'Pepperstone-Demo', preferences).length, 0,
    'Global display never moves a dated record into another date table')
  const globalContext = { ...globalRisk, calendar_reference: { source_id: 'Pepperstone-Demo', value_ids: events.map(event => event.value_id) } }
  const globalGroups = dayGroups(events, [globalContext], '2026-10-05', 'Pepperstone-Demo', { ...preferences, currency: 'JPY' })
  assert.deepEqual(globalGroups[0].valueIds, events.map(event => event.value_id),
    'The globally visible context retains its verified broker bell under another currency filter')
  assert.equal(globalGroups[0].release, undefined, 'Visibility does not manufacture Japanese broker data')
  assert.equal(dayGroups([], [{ ...globalRisk, risk_status: 'resolved' }], '2026-10-05', 'Pepperstone-Demo', preferences)[0].at, at,
    'Resolution removes reminder eligibility, not a known publication clock')
  const displayGroups = (data = simultaneous) => dayGroups(data, outside, '2026-10-05', 'Pepperstone-Demo', defaultAlertPreferences())
  const initialGroups = displayGroups()
  const mutations = []
  const alarms = { data: { schedule_schema: 2, settings: { enabled: true, release_minutes: 2 },
    events: initialGroups.filter(group => group.at !== null).map(group => ({ key: group.key, at: group.at, eligible: true, selected: false,
      source: group.release ? 'calendar' : 'external', broker: 'Pepperstone-Demo', value_ids: group.valueIds, reference: group.external[0]?.key })) },
    mutate: async action => { mutations.push(action) } }
  const renderTable = (groups, clock = now) => React.act(async () => root.render(React.createElement(HighlightDock, {
    groups, sourceId: 'Pepperstone-Demo', alarms, now: clock, focusKey: null, impact: { byValueId: new Map(), byKey: new Map() },
  })))
  const blocks = () => [...container.querySelectorAll('.alert-event-group')]
  const usdBatch = () => blocks().filter(node => initialGroups.some(group => group.key === node.dataset.alertId && group.at === at && group.currency === 'USD'))
  await renderTable(initialGroups)
  const batch = usdBatch()
  assert.equal(batch.length, 4, 'Unrelated calendar packages and external events retain their identities')
  assert.equal(batch.filter(node => node.classList.contains('alert-time-start')).length, 1, 'Simultaneous USD releases share one visual start')
  assert.equal(batch.filter(node => node.classList.contains('alert-time-end')).length, 1, 'Only the final simultaneous release has a divider')
  assert.ok([...container.querySelectorAll('.alert-release-countdown')].every(node => node.closest('td.alert-value')), 'Every countdown belongs in Actual')
  const expectedCountdowns = initialGroups.filter(group => group.at !== null && group.at > now)
    .reduce((sum, group) => sum + (group.release?.events.filter(event => event.actual === null).length ?? 0) + group.external.length, 0)
  assert.equal(container.querySelectorAll('.alert-release-countdown').length, expectedCountdowns, 'Every future pending reading, including same-time duplicates, keeps its countdown')
  assert.ok(batch.every(node => node.querySelector('.alert-release-countdown')), 'Same-time groups each retain readable countdowns')
  assert.equal(batch.flatMap(node => [...node.querySelectorAll('.alert-time-cell small:not(.alert-release-countdown)')]).length, 1, 'Currency appears once across release families and sources')
  const positions = batch.map(node => blocks().indexOf(node))
  assert.equal(positions.at(-1) - positions[0], batch.length - 1, 'Another currency cannot split the same-time USD block')
  assert.equal(container.querySelectorAll('.alert-time-start').length, 5, 'Other currencies, different seconds and both unknown hours stay separate')
  assert.equal(container.querySelectorAll('.alert-time-end').length, 5)
  const payroll = batch.find(node => node.textContent.includes('Payrolls'))
  await React.act(async () => payroll.querySelector('.alert-event-name').click())
  assert.ok(payroll.querySelector('.alert-event-details'), 'Each release keeps independently expandable details')
  for (const node of batch) await React.act(async () => node.querySelector('.event-alarm-toggle').click())
  assert.deepEqual(mutations.map(action => action.keys[0]), batch.map(node => node.dataset.alertId), 'Each bell still targets only its own durable publication key')
  assert.equal(mutations.length, 4)
  await renderTable(displayGroups([...simultaneous].reverse().map(event => ({ ...event, actual: .3 }))), at + 60000)
  assert.deepEqual(usdBatch().map(node => node.dataset.alertId), batch.map(node => node.dataset.alertId), 'Refresh, input order and publication do not change grouping')
  assert.ok(payroll.querySelector('.alert-event-details'), 'Publication refresh preserves expanded details')
  assert.equal(container.querySelectorAll('.alert-time-start').length, 5)
  await renderTable(initialGroups.filter(group => group.currency === 'USD' && group.key !== batch[0].dataset.alertId))
  assert.ok(usdBatch()[0].querySelector('.alert-time-cell time'), 'Filtering out the first package promotes the next visible time label')
  const { CalendarNowContext } = await server.ssrLoadModule('./src/inspector/calendar-clock.ts')
  const renderTimeline = (clock, date = '2026-10-05', timeline = scheduleGroups) => React.act(async () => root.render(React.createElement(CalendarNowContext.Provider, { value: clock },
    React.createElement(HighlightDock, { groups: timeline, sourceId: 'Pepperstone-Demo', alarms, now, date, focusKey: null,
      impact: { byValueId: new Map(), byKey: new Map() } }))))
  await renderTimeline(now - 1000)
  assert.equal(container.querySelector('.alert-now-line').nextElementSibling.dataset.alertId, 'scheduled-0')
  await renderTimeline(now)
  assert.equal(container.querySelector('.alert-now-line').previousElementSibling.dataset.alertId, 'scheduled-0', 'At publication the elapsed row moves above the current-time divider')
  assert.equal(container.querySelector('.alert-now-line').nextElementSibling.dataset.alertId, 'scheduled-1')
  await renderTimeline(now + 30000)
  assert.equal(container.querySelector('.alert-now-line').nextElementSibling.dataset.alertId, 'scheduled-1', 'Midpoints no longer move the line')
  await renderTimeline(now + 120000)
  assert.equal(container.querySelector('.alert-now-line').previousElementSibling.dataset.alertId, 'scheduled-1')
  assert.equal(container.querySelector('.alert-now-line').nextElementSibling.dataset.alertId, 'scheduled-2')
  const timeLine = container.querySelector('.alert-now-line')
  assert.equal(timeLine.textContent.trim(), timeLine.querySelector('time').textContent, 'The divider displays only the current clock')
  assert.ok(!timeLine.textContent.includes('nearest'))
  await renderTimeline(now + 180000)
  assert.equal(container.querySelector('.alert-now-line'), container.querySelector('table').lastElementChild, 'After the final event, the line follows the last row')
  await renderTimeline(now + 180000, '2026-10-05', [...scheduleGroups, { ...scheduleGroups[0], key: 'unknown', at: null }])
  assert.equal(container.querySelector('.alert-now-line').nextElementSibling.dataset.alertId, 'unknown', 'Unknown-time items stay below the chronological divider')
  await renderTimeline(now, '2026-10-04')
  assert.equal(container.querySelector('.alert-now-line'), null, 'Historical dates never display a current-time line')
  const { alertDateForRelease } = await server.ssrLoadModule('./src/alert/model/alert-focus.ts')
  assert.equal(alertDateForRelease({ ...groups[0].release, releaseAt: Date.UTC(2026, 9, 5, 19) }), '2026-10-06', 'Timed navigation uses Jakarta publication date')
  assert.equal(alertDateForRelease({ ...groups[0].release, releaseAt: null, timingUncertain: true,
    events: [{ ...events[0], server_time_seconds: Date.UTC(2026, 9, 5, 23) / 1000 }] }), '2026-10-05', 'Date-only navigation retains the source date without inventing an hour')
  const rigRows = [row('840100001', { name: 'Oil rigs', value_id: 'rig-oil' }), row('840100002', { name: 'Total rigs', value_id: 'rig-total' })]
  const rigGroups = dayGroups(rigRows, [], '2026-10-05', 'Pepperstone-Demo', defaultAlertPreferences())
  assert.equal(rigGroups.length, 1, 'Baker Hughes uses one explicit release package')
  assert.equal(rigGroups[0].release.events.length, 2)
  assert.deepEqual(dayGroups([...rigRows].reverse(), [], '2026-10-05', 'Pepperstone-Demo', defaultAlertPreferences()).map(group => group.key), rigGroups.map(group => group.key), 'Package identity is stable across input ordering')
  const filteredRigs = dayGroups(rigRows, [], '2026-10-05', 'Pepperstone-Demo', { ...defaultAlertPreferences(), families: [rigGroups[0].release.familyIds[0]] })
  assert.equal(filteredRigs[0].release.events.length, 1)
  assert.deepEqual(filteredRigs[0].valueIds, rigGroups[0].valueIds, 'Filtering preserves complete package bell membership')
  assert.equal(dayGroups([rigRows[0], { ...rigRows[1], release_at: at + 1000 }], [], '2026-10-05', 'Pepperstone-Demo', defaultAlertPreferences()).length, 2, 'Different exact publication times stay separate')
  assert.equal(dayGroups(rigRows.map(event => ({ ...event, time_mode: 1 })), [], '2026-10-05', 'Pepperstone-Demo', defaultAlertPreferences()).length, 2, 'Unconfirmed clocks never form a timed package')
  const pmiRows = [row('392500002', { name: 'Services', currency: 'JPY', country_code: 'JP' }), row('392500003', { name: 'Composite', currency: 'JPY', country_code: 'JP' })]
  assert.equal(dayGroups(pmiRows, [], '2026-10-05', 'Pepperstone-Demo', defaultAlertPreferences()).length, 1, 'Jibun services/composite share their same-time package')
  assert.equal(dayGroups([rigRows[0], { ...rigRows[1], period_seconds: rigRows[0].period_seconds - 86400 }], [], '2026-10-05', 'Pepperstone-Demo', defaultAlertPreferences()).length, 2, 'Different reference periods cannot merge')
  const packageActions = []
  const packageAlarms = { data: { schedule_schema: 2, settings: { enabled: true, release_minutes: 2 }, events: [
    { key: 'existing-oil-choice', source: 'calendar', broker: 'Pepperstone-Demo', value_ids: ['rig-oil'], at, eligible: true, selected: true },
  ] }, mutate: async action => { packageActions.push(action); return true } }
  await React.act(async () => root.render(React.createElement(HighlightDock, { groups: rigGroups, sourceId: 'Pepperstone-Demo',
    alarms: packageAlarms, now, focusKey: null, impact: { byValueId: new Map(), byKey: new Map() } })))
  assert.equal(container.querySelectorAll('.event-alarm-toggle').length, 1)
  assert.equal(container.querySelector('.event-alarm-toggle').getAttribute('aria-pressed'), 'mixed')
  await React.act(async () => container.querySelector('.event-alarm-toggle').click())
  assert.deepEqual(packageActions, [
    { action: 'toggle-many', keys: ['existing-oil-choice'], enabled: true },
    { action: 'subscribe', broker: 'Pepperstone-Demo', value_ids: ['rig-total'], title: rigGroups[0].title, enabled: true },
  ], 'The shared bell reuses the saved occurrence key and subscribes only missing components')
  assert.equal(container.querySelector('.alert-event-details'), null, 'Bell clicks do not open the package')
  await React.act(async () => container.querySelector('.alert-source-cell').click())
  assert.equal(container.querySelectorAll('.alert-event-details').length, 1)
  await renderTable([{ ...rigGroups[0], release: { ...rigGroups[0].release, events: [
    { ...rigRows[0], actual: 123 }, rigRows[1],
  ] } }])
  assert.equal(container.querySelector('.alert-release-countdown').closest('tr').dataset.seriesId, '840100002', 'A supplied actual is never replaced by the shared countdown')
  assert.equal(container.querySelectorAll('.alert-release-countdown').length, 1)
  await React.act(async () => root.unmount())
  const restored = createRoot(container)
  await React.act(async () => restored.render(React.createElement(HighlightDock, { groups: initialGroups, sourceId: 'Pepperstone-Demo',
    alarms, now, focusKey: null, impact: { byValueId: new Map(), byKey: new Map() } })))
  assert.equal(container.querySelectorAll('.alert-time-start').length, 5, 'Remounting restores grouping without a preference or saved migration')
  await React.act(async () => restored.unmount())
  console.log('✓ Alert date grouping, publication/unknown clocks, released readings, countdown formatting and legacy preferences')
} finally {
  await React.act(async () => root.unmount()); Date.now = originalNow
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of Object.entries(previous)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
}
