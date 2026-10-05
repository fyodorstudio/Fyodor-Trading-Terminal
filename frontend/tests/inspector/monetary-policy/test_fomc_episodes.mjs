import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const server = await createServer({ root: rootDir, server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const globals = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT', 'fetch']
const previous = Object.fromEntries(globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of globals.slice(0, 7)) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.appendChild(container)
const root = createRoot(container)
const at = Date.UTC(2026, 9, 1, 18)
const clockOffsetMs = at - Date.now()
const chartAt = at / 1000 + 10800
const utc = { mode: 'utc', utcOffsetMinutes: 0 }
const event = (id, offset = 0, overrides = {}) => ({
  value_id: `${id}-${offset}`, event_id: id, currency: 'USD', country_code: 'US', country_name: 'United States',
  name: ({ '840050014': 'Fed Interest Rate Decision', '840050002': 'FOMC Statement', '840050003': 'FOMC Economic Projections',
    '840050018': 'FOMC Press Conference', '840050022': 'Fed Chair Powell Speech' })[id] ?? id,
  event_code: id, server_time_seconds: chartAt + offset, chart_time_seconds: chartAt + offset,
  release_at: at + offset * 1000, period_seconds: 0, revision: 0, time_mode: 0, importance: 'high', impact: 'none',
  unit: id === '840050014' ? 1 : 0, multiplier: 0, digits: 2,
  actual: id === '840050014' ? 5 : null, previous: id === '840050014' ? 4.75 : null,
  forecast: id === '840050014' ? 5.25 : null, revised_previous: -999, ...overrides,
})
const decision = event('840050014')
const statement = event('840050002')
const projections = event('840050003')
const conference = event('840050018', 1800)
const bars = [chartAt, chartAt + 3600].map((time) => ({ time, open: 1, high: 2, low: .5, close: 1.5 }))

try {
  const data = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { gradePolicyRateDecision } = await server.ssrLoadModule('./src/inspector/grading/policy-rate-grading.ts')
  const { useInspector } = await server.ssrLoadModule('./src/inspector/useInspector.ts')
  const { InspectorPanel } = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  const preferences = data.defaultInspectorPreferences()
  const input = [conference, projections, statement, decision]
  const episode = data.groupInspectorReleases(input)[0]
  const anchorId = data.groupInspectorReleases([decision])[0].id
  assert.equal(data.groupInspectorReleases(input).length, 1)
  assert.equal(episode.id, anchorId, 'Companions never change the decision selection identity')
  assert.equal(episode.releaseAt, at); assert.equal(episode.chartTime, chartAt); assert.equal(episode.serverTime, chartAt)
  assert.equal(episode.label, 'Fed rate decision')
  assert.deepEqual(episode.events.map((row) => row.event_id), ['840050014', '840050002', '840050003', '840050018'])
  assert.deepEqual(input, [conference, projections, statement, decision], 'Source objects and input order stay intact')
  assert.equal(episode.events[3].release_at, at + 1800000)
  assert.equal(data.buildInspectorMarkers([episode], preferences, bars, 'H1')[0].time, chartAt)
  assert.equal(data.groupInspectorReleases([event('840050018', 3600), decision]).length, 1, 'The one-hour boundary is inclusive')
  for (const companion of [event('840050018', -1), event('840050018', 3600.001), event('840050018', 1800, { time_mode: 1 }),
    event('840050018', 1800, { release_at: null }), event('840050018', 1800, { chart_time_seconds: null }),
    event('840050022', 1800), event('840050021', 1800)]) {
    assert.equal(data.groupInspectorReleases([decision, companion]).length, 2, 'Only verified FOMC companions within the anchored window attach')
  }
  assert.equal(data.groupInspectorReleases([conference, projections, statement]).length, 3, 'No decision means no inferred episode')
  assert.equal(data.groupInspectorReleases([decision, event('840050002', 3500), event('840050018', 5400)]).length, 2,
    'A later companion cannot extend the episode through chained proximity')
  assert.equal(data.groupInspectorReleases([decision, event('840050014', 1200), conference]).length, 3,
    'Two eligible decisions leave the companion unassigned')
  assert.equal(data.groupInspectorReleases([event('840050014', 0, { time_mode: 1 }), conference]).length, 2)
  assert.equal(data.groupInspectorReleases([...input, decision]).length, 1, 'Duplicate source values remain deduplicated')
  const midnightShift = Date.UTC(2026, 9, 1, 23, 45) - at
  const midnightRows = [decision, conference].map((row) => ({ ...row, release_at: row.release_at + midnightShift,
    chart_time_seconds: row.chart_time_seconds + midnightShift / 1000, server_time_seconds: row.server_time_seconds + midnightShift / 1000 }))
  const midnightEpisode = data.groupInspectorReleases(midnightRows)
  assert.equal(midnightEpisode.length, 1, 'UTC calendar-date boundaries never split a known episode')
  assert.equal(data.filterInspectorReleases(midnightEpisode, preferences, { from: Date.UTC(2026, 9, 1), to: Date.UTC(2026, 9, 2) }).length, 1)
  assert.equal(data.filterInspectorReleases(midnightEpisode, preferences, { from: Date.UTC(2026, 9, 2), to: Date.UTC(2026, 9, 3) }).length, 0,
    'Date filtering stays anchored to the decision')
  for (const [actual, expected] of [[5, 'higher'], [4.5, 'lower'], [4.75, 'unchanged'], [null, 'missing']]) {
    assert.equal(gradePolicyRateDecision({ ...decision, actual }, 'fomc').grade, expected)
  }
  assert.equal(gradePolicyRateDecision(statement, 'fomc'), null)
  assert.equal(gradePolicyRateDecision(decision, 'fed-chair'), null)
  assert.equal(gradePolicyRateDecision({ ...decision, currency: 'EUR' }, 'fomc'), null)
  assert.equal(gradePolicyRateDecision({ ...decision, actual_raw_scaled_1e6: '4750000', previous_raw_scaled_1e6: '5000000' }, 'fomc').grade, 'lower',
    'Source precision and supplied Previous determine the sign')
  console.log('✓ Anchored FOMC identity, stable marker, exact one-hour bounds, no chaining, ambiguous/missing/uncertain anchors, cross-midnight filtering and rate sign colors')

  let view
  globalThis.fetch = () => { throw new Error('Live FOMC rendering must not fetch magnitude history') }
  function App({ rows = [decision], timeDisplay = utc }) {
    const inspector = useInspector({ events: rows, symbol: 'EURUSD', bars, timeframe: 'H1', timeDisplay, clockOffsetMs })
    React.useEffect(() => { view = inspector }, [inspector])
    return React.createElement(InspectorPanel, { view: { ...inspector, brokerTime: true }, symbol: 'EURUSD', source: null, error: null, timeDisplay })
  }
  const render = (props = {}) => React.act(async () => root.render(React.createElement(App, props)))
  await render()
  await React.act(async () => container.querySelector('.inspector-release').click())
  assert.equal(view.selectedRelease.id, anchorId)
  await render({ rows: input })
  assert.equal(view.selectedRelease.id, anchorId, 'Arrival of companions preserves the selected decision')
  assert.equal(container.querySelectorAll('.inspector-release').length, 1)
  assert.deepEqual([...container.querySelectorAll('.inspector-table-scroll thead th')].map((cell) => cell.textContent),
    ['Series', 'Release time', 'Actual', 'Previous', 'Forecast', 'A−P', 'A−F (Surprise)', 'A−P magnitude · History'])
  const rows = [...container.querySelectorAll('.inspector-table-scroll tbody tr')]
  assert.match(rows[0].querySelector('[data-reading-clock="display"]').textContent, /18:00/)
  assert.match(rows[3].querySelector('[data-reading-clock="display"]').textContent, /18:30/)
  assert.match(rows[0].querySelector('[data-reading-clock="broker"]').textContent, /21:00/)
  assert.match(rows[3].querySelector('[data-reading-clock="broker"]').textContent, /21:30/)
  assert.equal(rows[0].querySelector('td.inspector-grade-higher').childNodes[0].textContent, '+25 bp')
  assert.equal(rows[0].children[4].textContent, '5.25%')
  assert.equal(rows[0].children[6].textContent, '-25 bp')
  assert.ok(rows[0].children[6].classList.contains('inspector-grade-lower'), 'Surprise has its own sign, independent of A−P')
  assert.equal(rows[3].children[4].textContent, '—')
  assert.equal(rows[3].lastElementChild.textContent, 'Not applicable')
  assert.equal(container.querySelector('.inspector-row-grade').textContent, 'Higher', 'Rate signs receive descriptive labels; Undefined does not invent magnitude')
  assert.equal(view.markers.length, 1)
  for (const [actual, expected] of [[4.5, 'lower'], [4.75, 'unchanged'], [null, 'missing']]) {
    await render({ rows: input.map((row) => row.event_id === '840050014' ? { ...row, actual } : row) })
    assert.ok(container.querySelector(`.inspector-table-scroll td.inspector-grade-${expected}`))
    if (actual === 4.5) assert.equal(container.querySelector('td.inspector-grade-lower').childNodes[0].textContent, '-25 bp')
  }
  for (const [forecast, actual, expected, tone] of [[4.75, 5, '+25 bp', 'higher'], [5.25, 5, '-25 bp', 'lower'],
    [5, 5, '0 bp', 'unchanged'], [null, 5, '—', 'missing'], [5, null, '—', 'missing']]) {
    await render({ rows: input.map((row) => row.event_id === '840050014' ? { ...row, actual, forecast } : row) })
    const cells = container.querySelector('.inspector-table-scroll tbody tr').children
    assert.equal(cells[6].textContent, expected)
    assert.ok(cells[6].classList.contains(`inspector-grade-${tone}`))
    assert.equal(cells[5].childNodes[0].textContent, actual === null ? '—' : '+25 bp', 'Forecast changes never alter A−P')
  }
  await render({ rows: input.map((row) => row.event_id === '840050014' ? { ...row, previous: null } : row) })
  assert.equal(container.querySelector('.inspector-table-scroll tbody tr').children[5].childNodes[0].textContent, '—')
  assert.equal(container.querySelector('.inspector-table-scroll tbody tr').children[6].textContent, '-25 bp', 'Surprise does not require Previous')
  await render({ rows: input, timeDisplay: { mode: 'fixed-offset', utcOffsetMinutes: 420 } })
  assert.equal(view.selectedRelease.id, anchorId); assert.equal(view.markers[0].time, chartAt)
  assert.match(container.querySelectorAll('[data-reading-clock="display"]')[3].textContent, /01:30/)
  assert.match(container.querySelectorAll('[data-reading-clock="broker"]')[3].textContent, /21:30/)
  await React.act(async () => view.applyPreferences({ ...preferences, families: ['fed-chair'] }))
  assert.equal(container.querySelectorAll('.inspector-release').length, 0, 'FOMC companion rows stay under the FOMC filter')
  await render({ rows: [...input, event('840050022', 1800)] })
  assert.equal(container.querySelectorAll('.inspector-release').length, 1, 'Standalone Chair speech retains its own filter')
  console.log('✓ Mounted FOMC row clocks, source-time preservation, live companion arrival, green/red/gray rate deltas, timezone invariance and filter isolation')
} finally {
  await React.act(async () => root.unmount())
  await server.close(); await dom.happyDOM.abort(); dom.close()
  for (const key of globals) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key] }
}
