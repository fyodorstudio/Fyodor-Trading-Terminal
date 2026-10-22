import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ root, server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const globals = ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'localStorage', 'fetch', 'IS_REACT_ACT_ENVIRONMENT']
const previous = new Map(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of globals) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
try {
  const clock = await server.ssrLoadModule('./src/appearance/time-display/chart-clock.ts')
  const display = await server.ssrLoadModule('./src/appearance/time-display/time-display-preference.ts')
  const input = await server.ssrLoadModule('./src/appearance/time-display/display-clock-input.ts')
  const { groupInspectorReleases } = await server.ssrLoadModule('./src/inspector/releases/group-releases.ts')
  const { groupInspectorDays } = await server.ssrLoadModule('./src/inspector/releases/group-days.ts')
  const { releaseTimeLabel } = await server.ssrLoadModule('./src/inspector/releases/release-time-label.ts')
  const { InspectorDayTable } = await server.ssrLoadModule('./src/inspector/readings/InspectorDayTable.tsx')
  const { InspectorReadingTime } = await server.ssrLoadModule('./src/inspector/InspectorReadingTime.tsx')
  const { buildInspectorMarkers } = await server.ssrLoadModule('./src/inspector/chart/build-markers.ts')
  const { defaultInspectorPreferences } = await server.ssrLoadModule('./src/inspector/preferences/inspector-preferences.ts')
  const { inspectorFamilyForEvent } = await server.ssrLoadModule('./src/inspector/catalog/inspector-families.ts')
  const pepper = { brokerId: 'Pepperstone-Demo', brokerOffsetSeconds: 10800 }
  const elev8 = { brokerId: 'Elev8-Demo2', brokerOffsetSeconds: 10800 }
  const unknown = { brokerId: 'Unverified-Broker', brokerOffsetSeconds: 10800 }
  const jakarta = display.defaultTimeDisplayPreference
  assert.deepEqual(jakarta, { mode: 'fixed-offset', utcOffsetMinutes: 420, hour12: true })
  assert.deepEqual(display.readTimeDisplayPreference(), jakarta)
  dom.localStorage.setItem('fyodor.time-display.v1', JSON.stringify({ mode: 'local', utcOffsetMinutes: 0 }))
  assert.deepEqual(display.readTimeDisplayPreference(), jakarta, 'Legacy workstation default becomes explicit Jakarta')
  dom.localStorage.setItem('fyodor.time-display.v1', JSON.stringify({ mode: 'fixed-offset', utcOffsetMinutes: 420 }))
  assert.deepEqual(display.readTimeDisplayPreference(), jakarta, 'Existing Jakarta offset gains the default AM/PM format')
  const custom = { mode: 'utc', utcOffsetMinutes: 0, hour12: false }
  display.saveTimeDisplayPreference(custom)
  assert.deepEqual(display.readTimeDisplayPreference(), custom, 'Explicit alternate display choices survive reload')
  display.saveTimeDisplayPreference({ mode: 'local', utcOffsetMinutes: 0 })
  assert.equal(display.readTimeDisplayPreference().mode, 'local', 'New explicit local choice is retained')
  assert.match(display.timeDisplayLabel(jakarta), /Jakarta/)
  const samples = []
  for (let year = 2014; year <= 2031; year++) {
    for (const month of [0, 2, 6, 9, 10]) for (const day of [1, 8, 11, 25, 29]) {
      const utc = Date.UTC(year, month, day, 12)
      for (const scope of [pepper, elev8]) {
        const chart = clock.utcToChartClock(utc, scope)
        assert.equal(clock.chartClockToUtc(chart, scope), utc)
        samples.push([scope.brokerId, utc / 1000, (chart - utc) / 1000])
      }
    }
  }
  const actual = JSON.parse(execFileSync(path.resolve(root, '../bridge/.venv/Scripts/python.exe'), ['-c',
    'import json,sys;from storage.calendar_clock import broker_offset;print(json.dumps([broker_offset(s,t) for s,t,_ in json.load(sys.stdin)]))'],
    { cwd: path.resolve(root, '..'), input: JSON.stringify(samples), encoding: 'utf8' }))
  assert.deepEqual(actual, samples.map(row => row[2]), 'Frontend and storage agree across the entire supported historical range')
  for (const text of ['2026-03-11T12:30:00Z', '2026-10-28T12:30:00Z']) {
    assert.equal(clock.chartOffsetAt(Date.parse(text), pepper), 10800000)
    assert.equal(clock.chartOffsetAt(Date.parse(text), elev8), 7200000, 'US/European mismatch weeks keep separate broker rules')
  }
  for (const [text, before, after] of [['2026-03-08T07:00:00Z', 7200000, 10800000], ['2026-11-01T06:00:00Z', 10800000, 7200000]]) {
    const at = Date.parse(text)
    assert.equal(clock.chartOffsetAt(at - 1, pepper), before)
    assert.equal(clock.chartOffsetAt(at, pepper), after)
    assert.equal(clock.chartClockToUtc(at + Math.min(before, after) + 1800000, pepper), null, 'Skipped/duplicated broker hour is never guessed')
  }
  assert.equal(clock.utcToChartClock(Date.now(), unknown), null)
  assert.equal(clock.chartClockToUtc(Date.now(), unknown), null)
  assert.equal(clock.utcToChartClock(Date.UTC(2032, 0, 1), pepper), null)
  const at = Date.parse('2026-10-22T23:30:00Z')
  const event = { value_id: 'japan-cpi', event_id: '392030001', currency: 'JPY', country_code: 'JP', country_name: 'Japan',
    name: 'Broker-specific renamed CPI', event_code: 'cpi', server_time_seconds: at / 1000 + 10800, release_at: at,
    chart_time_seconds: at / 1000 + 10800, chart_clock_profile: 'pepperstone-ny-close-v1', time_mode: 0,
    period_seconds: Date.UTC(2026, 8, 1) / 1000, revision: 0, importance: 'high', impact: 'none',
    unit: 1, multiplier: 0, digits: 1, actual: .3, previous: .2, forecast: .3, revised_previous: null }
  assert.ok(inspectorFamilyForEvent(event), 'Renamed source series retain ID-based filter membership')
  const families = [inspectorFamilyForEvent(event).id]
  const preferences = { ...defaultInspectorPreferences('USDJPY'), families }
  const range = { from: Date.parse('2026-10-22T17:00:00Z'), to: Date.parse('2026-10-23T17:00:00Z') }
  const bar = { time: Math.floor(event.chart_time_seconds / 3600) * 3600 }
  const releases = groupInspectorReleases([event])
  assert.equal(buildInspectorMarkers(releases, preferences, [bar], 'H1').length, 1)
  assert.match(releaseTimeLabel(releases[0], jakarta), /06:30\s*AM/i)
  assert.match(display.formatChartCrosshairTime(event.chart_time_seconds, jakarta, pepper), /06:30\s*AM/i)
  assert.equal(input.displayClockInput(at, jakarta), '2026-10-23T06:30')
  assert.equal(input.parseDisplayClockInput('2026-10-23T06:30', jakarta), at)
  const unplaced = { ...event, chart_time_seconds: null, chart_clock_profile: null }
  const unknownReleases = groupInspectorReleases([unplaced])
  assert.equal(unknownReleases[0].timingUncertain, false)
  assert.match(releaseTimeLabel(unknownReleases[0], jakarta), /06:30\s*AM/i)
  assert.equal(buildInspectorMarkers(unknownReleases, preferences, [bar], 'H1').length, 0)
  const days = groupInspectorDays(unknownReleases, families, range, jakarta, unknown)
  assert.equal(days[0].daily.date, '2026-10-23')
  assert.equal(days[0].chartTime, null)
  assert.match(renderToStaticMarkup(React.createElement(InspectorDayTable, { release: days[0], timeDisplay: jakarta })), /06:30\s*AM/i)
  const tentative = { ...unplaced, time_mode: 3 }
  assert.match(renderToStaticMarkup(React.createElement(InspectorReadingTime, { event: tentative, timeDisplay: jakarta })), /06:30\s*AM/i)
  const dateOnly = groupInspectorReleases([{ ...unplaced, time_mode: 1, release_at: null }])[0]
  assert.match(releaseTimeLabel(dateOnly, jakarta), /Date only/)
  assert.equal(dateOnly.chartTime, null)
  assert.equal(releaseTimeLabel(groupInspectorReleases([{ ...unplaced, release_at: null }])[0], jakarta), 'Time unavailable',
    'A missing UTC conversion must not relabel an exact source schedule as date-only')
  // Exercise the production storage hook too: an unverified broker still
  // fetches/list-filters its known UTC readings without projecting an icon.
  const { useInspector } = await server.ssrLoadModule('./src/inspector/useInspector.ts')
  const { createRoot } = await import('react-dom/client')
  const host = dom.document.createElement('div'), requests = []
  dom.document.body.append(host)
  const mounted = createRoot(host)
  let view
  globalThis.fetch = async url => {
    const endpoint = new URL(url, 'http://localhost')
    requests.push(endpoint)
    return { ok: true, json: async () => endpoint.pathname.endsWith('/health') ?
      { revision: 1, sources: [{ id: unknown.brokerId, publisher_status: 'live', instance_id: 'fixture' }], collector_error: null } :
      { source_id: unknown.brokerId, revision: 1, timestamp_convention: 'trade_server_time', time_basis: 'chart',
        events: [{ ...unplaced, availability: 'observed' }], coverage: {}, next_cursor: null } }
  }
  const clockOffsetMs = at - Date.now()
  function Harness() {
    const inspector = useInspector({ symbol: 'USDJPY', bars: [bar], timeframe: 'H1', timeDisplay: jakarta,
      clockOffsetMs, ...unknown })
    React.useEffect(() => { view = inspector }, [inspector])
    return null
  }
  try {
    await React.act(async () => mounted.render(React.createElement(Harness)))
    await React.act(async () => view.selectCustomRange('2026-10-23', '2026-10-23'))
    assert.equal(view.storage.error, null)
    assert.equal(view.releases.length, 1)
    assert.match(releaseTimeLabel(view.releases[0], jakarta), /06:30\s*AM/i)
    assert.equal(view.markers.length, 0)
    const query = requests.filter(url => url.pathname.endsWith('/calendar')).at(-1).searchParams
    assert.ok(Number(query.get('from_server_seconds')) < range.from / 1000)
    assert.ok(Number(query.get('to_server_seconds')) > range.to / 1000)
  } finally { await React.act(async () => mounted.unmount()); host.remove() }
  console.log('✓ Shared broker clocks 2014–2031, US/EU DST edges, Jakarta display/input, unknown-broker safety, renamed filters and real Inspector tables/markers')
} finally {
  await server.close(); dom.happyDOM.abort()
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
