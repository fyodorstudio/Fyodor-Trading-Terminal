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
  const { alertEpisodes, alertCountdown, alertComingIn, alertSeriesIds, alertCalendarScope } = await server.ssrLoadModule('./src/alert/model/alert-episodes.ts')
  const { defaultInspectorPreferences, inspectorFamilies } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { alertPreferencesKey, defaultAlertPreferences, readAlertPreferences, validAlertPreferences } = await server.ssrLoadModule('./src/alert/model/alert-preferences.ts')
  const preferences = { ...defaultInspectorPreferences(), families: ['us-cpi'] }
  const day = 86400000, nextAt = now + 60_000
  const row = (id, at, value = null, extra = {}) => ({ value_id: `${id}-${at}`, event_id: id, name: id, currency: 'USD', country_code: 'US', country_name: 'United States',
    event_code: id, server_time_seconds: at / 1000 + 10800, chart_time_seconds: at / 1000 + 10800, release_at: at,
    period_seconds: at / 1000 - 30 * 86400, revision: 0, time_mode: 0, importance: 'high', impact: 'none', availability: 'observed',
    unit: 1, multiplier: 0, digits: 1, actual: value, previous: .1, forecast: null, revised_previous: null, ...extra })
  const cpi = inspectorFamilies.find((family) => family.id === 'us-cpi')
  const schedule = cpi.events.map((id) => row(id, nextAt))
  const noChartProfile = schedule.map(event => ({ ...event, chart_time_seconds: null, forecast: .4 }))
  assert.equal(alertEpisodes(noChartProfile, preferences, now)[0].state, 'upcoming', 'Known publication UTC supports Alert without a broker chart profile')
  assert.equal(alertEpisodes(noChartProfile, preferences, now)[0].release.events[0].forecast, .4, 'Grouping preserves the broker forecast')
  assert.equal(alertEpisodes(noChartProfile.map(event => ({ ...event, time_mode: 1 })), preferences, now)[0].state, 'unconfirmed', 'A missing chart profile never promotes date-only schedules to a timed release')
  const initial = [...schedule, row('840030016', nextAt), row(cpi.events[0], now + 61 * day),
    row(cpi.events[0], now - day, .2), row(cpi.events[0], now - day * 40),
    row(cpi.events[0], nextAt + day, null, { availability: 'not-returned-by-latest-query' })]
  assert.equal(alertEpisodes(initial, preferences, now).length, 1, 'One card per episode, exact applied family filters, no completed/withdrawn/out-of-window releases')
  assert.equal(alertEpisodes([row(cpi.events[0], now + 8 * day)], preferences, now).length, 0, 'Default horizon is seven days')
  for (const time_mode of [0, 1, 2, 3]) {
    for (const ago of [1, 7, 24, 30]) assert.equal(alertEpisodes([row(cpi.events[0], now - ago * day, null, { time_mode })], preferences, now).length, 0,
      `No outdated release with timing mode ${time_mode}, ${ago} days ago`)
  }
  assert.equal(alertEpisodes([row(cpi.events[0], now + 61 * day)], preferences, now, 90).length, 1, 'Longer horizons admit later schedules')
  assert.equal(alertEpisodes(schedule, preferences, nextAt)[0].state, 'awaiting')
  assert.equal(alertEpisodes(schedule.map((event, index) => index ? event : { ...event, actual: .3 }), preferences, nextAt)[0].state, 'partial')
  assert.equal(alertEpisodes(schedule.map((event) => ({ ...event, actual: .3 })), preferences, nextAt).length, 0)
  assert.equal(alertEpisodes([row(cpi.events[0], nextAt, null, { time_mode: 1 })], preferences, now)[0].state, 'unconfirmed')
  assert.equal(alertEpisodes([row(cpi.events[0], now - day, .3, { time_mode: 1 })], preferences, now).length, 0,
    'Completed date-only releases leave Alert even if their exact clock remains unconfirmed')
  assert.equal(alertEpisodes([row(cpi.events[0], now - day, .3, { release_at: null })], preferences, now).length, 0,
    'Actual arrival resolves a numeric alert even when UTC timing is unavailable')
  assert.equal(alertCountdown(now + 50 * day + 23 * 3600000 + 20 * 60000, now), '50 days · 23 hours · 20 minutes remaining')
  assert.equal(alertCountdown(now - 1, now), '0 minutes remaining')
  assert.equal(alertCountdown(now + 149 * 60000, now), '2 hours · 29 minutes remaining')
  assert.equal(alertCountdown(now + 29 * 60000, now), '29 minutes remaining')
  assert.equal(alertComingIn(now + 1584000, now), 'Coming in 26:24')
  assert.equal(alertComingIn(now + 149 * 60000, now), 'Coming in 2h 29m')
  assert.equal(alertComingIn(now + 2 * day, now), 'Coming in 2d')
  const policyPreferences = { ...preferences, families: ['fomc', 'fed-chair'] }
  const policy = [row('840050014', nextAt), row('840050018', nextAt + 30 * 60000, null, { previous: null }),
    row('840050005', nextAt + 45 * 60000, null, { previous: null })]
  const policyCards = alertEpisodes(policy, policyPreferences, now)
  assert.equal(policyCards.length, 2, 'Known FOMC companion attaches to rate decision; generic Chair speech stays independent')
  assert.equal(policyCards[0].release.events.length, 2)
  assert.equal(policyCards[0].release.releaseAt, nextAt)
  assert.equal(alertEpisodes(policy.map(event => ({ ...event, chart_time_seconds: null })), policyPreferences, now)[0].release.events.length, 2,
    'Policy stages retain their package without a chart profile')
  assert.equal(alertEpisodes([policy[2]], policyPreferences, nextAt + 45 * 60000).length, 0, 'No numerical wait for completed speeches')

  localStorage.removeItem(alertPreferencesKey)
  assert.equal(readAlertPreferences().days, 7)
  assert.equal(validAlertPreferences({ ...defaultAlertPreferences(), days: 7 }), true)
  const all = defaultAlertPreferences()
  assert.equal(alertSeriesIds(all).length, 1051)
  assert.deepEqual(alertCalendarScope(all).currencies.slice().sort(), ['AUD','CAD','CHF','EUR','GBP','JPY','NZD','USD'])
  console.log('✓ Alert grouping: publication clocks, all-currency catalog, exact families, policy stages, date-only and component readings')
} finally {
  await React.act(async () => root.unmount()); Date.now = originalNow
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of Object.entries(previous)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
}
