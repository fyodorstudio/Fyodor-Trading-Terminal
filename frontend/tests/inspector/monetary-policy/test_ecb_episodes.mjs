import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'),
  server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const globals = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT', 'fetch']
const previous = Object.fromEntries(globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of globals.slice(0, 7)) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.appendChild(container)
const root = createRoot(container)
const at = Date.UTC(2026, 9, 1, 12, 15), chartAt = at / 1000 + 10800
const clockOffsetMs = at - Date.now(), utc = { mode: 'utc', utcOffsetMinutes: 0 }
const rates = ['999010007', '999010006', '999010015']
const names = { '999010007': 'ECB Interest Rate Decision', '999010006': 'ECB Deposit Facility Rate Decision',
  '999010015': 'ECB Marginal Lending Facility Rate Decision', '999010024': 'ECB Monetary Policy Statement',
  '999010003': 'ECB Monetary Policy Press Conference', '999010029': 'ECB President Lagarde Speech' }
const event = (id, offset = 0, overrides = {}) => ({ value_id: `${id}-${offset}`, event_id: id,
  currency: 'EUR', country_code: 'EU', country_name: 'European Union', name: names[id] ?? id, event_code: id,
  server_time_seconds: chartAt + offset, chart_time_seconds: chartAt + offset, release_at: at + offset * 1000,
  period_seconds: 0, revision: 0, time_mode: 0, importance: 'high', impact: 'none',
  unit: rates.includes(id) ? 1 : 0, multiplier: 0, digits: 2,
  actual: rates.includes(id) ? 3 : null, previous: rates.includes(id) ? 2.75 : null,
  forecast: rates.includes(id) ? 3.25 : null, revised_previous: rates.includes(id) ? -999 : null, ...overrides })
const decisions = rates.map((id) => event(id)), statement = event('999010024'), conference = event('999010003', 2700)
const input = [conference, decisions[2], statement, decisions[1], decisions[0]]
const bars = [chartAt, chartAt + 3600].map((time) => ({ time, open: 1, high: 2, low: .5, close: 1.5 }))

try {
  const data = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { gradePolicyRateDecision } = await server.ssrLoadModule('./src/inspector/grading/policy-rate-grading.ts')
  const { useInspector } = await server.ssrLoadModule('./src/inspector/useInspector.ts')
  const { InspectorPanel } = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  const { alertEpisodes } = await server.ssrLoadModule('./src/alert/model/alert-episodes.ts')
  const preferences = data.defaultInspectorPreferences()
  const grouped = data.groupInspectorReleases(input), episode = grouped[0]
  const anchorId = data.groupInspectorReleases([decisions[0]])[0].id
  assert.equal(grouped.length, 1)
  assert.equal(episode.id, anchorId, 'Arrival of other rates and commentary preserves the decision identity')
  assert.equal(episode.label, 'ECB rate decision')
  assert.equal(episode.releaseAt, at); assert.equal(episode.chartTime, chartAt); assert.equal(episode.serverTime, chartAt)
  assert.deepEqual(episode.events.map((row) => row.event_id), [...rates, '999010024', '999010003'])
  assert.equal(episode.events.at(-1).release_at, at + 2700000)
  assert.deepEqual(input, [conference, decisions[2], statement, decisions[1], decisions[0]])
  assert.equal(data.buildInspectorMarkers(grouped, preferences, bars, 'H1')[0].time, chartAt)
  assert.equal(data.groupInspectorReleases([...input, decisions[0]]).length, 1, 'Duplicate source values remain deduplicated')
  for (const seconds of [0, 1800, 2700, 3600]) assert.equal(
    data.groupInspectorReleases([decisions[0], event('999010003', seconds)]).length, 1)
  for (const companion of [event('999010003', -1), event('999010003', 3600.001),
    event('999010003', 2700, { time_mode: 1 }), event('999010003', 2700, { release_at: null }),
    event('999010003', 2700, { chart_time_seconds: null }), event('999010029', 2700), event('999010004', 2700)]) {
    assert.equal(data.groupInspectorReleases([decisions[0], companion]).length, 2,
      'Only verified meeting companions in the anchored one-hour window attach')
  }
  for (const id of rates) assert.equal(data.groupInspectorReleases([event(id), statement, conference]).length, 1,
    'A partial numeric inventory can anchor on any of the three simultaneous ECB rate rows')
  assert.equal(data.groupInspectorReleases([statement, conference]).length, 2, 'No rate decision means no inferred episode')
  assert.equal(data.groupInspectorReleases([decisions[0], event('999010024', 3500), event('999010003', 5400)]).length, 2,
    'Companions never extend the window through chained proximity')
  assert.equal(data.groupInspectorReleases([decisions[0], event('999010007', 1200), conference]).length, 3,
    'Multiple eligible decision instants leave the companion unassigned')
  assert.equal(data.groupInspectorReleases([event('999010007', 0, { time_mode: 1 }), conference]).length, 2)
  assert.equal(data.groupInspectorReleases([event('999010007', 0, { chart_time_seconds: null }), conference]).length, 2)
  assert.equal(data.groupInspectorReleases([decisions[0], event('999010003', 2700, { country_code: 'US' })]).length, 1,
    'Foreign calendar identity is excluded rather than absorbed')
  const fed = { ...event('840050014'), currency: 'USD', country_code: 'US' }
  assert.equal(data.groupInspectorReleases([fed, conference]).length, 2, 'A Fed decision never anchors ECB commentary')
  const midnightShift = Date.UTC(2026, 9, 1, 23, 45) - at
  const midnight = data.groupInspectorReleases([decisions[0], conference].map((row) => ({ ...row,
    release_at: row.release_at + midnightShift, chart_time_seconds: row.chart_time_seconds + midnightShift / 1000,
    server_time_seconds: row.server_time_seconds + midnightShift / 1000 })))
  assert.equal(midnight.length, 1)
  assert.equal(data.filterInspectorReleases(midnight, preferences, { from: Date.UTC(2026, 9, 1), to: Date.UTC(2026, 9, 2) }).length, 1)
  assert.equal(data.filterInspectorReleases(midnight, preferences, { from: Date.UTC(2026, 9, 2), to: Date.UTC(2026, 9, 3) }).length, 0)
  for (const id of rates) for (const [actual, expected] of [[3, 'higher'], [2.5, 'lower'], [2.75, 'unchanged'], [null, 'missing']]) {
    assert.equal(gradePolicyRateDecision(event(id, 0, { actual }), 'ecb').grade, expected)
    assert.equal(data.formatInspectorValue(data.inspectorDelta(event(id, 0, { actual })), event(id), true),
      actual === null ? '—' : actual === 3 ? '+25 bp' : actual === 2.5 ? '-25 bp' : '0 bp')
  }
  assert.equal(gradePolicyRateDecision(statement, 'ecb'), null)
  assert.equal(gradePolicyRateDecision(decisions[0], 'fomc'), null)
  assert.equal(gradePolicyRateDecision(event(rates[0], 0, { currency: 'USD' }), 'ecb'), null)
  for (const id of rates) {
    assert.equal(gradePolicyRateDecision(event(id), 'ecb', 'forecast').grade, 'lower')
    assert.equal(gradePolicyRateDecision(event(id, 0, { forecast: null }), 'ecb', 'forecast').grade, 'missing')
  }
  assert.equal(gradePolicyRateDecision(statement, 'ecb', 'forecast'), null)
  const scheduled = input.map((row) => ({ ...row, actual: null, availability: 'observed' }))
  const cards = alertEpisodes(scheduled, { ...preferences, families: ['ecb'] }, at - 60000)
  assert.equal(cards.length, 1); assert.equal(cards[0].release.id, anchorId); assert.equal(cards[0].release.events.length, 5)
  assert.equal(alertEpisodes(input.map((row) => ({ ...row, availability: 'observed' })), preferences, at + 3600000).length, 0,
    'Completed rate rows resolve Alert without waiting for numeric speech values')
  console.log('✓ ECB three-rate anchoring, 30/45/60-minute companions, no chaining, ambiguity, foreign/missing clocks, midnight and shared Alert behavior')

  let view
  globalThis.fetch = () => { throw new Error('ECB grouping must not request magnitude history') }
  function App({ rows = [decisions[0]], timeDisplay = utc }) {
    const inspector = useInspector({ events: rows, symbol: 'EURUSD', bars, timeframe: 'H1', timeDisplay, clockOffsetMs })
    React.useEffect(() => { view = inspector }, [inspector])
    return React.createElement(InspectorPanel, { view: { ...inspector, brokerTime: true }, symbol: 'EURUSD', source: null, error: null, timeDisplay })
  }
  const render = (props = {}) => React.act(async () => root.render(React.createElement(App, props)))
  await render()
  await React.act(async () => container.querySelector('.inspector-release').click())
  await render({ rows: input })
  assert.equal(view.selectedRelease.id, anchorId)
  assert.equal(container.querySelectorAll('.inspector-release').length, 1); assert.equal(view.markers.length, 1)
  assert.deepEqual([...container.querySelectorAll('.inspector-table-scroll thead th')].map((cell) => cell.textContent),
    ['Series', 'Release time', 'Actual', 'Previous', 'Forecast', 'A−P', 'A−F (Surprise)', 'A−P magnitude · History'])
  const rendered = [...container.querySelectorAll('.inspector-table-scroll tbody tr')]
  assert.equal(rendered.length, 5)
  assert.match(rendered[0].querySelector('[data-reading-clock="display"]').textContent, /12:15/)
  assert.match(rendered[4].querySelector('[data-reading-clock="display"]').textContent, /13:00/)
  assert.match(rendered[4].querySelector('[data-reading-clock="broker"]').textContent, /16:00/)
  assert.equal(container.querySelectorAll('td:nth-child(6).inspector-grade-higher').length, 3)
  for (const row of rendered.slice(0, 3)) {
    assert.equal(row.children[4].textContent, '3.25%')
    assert.equal(row.children[6].textContent, '-25 bp')
    assert.ok(row.children[6].classList.contains('inspector-grade-lower'))
  }
  assert.equal(rendered[3].lastElementChild.textContent, 'Not applicable')
  assert.equal(rendered[4].lastElementChild.textContent, 'Not applicable')
  assert.equal(container.querySelector('.inspector-row-grade').textContent, 'Higher', 'Rate signs receive descriptive labels; Undefined does not invent magnitude')
  for (const [actual, expected] of [[2.5, 'lower'], [2.75, 'unchanged'], [null, 'missing']]) {
    await render({ rows: input.map((row) => rates.includes(row.event_id) ? { ...row, actual } : row) })
    assert.equal(container.querySelectorAll(`td:nth-child(6).inspector-grade-${expected}`).length, 3)
  }
  for (const [forecast, expected, tone] of [[2.75, '+25 bp', 'higher'], [3.25, '-25 bp', 'lower'],
    [3, '0 bp', 'unchanged'], [null, '—', 'missing']]) {
    await render({ rows: input.map((row) => rates.includes(row.event_id) ? { ...row, actual: 3, forecast } : row) })
    for (const row of [...container.querySelectorAll('.inspector-table-scroll tbody tr')].slice(0, 3)) {
      assert.equal(row.children[6].textContent, expected)
      assert.ok(row.children[6].classList.contains(`inspector-grade-${tone}`))
      assert.equal(row.children[5].childNodes[0].textContent, '+25 bp')
    }
  }
  await render({ rows: input, timeDisplay: { mode: 'fixed-offset', utcOffsetMinutes: 420 } })
  assert.equal(view.selectedRelease.id, anchorId); assert.equal(view.markers[0].time, chartAt)
  assert.match(container.querySelectorAll('[data-reading-clock="display"]')[4].textContent, /20:00/)
  assert.match(container.querySelectorAll('[data-reading-clock="broker"]')[4].textContent, /16:00/)
  await React.act(async () => view.applyPreferences({ ...preferences, families: ['ecb-president'] }))
  assert.equal(container.querySelectorAll('.inspector-release').length, 0)
  await render({ rows: [...input, event('999010029', 2700)] })
  assert.equal(container.querySelectorAll('.inspector-release').length, 1, 'Generic President speech retains its own filter')
  console.log('✓ Mounted ECB stable selection, per-row display/broker times, rate colors, timezone and President filter isolation')
} finally {
  await React.act(async () => root.unmount())
  await server.close(); await dom.happyDOM.abort(); dom.close()
  for (const key of globals) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key] }
}
