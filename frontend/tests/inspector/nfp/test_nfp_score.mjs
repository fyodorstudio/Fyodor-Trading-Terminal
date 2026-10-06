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
  const { assessNfpMagnitudeScore, nfpScoreSeries, nfpScoreVersion } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/NFP/assessment/nfp-magnitude-score.ts')
  const { nfpReadingRules } = await server.ssrLoadModule('./src/inspector/grading/nfp-grading.ts')
  const { NfpMagnitudeScoreTables } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/NFP/ui/NfpMagnitudeScoreTables.tsx')
  const { familyMagnitudeHistory } = await server.ssrLoadModule('./src/inspector/magnitude/family-magnitude-history.ts')
  const { useFamilyMagnitudeHistory } = await server.ssrLoadModule('./src/inspector/magnitude/useFamilyMagnitudeHistory.ts')
  const { nfpMagnitudeFamily } = await server.ssrLoadModule('./src/inspector/magnitude/magnitude-families.ts')
  const { groupInspectorReleases, readInspectorPreferences } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const primaryIds = ['840030016', '840030015', '840030018']
  assert.equal(nfpScoreVersion, 'nfp-eurusd-primary-signed-magnitude-v1')
  assert.deepEqual(nfpScoreSeries.filter((row) => row.role === 'primary').map((row) => row.id), primaryIds)
  assert.deepEqual(nfpScoreSeries.map((row) => row.id).sort(), Object.keys(nfpReadingRules).sort(), 'Every inventoried series has one explicit scoring role')
  const at = Date.UTC(2026, 8, 4, 12, 30)
  const release = (deltas, primaryOnly = false) => groupInspectorReleases(nfpScoreSeries
    .filter((series) => !primaryOnly || series.role === 'primary').map((series, index) => ({
      value_id: series.id, event_id: series.id, name: nfpReadingRules[series.id].name, currency: 'USD', country_code: 'US', country_name: 'United States',
      event_code: series.id, server_time_seconds: at / 1000 + 10800, chart_time_seconds: at / 1000 + 10800, release_at: at,
      period_seconds: Date.UTC(2026, 7, 1) / 1000, revision: 0, time_mode: 0, importance: 'high', impact: 'none', availability: 'observed',
      unit: series.unit.units[0], multiplier: series.unit.multiplier, digits: 1,
      actual: 10 + (deltas[index] ?? 0), previous: 10, forecast: -999, revised_previous: 999,
      actual_raw_scaled_1e6: String(Math.round((10 + (deltas[index] ?? 0)) * 1e6)), previous_raw_scaled_1e6: '10000000',
    })))[0]
  const settings = (limits = [1, 2, 3], ids = nfpScoreSeries.map((series) => series.id)) => Object.fromEntries(ids.map((id) => [id, limits]))
  const ready = (selected, config = settings()) => ({ rows: familyMagnitudeHistory([], selected, nfpMagnitudeFamily, config),
    partial: false, message: null, error: null })
  const assess = (deltas, config = settings()) => { const selected = release(deltas); return assessNfpMagnitudeScore(selected, ready(selected, config)) }

  for (const index of [0, 1, 2]) for (const sign of [-1, 1]) for (const magnitude of [1, 2, 3, 4]) {
    const deltas = [0, 0, 0]; deltas[index] = sign * magnitude * (index === 1 ? -1 : 1)
    const score = assess(deltas)
    assert.equal(score.primary[index].score, sign * magnitude)
    assert.equal(score.total, sign * magnitude)
    assert.equal(score.direction, sign > 0 ? 'short' : 'long')
  }
  assert.equal(assess([1, -1, -4]).direction, 'long', 'A negative Extreme outweighs two positive Small contributions')
  assert.equal(assess([1, 1, 0]).tieBreak.id, primaryIds[0])
  assert.equal(assess([1, 1, 0]).direction, 'short', 'Payrolls break exact cancellation first')
  assert.equal(assess([0, -1, -1]).tieBreak.id, primaryIds[1])
  assert.equal(assess([0, -1, -1]).direction, 'short', 'Unemployment breaks cancellation when payrolls are unchanged')
  assert.equal(assess([0, 0, 0]).direction, 'uncomputed')
  assert.equal(assess([0, 0, 0]).total, 0)
  assert.equal(assess([0, 0, 0]).tieBreak, null)
  assert.equal(assessNfpMagnitudeScore(null, { rows: {} }), null)
  for (const overrides of [{ familyId: 'us-cpi' }, { currency: 'EUR' }, { country: 'EU' }]) {
    assert.equal(assessNfpMagnitudeScore({ ...release([1, 1, 1]), ...overrides }, { rows: {} }), null)
  }
  const primarySettings = settings([1, 2, 3], primaryIds)
  const selected = release([1, -2, -1, -4, 4, -4, -4, -4, -4, 4])
  const score = assessNfpMagnitudeScore(selected, ready(selected))
  assert.deepEqual(score.primary.map((row) => row.score), [1, 2, -1])
  assert.equal(score.total, 2, 'Seven opposing supporting readings cannot overturn the primary score')
  assert.deepEqual(score.supporting.map((row) => row.score), [-4, 4, -4, -4, -4, -4, -4], 'U6 also inverts its raw delta')
  assert.equal(assessNfpMagnitudeScore(selected, ready(selected, primarySettings)).total, 2, 'Undefined supporting settings do not gate direction')
  const primaryOnly = release([1, -2, -1], true)
  assert.equal(assessNfpMagnitudeScore(primaryOnly, ready(primaryOnly, primarySettings)).total, 2, 'Missing supporting rows do not gate direction')
  const duplicateSupporting = { ...selected, events: [...selected.events, { ...selected.events.find((row) => row.event_id === '840030017'), value_id: 'duplicate-supporting' }] }
  assert.equal(assessNfpMagnitudeScore(duplicateSupporting, ready(duplicateSupporting)).total, 2)
  const supportingMissing = { ...selected, events: selected.events.map((row) => row.event_id === '840030017' ? { ...row, actual: null } : row) }
  assert.equal(assessNfpMagnitudeScore(supportingMissing, ready(supportingMissing)).total, 2)

  for (const id of primaryIds) {
    const noConfig = { ...primarySettings }; delete noConfig[id]
    const undefinedScore = assessNfpMagnitudeScore(selected, ready(selected, noConfig))
    assert.equal(undefinedScore.primary.find((row) => row.id === id).status, 'undefined')
    assert.equal(undefinedScore.total, null); assert.equal(undefinedScore.direction, 'uncomputed')
    const missing = { ...selected, events: selected.events.filter((row) => row.event_id !== id) }
    assert.equal(assessNfpMagnitudeScore(missing, ready(missing)).total, null)
    const duplicate = { ...selected, events: [...selected.events, { ...selected.events.find((row) => row.event_id === id), value_id: 'duplicate-primary' }] }
    assert.equal(assessNfpMagnitudeScore(duplicate, ready(duplicate)).primary.find((row) => row.id === id).status, 'duplicate')
    for (const overrides of [{ actual: null }, { previous: null }, { actual_raw_scaled_1e6: 'invalid' },
      { unit: 3 }, { multiplier: 2 }, { currency: 'EUR' }, { country_code: 'EU' }]) {
      const invalid = { ...selected, events: selected.events.map((row) => row.event_id === id ? { ...row, ...overrides } : row) }
      assert.equal(assessNfpMagnitudeScore(invalid, ready(invalid)).total, null)
    }
  }
  const personUnit = { ...selected, events: selected.events.map((row) => row.event_id === primaryIds[0] ? { ...row, unit: 4 } : row) }
  assert.equal(assessNfpMagnitudeScore(personUnit, ready(personUnit)).total, 2, 'Source persons and unspecified payroll units both retain native thousands')
  const decimal = release([.3, -.1, -.1])
  assert.deepEqual(assessNfpMagnitudeScore(decimal, ready(decimal, settings([.1, .3, .6]))).primary.map((row) => row.score), [2, 1, -1])
  const zeroUndefined = assess([0, 0, 0], {})
  assert.equal(zeroUndefined.total, null, 'Unconfigured zero remains Undefined')
  assert.equal(assessNfpMagnitudeScore(selected, { ...ready(selected), message: 'History unavailable', partial: true }).total, 2,
    'Frozen manual classification does not depend on history frequencies')
  console.log('✓ Three primary USD contributions, inverse unemployment, magnitude dominance, cancellation priority, supporting exclusion and strict source/configuration gates')

  const table = mount(NfpMagnitudeScoreTables, { release: selected, history: ready(selected) })
  await table.render()
  const matrix = () => table.container.querySelector('[aria-label="NFP signed magnitude score"]')
  const supporting = () => table.container.querySelector('[aria-label="NFP supporting magnitudes"]')
  assert.deepEqual([...matrix().querySelectorAll('thead th')].map((cell) => cell.textContent),
    ['EURUSD Short', 'Unchanged (0)', 'Small (1)', 'Medium (2)', 'Large (3)', 'Extreme (4)'])
  assert.equal(matrix().querySelectorAll('tbody tr').length, 3)
  assert.equal(supporting().querySelectorAll('tbody tr').length, 7)
  assert.deepEqual([...matrix().querySelectorAll('[data-score]')].map((cell) => cell.textContent), ['+1', '+2', '−1'])
  assert.ok(matrix().querySelector('[data-series="840030015"] .inspector-score-positive'), 'Falling unemployment is green positive')
  assert.ok(supporting().querySelector('[data-series="840030024"] .inspector-score-negative'), 'Rising U6 is red negative')
  for (const row of table.container.querySelectorAll('tbody th')) {
    const tooltip = row.querySelector('[title]')
    assert.ok(tooltip.title.length > 20)
    assert.equal(tooltip.tabIndex, 0)
    assert.match(tooltip.getAttribute('aria-label'), new RegExp(tooltip.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(supporting().textContent, /Excluded from USD total/)
  assert.doesNotMatch(supporting().querySelector('thead').textContent, /EURUSD|Long|Short/)
  assert.equal(matrix().querySelector('[aria-label="NFP USD score"]').textContent, 'Total +2')
  assert.doesNotMatch(table.container.textContent, /Neutral|Mixed/)
  const canceled = release([1, 1, 0])
  await table.render({ release: canceled, history: ready(canceled) })
  assert.match(matrix().textContent, /Total 0.*Tie-break: Nonfarm Payrolls \+1/)
  await table.render({ release: selected, history: ready(selected, primarySettings) })
  assert.equal(supporting().querySelectorAll('[data-score]').length, 0)
  assert.equal(matrix().querySelector('[aria-label="NFP pair direction"]').textContent, 'EURUSD Short')
  await table.render({ release: selected, history: { ...ready(selected), partial: true } })
  assert.match(matrix().textContent, /Partial history/)

  let fetches = 0
  globalThis.fetch = () => { fetches++; throw new Error('No broker should make no requests') }
  function LiveScore({ current = selected }) {
    return React.createElement(NfpMagnitudeScoreTables, { release: current, history: useFamilyMagnitudeHistory(null, current) })
  }
  const live = mount(LiveScore, {})
  await live.render()
  const liveDirection = () => live.container.querySelector('[aria-label="NFP pair direction"]').textContent
  assert.equal(liveDirection(), 'Uncomputed')
  await React.act(async () => { for (const id of primaryIds) nfpMagnitudeFamily.settings.save(id, [1, 2, 3]) })
  assert.equal(liveDirection(), 'EURUSD Short')
  await React.act(async () => nfpMagnitudeFamily.settings.save(primaryIds[2], [.1, .2, .3]))
  assert.equal(liveDirection(), 'EURUSD Long', 'Frozen boundary changes reactively change magnitude and direction')
  await React.act(async () => { for (const row of nfpScoreSeries.filter((series) => series.role === 'supporting')) nfpMagnitudeFamily.settings.save(row.id, [.1, .2, .3]) })
  assert.equal(liveDirection(), 'EURUSD Long', 'Supporting configuration cannot change the direction')
  await React.act(async () => nfpMagnitudeFamily.settings.save(primaryIds[2], [1, 2, 3]))
  await live.render({ current: release([-1, 2, 1], true) })
  assert.equal(liveDirection(), 'EURUSD Long', 'Incoming primary readings refresh direction without supporting rows')
  await React.act(async () => nfpMagnitudeFamily.settings.save(primaryIds[0], null))
  assert.equal(liveDirection(), 'Uncomputed')
  assert.equal(fetches, 0)
  console.log('✓ Primary/supporting matrices, signed colors, role tooltips, explicit unavailable states, tie-break display and live settings/reading updates')

  const { inspectorScoringBinding } = await server.ssrLoadModule('./src/inspector/scoring/scoring-registry.ts')
  assert.equal(inspectorScoringBinding('EURUSD.a', selected).familyId, 'jobs')
  assert.equal(inspectorScoringBinding('GBPUSD', selected), null)
  assert.equal(inspectorScoringBinding('EURUSD', { ...selected, currency: 'EUR' }), null)
  assert.equal(inspectorScoringBinding('EURUSD', { ...selected, country: 'EU' }), null)
  assert.equal(inspectorScoringBinding('EURUSD', { ...selected, familyId: 'fomc' }).familyId, 'fomc')
  assert.equal(inspectorScoringBinding('EURUSD', null), null)
  const { useInspector } = await server.ssrLoadModule('./src/inspector/useInspector.ts')
  const { InspectorPanel } = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  const clockOffsetMs = at + 1000 - Date.now(), bars = [], utc = { mode: 'utc', utcOffsetMinutes: 0 }
  let scatterRelease = null
  function Inspector({ current = selected }) {
    const view = useInspector({ symbol: 'EURUSD.a', events: current.events, bars, timeframe: 'H1', timeDisplay: utc, clockOffsetMs })
    return React.createElement(InspectorPanel, { view: { ...view, magnitudeHistory: ready(current) }, symbol: 'EURUSD.a',
      source: null, error: null, timeDisplay: utc, onOpenScatter: (release) => { scatterRelease = release } })
  }
  const inspector = mount(Inspector, {})
  const click = (element) => React.act(async () => { assert.ok(element); element.click() })
  const selector = (host = inspector) => host.container.querySelector('[aria-label="Inspector view"]')
  const chooseView = (value) => React.act(async () => {
    selector().value = value
    selector().dispatchEvent(new dom.Event('change', { bubbles: true }))
  })
  await inspector.render(); await click(inspector.container.querySelector('.inspector-release'))
  assert.equal(selector().value, 'table')
  assert.ok(inspector.container.querySelector('.inspector-table-scroll'))
  assert.equal(inspector.container.querySelector('.inspector-scoring-view'), null)
  const configured = nfpMagnitudeFamily.settings.read()
  await chooseView('scoring')
  assert.equal(inspector.container.querySelector('.inspector-table-scroll'), null)
  assert.equal(inspector.container.querySelectorAll('.inspector-scoring-view table').length, 2)
  const summary = inspector.container.querySelector('.inspector-scoring-view').textContent
  assert.equal(readInspectorPreferences().detailView, 'scoring')
  await chooseView('scatter'); assert.equal(scatterRelease.id, selected.id, 'Scatter shortcut also works from scoring view')
  assert.equal(selector().value, 'scoring', 'Scatter navigation restores the visible Inspector selection')
  assert.equal(readInspectorPreferences().detailView, 'scoring', 'Scatter is never saved as an Inspector view')
  const reloaded = mount(Inspector, {})
  await reloaded.render(); await click(reloaded.container.querySelector('.inspector-release'))
  assert.equal(reloaded.container.querySelector('.inspector-scoring-view').textContent, summary, 'Fresh mounts restore the chosen view and score')
  assert.equal(reloaded.container.querySelector('.inspector-table-scroll'), null)
  const decision = { ...selected.events[0], event_id: '999010004', name: 'ECB President speech', country_code: 'EU', currency: 'EUR', unit: 1, multiplier: 0 }
  await inspector.render({ current: groupInspectorReleases([decision])[0] })
  await click(inspector.container.querySelector('.inspector-release'))
  assert.equal(selector().querySelector('[value="scoring"]').disabled, true)
  assert.equal(selector().value, 'table')
  assert.ok(inspector.container.querySelector('.inspector-table-scroll'), 'Families without a scoring model fall back to readings')
  assert.equal(inspector.container.querySelector('.inspector-scoring-view'), null)
  await inspector.render(); await click(inspector.container.querySelector('.inspector-release'))
  assert.equal(inspector.container.querySelector('.inspector-scoring-view').textContent, summary, 'Family switching never changes the scoring convention')
  await chooseView('table')
  assert.equal(readInspectorPreferences().detailView, 'table')
  assert.equal(inspector.container.querySelector('.inspector-scoring-view'), null)
  assert.equal(inspector.container.querySelectorAll('.inspector-table-scroll tbody tr').length, 10)
  assert.deepEqual(nfpMagnitudeFamily.settings.read(), configured, 'View selection never edits frozen boundaries')
  assert.equal(fetches, 0, 'View switching performs no calendar request')
  console.log('✓ Explicit pair/country/currency/family registry, exclusive Inspector views, refresh persistence, unsupported fallback and Scatter shortcut')
} finally {
  for (const root of roots) await React.act(async () => root.unmount())
  await server.close(); await dom.happyDOM.abort(); dom.close()
  for (const key of keys) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key] }
}
