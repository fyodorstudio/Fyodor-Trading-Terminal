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
  assert.equal(batch.flatMap(node => [...node.querySelectorAll('.alert-time-cell time')]).length, 1, 'Time and currency appear once across release families and sources')
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
