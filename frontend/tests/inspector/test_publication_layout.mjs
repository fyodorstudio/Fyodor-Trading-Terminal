import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'
import { history, latestRows } from '../usd-context/fixtures.mjs'

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const server = await createServer({ root: frontend, server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT', 'Worker']
const previous = Object.fromEntries(keys.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
globalThis.Worker = undefined
const { createRoot } = await import('react-dom/client')
const host = document.createElement('div'); host.className = 'inspector-detail'; document.body.append(host); const root = createRoot(host)
try {
  const load = p => server.ssrLoadModule('./src/' + p)
  const { InspectorScoringView } = await load('inspector/scoring/InspectorScoringView.tsx')
  const { inspectorScoringBindings, inspectorScoringBinding } = await load('inspector/scoring/scoring-registry.ts')
  const { InspectorPanel } = await load('inspector/InspectorPanel.tsx')
  const { groupInspectorReleases, defaultInspectorPreferences } = await load('inspector/inspector-data.ts')
  const { groupIsmEpisodes } = await load('inspector/episodes/ism-episodes.ts')
  const preferences = await load('pair-context/storage/relative-preferences.ts')
  const { buildContextTimeline } = await load('usd-context/core/build-context-timeline.ts')
  const { contextAt } = await load('usd-context/core/context-lookup.ts')
  const { contextPriority, contextSourceFamilies } = await load('usd-context/core/policy.ts')
  const { contextPairLabel } = await load('usd-context/core/usd-pair.ts')
  const events = [...history, ...latestRows], releases = groupInspectorReleases(events)
  const base = groupInspectorReleases(latestRows).find(r => r.familyId === 'us-cpi')
  const now = Date.UTC(2018, 7, 1), timeDisplay = { mode: 'utc', utcOffsetMinutes: 0 }
  const magnitudeHistory = { rows: {}, partial: false, message: null, error: null }
  const render = (Component, props) => React.act(async () => root.render(React.createElement(Component, props)))
  const columns = () => {
    const layout = host.querySelector('.inspector-publication-score')
    assert.ok(layout)
    assert.equal(layout.children.length, 2, 'Relative panels must not create a third grid column')
    assert.deepEqual([...layout.children].map(c => c.getAttribute('aria-label')), ['Standalone Scoring', 'Context-Aware at Publication Scoring'])
    assert.equal(host.querySelectorAll('.inspector-publication-score').length, 1, 'One shared layout, no nested two-column grids')
    assert.equal(host.querySelector('details'), null, 'Scoring remains flat')
    return { left: layout.children[0], right: layout.children[1] }
  }
  const resultFirst = (column, name) => {
    const body = column.querySelector('.inspector-scoring-column-body')
    const direction = body.querySelector('.inspector-majority')
    assert.ok(direction, `${name}: bias has a summary even when unavailable`)
    const text = document.createTreeWalker(body, dom.NodeFilter.SHOW_TEXT)
    let first
    while ((first = text.nextNode()) && !first.textContent.trim()) { /* Skip JSX spacing. */ }
    assert.equal(first?.textContent.trim(), direction.textContent.trim(), `${name}: bias is the first readable content, ahead of versions, headings and controls`)
    assert.equal(direction.parentElement.querySelector('small, .scoring-result-explanation'), null, `${name}: long explanations and metadata cannot stretch the bias row`)
  }
  const props = { history: magnitudeHistory, events, now, timeDisplay, brokerId: null }
  for (const binding of inspectorScoringBindings) {
    assert.match(binding.versionLabel, /v\d/, 'Every registered scorer declares its visible current version')
    const release = releases.findLast(r => r.familyId === binding.familyId) ?? { ...base, id: 'test/' + binding.familyId,
      familyId: binding.familyId, country: binding.country, currency: binding.currency, events: [] }
    await render(InspectorScoringView, { ...props, release, binding })
    const { left, right } = columns()
    resultFirst(left, binding.familyId + ' standalone')
    resultFirst(right, binding.familyId + ' context')
    assert.equal(right.querySelectorAll('.publication-context-controls').length, 1)
    assert.equal(right.querySelector('.publication-context-controls select').value, 'usd')
    assert.equal(left.querySelector('.usd-context-inputs'), null, `${binding.familyId}: context inputs belong on the right`)
    assert.ok(right.querySelector('.usd-context-inputs'), `${binding.familyId}: publication context is available`)
    assert.equal(right.querySelector('.usd-context-inputs button'), null, 'Contribution tables show status without editing controls')
    assert.equal(right.querySelector('[aria-label^="Use "]'), null, 'Input toggles stay behind Advanced settings on first open')
    assert.ok(right.querySelector('[aria-label="Advanced USD input settings"]'))
    assert.ok(right.querySelector('[aria-label="Inputs & contributions"]'), `${binding.familyId}: context calculation is grouped`)
    assert.equal(right.querySelectorAll('[aria-label="Context weight coverage"] dt').length, 3)
  }

  const fedAt = base.releaseAt + 3 * 86400000
  const fedRow = at => ({ ...base.events[0], event_id: '840050014', event_code: 'fed-interest-rate-decision', name: 'Fed Interest Rate Decision',
    value_id: 'fed/' + at, release_at: at, server_time_seconds: at / 1000 + 10800, chart_time_seconds: at / 1000 + 10800,
    actual: 3.75, previous: 3.75, actual_raw_scaled_1e6: '3750000', previous_raw_scaled_1e6: '3750000', period_seconds: 0 })
  const fedEvents = [...events, fedRow(fedAt - 45 * 86400000), fedRow(fedAt)]
  const fedRelease = groupInspectorReleases([fedRow(fedAt)])[0]
  const fedProps = { ...props, events: fedEvents, release: fedRelease, binding: inspectorScoringBinding('EURUSD', fedRelease) }
  await render(InspectorScoringView, fedProps)
  const fedColumns = columns()
  assert.equal(fedColumns.left.querySelector('[aria-label="Fed standalone direction"]').textContent, 'Uncomputed')
  assert.match(fedColumns.left.textContent, /Rate hold/)
  assert.ok(fedColumns.left.querySelector('[aria-label="Fed numerical rate path"]'))
  assert.ok(fedColumns.left.querySelector('[aria-label="Decision & rate action"]'))
  assert.ok(fedColumns.right.querySelector('[aria-label="Policy pressure & previous meeting"]'))
  assert.ok(fedColumns.right.querySelector('[aria-label="Fed previous meeting comparison"]'))
  const expected = contextAt(buildContextTimeline({ events: fedEvents, families: contextSourceFamilies(contextPriority),
    settings: { cpi: {}, nfp: {}, claims: {}, services: {}, manufacturing: {}, retail: {}, pce: {}, ppi: {}, gdp: {} }, asOf: now }), fedRelease.chartTime * 1000).result
  assert.equal(fedColumns.right.querySelector('[aria-label="Fed contextual pair direction"]').textContent, contextPairLabel('EURUSD', expected.direction))

  await React.act(async () => preferences.saveRelativePreferences({ ...preferences.readRelativePreferences(), mode: 'relative' }))
  const relativeColumns = columns()
  resultFirst(relativeColumns.left, 'Fed hold')
  resultFirst(relativeColumns.right, 'Relative context')
  assert.equal(relativeColumns.right.querySelectorAll('select').length, 1, 'The top context controls own the selector in relative mode')
  assert.ok(relativeColumns.right.querySelector('[aria-label="Relative context at publication"]'))
  assert.equal(relativeColumns.left.querySelector('[aria-label="Relative context at publication"]'), null)
  assert.equal(relativeColumns.left.querySelector('[aria-label="Fed standalone direction"]').textContent, 'Uncomputed')
  const selector = relativeColumns.right.querySelector('[aria-label="Raycaster context view"]')
  await React.act(async () => { selector.value = 'usd'; selector.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.equal(columns().right.querySelector('[aria-label="Relative context at publication"]'), null)
  resultFirst(columns().right, 'Restored USD context')
  assert.ok(columns().right.querySelector('[aria-label="Publication context view"]'), 'USD mode can switch back to relative')

  const grouped = groupIsmEpisodes(groupInspectorReleases(latestRows))
  const panel = (release, detailView) => ({ symbol: 'EURUSD', source: null, error: null, timeDisplay,
    view: { selectedRelease: release, preferences: { ...defaultInspectorPreferences(), detailView }, supported: true, now,
      brokerTime: false, brokerId: null, brokerOffsetSeconds: 0, range: { from: 0, to: now }, rangePreset: 'custom',
      rangeDates: { from: '2018-06-01', to: '2018-06-30' }, customFrom: '2018-06-01', customTo: '2018-06-30',
      releases: grouped, allReleases: releases, magnitudeHistory,
      storage: { loading: false, error: null, coverage: {}, source: null },
      selectRelease() {}, selectCustomRange() {}, applyPreferences() {}, setRangePreset() {}, setCustomFrom() {}, setCustomTo() {} } })
  for (const [family, view] of [['us-cpi', 'scoring-v2'], ['us-cpi', 'scoring-v3'], ['us-cpi', 'scoring-v4'],
    ['jobs', 'scoring-v2'], ['ism-manufacturing', 'scoring-v2'], ['ism-manufacturing', 'scoring-v3']]) {
    const release = grouped.find(r => r.familyId === family)
    assert.ok(release)
    await render(InspectorPanel, panel(release, view))
    const { left, right } = columns()
    const menu = host.querySelector('[aria-label="Inspector view"]')
    assert.equal(menu.value, 'scoring', 'Old saved version choices migrate to the latest scorer')
    assert.deepEqual([...menu.options].map(o => o.value), ['table', 'scoring', 'scatter'])
    assert.ok(menu.selectedOptions[0].textContent.includes(inspectorScoringBinding('EURUSD', release).versionLabel))
    assert.equal(left.querySelector('.usd-context-inputs'), null)
    assert.ok(right.querySelector('.usd-context-inputs'))
    if (view === 'scoring-v4') {
      assert.ok(left.querySelector('[aria-label="CPI v4 standalone component scores"]'))
      assert.ok(right.querySelector('[aria-label="CPI v4 context change"]'))
    }
    {
      assert.ok(left.querySelector('[aria-label="What drove the result"]'), `${family} ${view}: result drivers have their own section`)
      assert.ok(left.querySelector('[aria-label="How this scorer works"]'))
    }
  }

  await render(InspectorScoringView, fedProps)
  await React.act(async () => preferences.saveRelativePreferences({ ...preferences.readRelativePreferences(), mode: 'relative' }))
  const css = ['inspector/inspector.css', 'inspector/scoring/shared/ui/release-score.css', 'inspector/scoring/shared/ui/scoring-sections.css', 'pair-context/ui/relative-context.css',
    'inspector/scoring/PAIR/EURUSD/USD/CPI/ui/v4/cpi-v4.css', 'inspector/scoring/PAIR/EURUSD/USD/CLAIMS/ui/claims-score.css',
    'inspector/scoring/PAIR/EURUSD/USD/RETAIL/ui/retail-score.css']
  const style = document.createElement('style'); document.head.append(style)
  for (const order of [css, [...css].reverse()]) {
    style.textContent = order.map(p => fs.readFileSync(path.join(frontend, 'src', p), 'utf8')).join('\n')
    const right = columns().right
    const usdFirst = right.querySelector('.usd-context-inputs tbody td:first-child')
    const usdVote = right.querySelector('.usd-context-inputs tbody td:nth-child(5)')
    const relativeFirst = right.querySelector('.relative-context-inputs tbody td:first-child')
    assert.equal(dom.getComputedStyle(usdFirst).width, '22%')
    assert.equal(dom.getComputedStyle(usdVote).width, '35%')
    assert.equal(dom.getComputedStyle(relativeFirst).width, '27%')
    assert.equal(dom.getComputedStyle(usdVote).whiteSpace, 'normal', 'Inherited table nowrap must not leak into the vote column')
    assert.equal(dom.getComputedStyle(usdVote).overflowWrap, 'anywhere')
    for (const column of Object.values(columns())) {
      const row = column.querySelector('.inspector-majority').parentElement
      const computed = dom.getComputedStyle(row)
      assert.equal(computed.minHeight, '44px', 'Both results share the same minimum row height')
      assert.equal(computed.marginTop, '0px', 'No extra space above either result')
      assert.equal(computed.paddingTop, '10px')
    }
  }
  assert.match(style.textContent, /@container \(max-width: 760px\)/, 'Narrow docks preserve standalone-first stacking')
  const { SignalCalibration } = await load('inspector/scoring/shared/ui/SignalCalibration.tsx')
  const { PublicationScoringLayout } = await load('inspector/scoring/shared/ui/PublicationScoringLayout.tsx')
  await render(PublicationScoringLayout, { standalone: React.createElement(SignalCalibration, { readings: [{ id: 'claims', label: 'Initial claims', value: -2, sampleCount: 24,
    limits: [1, 2, 3], magnitudeMode: 'custom', unit: 'k claims' }, { id: 'missing', label: 'Missing signal', value: null,
    sampleCount: 0, limits: null }] }), context: React.createElement('p', null, 'Context sample') })
  assert.equal(host.querySelector('details'), null)
  const calibration = host.querySelector('[aria-label="Signal calibration"]')
  assert.match(calibration.rows[1].textContent, /-2 k claims.*N = 24.*1 \/ 2 \/ 3 k claims.*manual override boundaries/)
  assert.match(calibration.rows[2].textContent, /Missing signal.*— pp.*N = 0.*Unavailable/)
  for (const order of [css, [...css].reverse()]) {
    style.textContent = order.map(p => fs.readFileSync(path.join(frontend, 'src', p), 'utf8')).join('\n')
    assert.equal(dom.getComputedStyle(calibration.rows[1].cells[0]).width, '30%', 'Calibration budgets override the generic first-column rule in either load order')
    assert.equal(dom.getComputedStyle(calibration.rows[1].cells[1]).width, '25%')
  }
  console.log('✓ All current scoring columns and legacy-choice migration, Fed action/context separation, relative mode, CPI v4 ownership and table cascade in either load order')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.abort(); dom.close()
  for (const key of keys) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key] }
}
