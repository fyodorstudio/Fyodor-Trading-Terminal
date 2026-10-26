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
  console.log('✓ Alert date grouping, publication/unknown clocks, released readings, countdown formatting and legacy preferences')
} finally {
  await React.act(async () => root.unmount()); Date.now = originalNow
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of Object.entries(previous)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
}
