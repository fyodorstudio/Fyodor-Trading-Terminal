import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const server = await createServer({ root: rootDir, server: { middlewareMode: true } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT', 'fetch']
const previous = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys.slice(0, 7)) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const roots = []
const mount = (Component, props) => {
  const container = document.createElement('div'); document.body.appendChild(container)
  const root = createRoot(container); roots.push(root)
  return { container, render: (next = props) => React.act(async () => root.render(React.createElement(Component, next))) }
}

try {
  const { assessCpiMagnitudeScore, cpiScoreSeries } = await server.ssrLoadModule('./src/inspector/grading/cpi-magnitude-score.ts')
  const { CpiMagnitudeScoreTable } = await server.ssrLoadModule('./src/inspector/magnitude/CpiMagnitudeScoreTable.tsx')
  const { useFamilyMagnitudeHistory } = await server.ssrLoadModule('./src/inspector/magnitude/useFamilyMagnitudeHistory.ts')
  const { familyMagnitudeHistory } = await server.ssrLoadModule('./src/inspector/magnitude/family-magnitude-history.ts')
  const { cpiMagnitudeFamily } = await server.ssrLoadModule('./src/inspector/magnitude/magnitude-families.ts')
  const { groupInspectorReleases } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const at = Date.UTC(2026, 8, 11, 12, 30)
  const release = (deltas) => groupInspectorReleases(cpiScoreSeries.map((series, index) => ({
    value_id: series.id, event_id: series.id, name: series.label, currency: 'USD', country_code: 'US', country_name: 'United States',
    event_code: series.id, server_time_seconds: at / 1000 + 10800, chart_time_seconds: at / 1000 + 10800, release_at: at,
    period_seconds: Date.UTC(2026, 7, 1) / 1000, revision: 0, time_mode: 0, importance: 'high', impact: 'none', availability: 'observed',
    unit: 1, multiplier: 0, digits: 1, actual: 10 + deltas[index], previous: 10, forecast: 999, revised_previous: -999,
    actual_raw_scaled_1e6: String(Math.round((10 + deltas[index]) * 1e6)), previous_raw_scaled_1e6: '10000000',
  })))[0]
  const settings = (limits = [1, 2, 3]) => Object.fromEntries(cpiScoreSeries.map((series) => [series.id, limits]))
  const ready = (selected, config = settings(), historyEvents = []) => ({
    rows: familyMagnitudeHistory(historyEvents, selected, cpiMagnitudeFamily, config), partial: false, message: null, error: null,
  })
  const assess = (deltas, config = settings()) => { const selected = release(deltas); return assessCpiMagnitudeScore(selected, ready(selected, config)) }
  for (const sign of [-1, 1]) for (const magnitude of [1, 2, 3, 4]) {
    const score = assess([sign * magnitude, 0, 0, 0])
    assert.equal(score.readings[0].score, sign * magnitude)
    assert.equal(score.total, sign * magnitude)
    assert.equal(score.direction, sign > 0 ? 'short' : 'long')
  }
  assert.equal(assess([1, 1, 1, -4]).direction, 'long', 'One negative Extreme outweighs three positive Small readings')
  assert.equal(assess([1, 2, 0, -3]).tieBreak.id, '840030006', 'Exact cancellation follows Core m/m first')
  assert.equal(assess([1, 2, 0, -3]).direction, 'short')
  assert.equal(assess([-1, 0, 1, 0]).tieBreak.id, '840030005', 'Headline m/m breaks ties when Core m/m is zero')
  assert.equal(assess([-1, 0, 1, 0]).direction, 'long')
  assert.equal(assess([0, 0, 1, -1]).tieBreak.id, '840030008', 'Annual Core breaks ties when monthly contributions are zero')
  assert.equal(assess([0, 0, 1, -1]).direction, 'long')
  assert.equal(assess([0, 0, 0, 0]).total, 0)
  assert.equal(assess([0, 0, 0, 0]).direction, 'uncomputed', 'No invented direction for all unchanged readings')
  assert.equal(assessCpiMagnitudeScore(null, { rows: {} }), null)
  assert.equal(assessCpiMagnitudeScore({ ...release([1, 1, 1, 1]), familyId: 'jobs' }, { rows: {} }), null)

  const selected = release([.3, .1, 0, -.1]), decimalSettings = settings([.1, .3, .6])
  const assessment = assessCpiMagnitudeScore(selected, ready(selected, decimalSettings))
  assert.deepEqual(assessment.readings.map((row) => row.score), [2, 1, 0, -1])
  assert.equal(assessment.monthly, 3); assert.equal(assessment.annual, -1); assert.equal(assessment.total, 2)
  assert.equal(assessment.label, 'EURUSD Short')
  const zeroUndefined = { ...decimalSettings }; delete zeroUndefined['840030007']
  const undefinedScore = assessCpiMagnitudeScore(selected, ready(selected, zeroUndefined))
  assert.equal(undefinedScore.readings[2].status, 'undefined', 'An unchanged reading with Undefined configuration is not scored zero')
  assert.equal(undefinedScore.readings[2].score, null)
  assert.equal(undefinedScore.monthly, 3); assert.equal(undefinedScore.annual, null); assert.equal(undefinedScore.total, null)
  assert.equal(undefinedScore.label, 'Uncomputed')
  const extraRows = ['840030009', '840030010', '840030035', '840030036', '840030033', '840030034'].map((id) =>
    ({ ...selected.events[0], value_id: id, event_id: id, actual: -999, actual_raw_scaled_1e6: '-999000000' }))
  const extended = { ...selected, events: [...selected.events, ...extraRows] }
  assert.equal(assessCpiMagnitudeScore(extended, ready(extended, decimalSettings)).total, 2, 'Indexes and unadjusted monthly rates never vote')
  const missing = { ...selected, events: selected.events.slice(1) }
  assert.equal(assessCpiMagnitudeScore(missing, ready(missing, decimalSettings)).readings[0].status, 'missing')
  const duplicate = { ...selected, events: [...selected.events, { ...selected.events[0], value_id: 'duplicate' }] }
  assert.equal(assessCpiMagnitudeScore(duplicate, ready(duplicate, decimalSettings)).readings[0].status, 'duplicate')
  for (const overrides of [{ actual: null }, { previous: null }, { actual_raw_scaled_1e6: 'invalid' }]) {
    const invalid = { ...selected, events: selected.events.map((row, index) => index ? row : { ...row, ...overrides }) }
    assert.equal(assessCpiMagnitudeScore(invalid, ready(invalid, decimalSettings)).readings[0].status, 'missing')
    assert.equal(assessCpiMagnitudeScore(invalid, ready(invalid, decimalSettings)).total, null)
  }
  for (const overrides of [{ unit: 0 }, { multiplier: 1 }, { currency: 'EUR' }, { country_code: 'EU' }]) {
    const invalid = { ...selected, events: selected.events.map((row, index) => index ? row : { ...row, ...overrides }) }
    assert.equal(assessCpiMagnitudeScore(invalid, ready(invalid, decimalSettings)).readings[0].status, 'unavailable')
  }
  const prior = selected.events.map((row) => ({ ...row, value_id: `prior-${row.value_id}`, availability: 'observed',
    release_at: at - 86400000, server_time_seconds: at / 1000 + 10800 - 86400, chart_time_seconds: at / 1000 + 10800 - 86400 }))
  const p95Settings = Object.fromEntries(cpiScoreSeries.map((series) => [series.id, 'p95']))
  const p95History = ready(selected, p95Settings, prior)
  const p95Score = assessCpiMagnitudeScore(selected, p95History)
  assert.deepEqual(p95Score.readings.map((row) => row.score), [3, 3, 0, -3], 'Explicit P95 reuses each series’ canonical thresholds')
  assert.equal(assessCpiMagnitudeScore(selected, { ...p95History, message: 'Loading history…' }).total, null)
  assert.equal(assessCpiMagnitudeScore(selected, { ...p95History, message: 'History unavailable', error: 'Service error' }).total, null)
  assert.equal(assessCpiMagnitudeScore(selected, ready(selected, p95Settings)).total, null, 'No earlier P95 baseline cannot become a Small score')
  assert.equal(assessCpiMagnitudeScore(selected, { ...ready(selected, decimalSettings), message: 'History needs calendar storage' }).total, 2,
    'Custom boundaries classify current readings independently of historical frequencies')
  console.log('✓ Equal series weights, signed 0–4 magnitudes, decimal ties, Extreme dominance, subtotals, cancellation priorities and strict unavailable/source gates')

  const table = mount(CpiMagnitudeScoreTable, { release: selected, history: ready(selected, decimalSettings) })
  await table.render()
  const scoreTable = () => table.container.querySelector('[aria-label="CPI signed magnitude score"]')
  assert.deepEqual([...scoreTable().querySelectorAll('thead th')].map((cell) => cell.textContent),
    ['EURUSD Short', 'Unchanged (0)', 'Small (1)', 'Medium (2)', 'Large (3)', 'Extreme (4)'])
  assert.deepEqual([...scoreTable().querySelectorAll('tbody th')].map((cell) => cell.textContent), ['Headline m/m', 'Core m/m', 'Headline y/y', 'Core y/y'])
  assert.deepEqual([...scoreTable().querySelectorAll('[data-score]')].map((cell) => cell.textContent), ['+2', '+1', '0', '−1'])
  assert.equal(scoreTable().querySelectorAll('td.inspector-grade-good').length, 2)
  assert.equal(scoreTable().querySelectorAll('td.inspector-grade-bad').length, 1)
  assert.equal(scoreTable().querySelectorAll('td.inspector-grade-unchanged').length, 1)
  assert.match(scoreTable().querySelector('caption').textContent, /bullish USD.*EURUSD Short.*bearish USD.*EURUSD Long/)
  assert.match(scoreTable().querySelector('[data-series="840030008"] [data-score]').getAttribute('aria-label'), /USD score −1/)
  assert.equal(scoreTable().querySelector('[aria-label="CPI USD score"]').textContent.trim(), 'Monthly +3 · Annual −1 · Total +2')
  const canceled = release([1, 2, 0, -3])
  await table.render({ release: canceled, history: ready(canceled) })
  assert.match(scoreTable().textContent, /Total 0.*Tie-break: Core m\/m \+2/)
  assert.equal(scoreTable().querySelector('[aria-label="CPI pair direction"]').textContent, 'EURUSD Short')
  await table.render({ release: selected, history: ready(selected, {}) })
  assert.equal(scoreTable().querySelectorAll('[data-score]').length, 0)
  assert.equal(scoreTable().querySelector('[aria-label="CPI pair direction"]').textContent, 'Uncomputed')
  assert.equal(scoreTable().querySelectorAll('tbody td[colspan="5"]').length, 4)
  assert.match(scoreTable().textContent, /Undefined/)
  assert.doesNotMatch(scoreTable().textContent, /Neutral|Mixed/)
  await table.render({ release: selected, history: { ...ready(selected, decimalSettings), partial: true } })
  assert.match(scoreTable().textContent, /Partial history/)

  let fetches = 0
  globalThis.fetch = () => { fetches++; throw new Error('No broker should make no requests') }
  function LiveScore({ current = selected }) {
    const history = useFamilyMagnitudeHistory(null, current)
    return React.createElement(CpiMagnitudeScoreTable, { release: current, history })
  }
  const live = mount(LiveScore, {})
  await live.render()
  assert.equal(live.container.querySelector('[aria-label="CPI pair direction"]').textContent, 'Uncomputed')
  await React.act(async () => { for (const series of cpiScoreSeries) cpiMagnitudeFamily.settings.save(series.id, [.1, .3, .6]) })
  assert.equal(live.container.querySelector('[aria-label="CPI pair direction"]').textContent, 'EURUSD Short')
  assert.match(live.container.textContent, /Monthly \+3 · Annual −1 · Total \+2/)
  await React.act(async () => cpiMagnitudeFamily.settings.save('840030005', [.01, .02, .1]))
  assert.equal(live.container.querySelector('[data-series="840030005"] [data-score]').textContent, '+4')
  assert.match(live.container.textContent, /Total \+4/)
  await React.act(async () => cpiMagnitudeFamily.settings.save('840030007', null))
  assert.equal(live.container.querySelector('[aria-label="CPI pair direction"]').textContent, 'Uncomputed')
  assert.equal(live.container.querySelector('[data-series="840030007"] td').textContent, 'Undefined')
  await React.act(async () => { for (const series of cpiScoreSeries) cpiMagnitudeFamily.settings.save(series.id, [.1, .3, .6]) })
  await live.render({ current: release([-.1, -.2, 0, .1]) })
  assert.equal(live.container.querySelector('[aria-label="CPI pair direction"]').textContent, 'EURUSD Long', 'Incoming readings refresh direction without remounting')
  assert.match(live.container.textContent, /Monthly −3 · Annual \+1 · Total −2/)
  await React.act(async () => { for (const series of cpiScoreSeries) cpiMagnitudeFamily.settings.save(series.id, 'p95') })
  assert.equal(live.container.querySelector('[aria-label="CPI pair direction"]').textContent, 'Uncomputed')
  assert.match(live.container.textContent, /Unavailable/)
  assert.equal(fetches, 0)
  console.log('✓ CPI matrix, USD sign/color accessibility, explicit Undefined states, tie-break display, partial history and live settings/reading updates')
} finally {
  for (const root of roots) await React.act(async () => root.unmount())
  await server.close(); await dom.happyDOM.abort(); dom.close()
  for (const key of keys) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key] }
}
