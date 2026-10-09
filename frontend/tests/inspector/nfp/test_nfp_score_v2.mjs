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
  const { assessNfpScoreV2, supportsNfpV2, nfpScoreV2Version, nfpV2SeriesIds, nfpV2Features } = await server.ssrLoadModule('./src/scoring-system/PAIR/EURUSD/USD/NFP/assessment/nfp-score-v2.ts')
  const { monthlyComparison } = await server.ssrLoadModule('./src/scoring-system/PAIR/EURUSD/USD/NFP/assessment/monthly-comparison.ts')
  const { groupInspectorReleases, defaultInspectorPreferences, inspectorStorageKey, readInspectorPreferences } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { exportWorkspace, restoreWorkspace } = await server.ssrLoadModule('./src/workspace-portability/workspace-snapshot.ts')
  assert.equal(nfpScoreV2Version, 'nfp-eurusd-labor-context-v2.2')
  const raw = (value) => value === null ? null : String(Math.round(value * 1e6))
  const reading = (year, reference, values = {}, prior = {}, revision = 150) => {
    const at = Date.UTC(year, reference + 1, 7, 12, 30), period = Date.UTC(year, reference, 1) / 1000
    const actuals = { '840030015': 4.1, '840030016': 150, '840030017': 62.3, '840030018': .2,
      '840030019': 3.5, '840030020': 34.3, '840030022': 10, '840030023': 140, '840030024': 8, '840030032': 5, ...values }
    const previousValues = { ...actuals, '840030016': 150, ...prior }
    return nfpV2SeriesIds.map((id) => {
      const payroll = ['840030016', '840030022', '840030023', '840030032'].includes(id)
      return { value_id: `${period}:${id}`, event_id: id, name: id, currency: 'USD', country_code: 'US', country_name: 'United States', event_code: id,
        server_time_seconds: at / 1000 + 10800, chart_time_seconds: at / 1000 + 10800, release_at: at,
        period_seconds: period, revision: 0, time_mode: 0, importance: 'high', impact: 'none', availability: 'observed',
        unit: payroll ? 4 : id === '840030020' ? 3 : 1, multiplier: payroll ? 1 : 0, digits: payroll ? 0 : 1,
        actual: actuals[id], previous: previousValues[id], revised_previous: id === '840030016' ? revision : null,
        forecast: 99999, actual_raw_scaled_1e6: raw(actuals[id]), previous_raw_scaled_1e6: raw(previousValues[id]),
        revised_previous_raw_scaled_1e6: id === '840030016' ? raw(revision) : null }
    })
  }
  const history = []
  for (let i = 0; i < 132; i++) history.push(...reading(2015 + Math.floor(i / 12), i % 12,
    { '840030016': 100 + (i % 4) * 50, '840030015': 4 + (i % 3) * .1,
      '840030018': .1 + (i % 4) * .1, '840030020': 34.2 + (i % 3) * .1 },
    { '840030015': 4 + ((i + 2) % 3) * .1, '840030020': 34.2 + ((i + 2) % 3) * .1 }, 130 + (i % 3) * 20))
  const withMonths = (jobs, wages = [.2, .2, .2]) => [...history, ...[3, 4, 5].flatMap((m, i) =>
    reading(2026, m, { '840030016': jobs[i], '840030018': wages[i] }))]
  const select = (values, prior, revision) => groupInspectorReleases(reading(2026, 6, values, prior, revision))[0]
  const weakHistory = withMonths([200, 180, 160], [.3, .3, .3])
  const weak = select({ '840030016': 50, '840030015': 4.3, '840030018': .1, '840030020': 34.2 },
    { '840030015': 4.2, '840030020': 34.3, '840030016': 180 }, 130)
  const score = assessNfpScoreV2(weak, weakHistory)
  const unemploymentRow = weak.events.find(e => e.event_id === '840030015')
  const revisedUnemployment = { ...unemploymentRow, actual: 4.4, actual_raw_scaled_1e6: '4400000', previous: 4.6,
    previous_raw_scaled_1e6: '4600000', revised_previous: 4.5, revised_previous_raw_scaled_1e6: '4500000' }
  assert.equal(monthlyComparison(revisedUnemployment, weakHistory, true).value, .1, 'Compare December 4.4 with its known revised November 4.5, not old 4.6')
  assert.equal(monthlyComparison({ ...revisedUnemployment, revised_previous_raw_scaled_1e6: 'bad' }, weakHistory, true).value, null,
    'An invalid supplied revision must not silently fall back to a stale Previous')
  const priorUnemployment = weakHistory.find(e => e.event_id === '840030015' && e.period_seconds === Date.UTC(2026, 5, 1) / 1000)
  const gapHousehold = weakHistory.filter(e => e !== priorUnemployment)
  assert.equal(monthlyComparison(revisedUnemployment, gapHousehold, true).value, null)
  assert.equal(monthlyComparison(revisedUnemployment, [...gapHousehold, { ...priorUnemployment, release_at: weak.releaseAt + 1 }], true).value, null)
  assert.equal(monthlyComparison(revisedUnemployment, [...weakHistory, { ...priorUnemployment, value_id: 'duplicate-household' }], true).value, null)
  assert.equal(score.label, 'EURUSD Long'); assert.equal(score.strength, 'strong')
  assert.deepEqual(score.readings.map((r) => r.value), [-120, -.1, -.2, -50, -.1], 'The nearest hiring month uses the revision known in this publication')
  assert.equal(score.availableWeight, 100); assert.equal(score.reduced, false)
  assert.equal(score.total, score.readings.reduce((sum, r) => sum + r.points * r.weight, 0) / 100)
  assert.match(score.explanation, /Hiring is below/)
  const strongHistory = withMonths([100, 150, 200], [.1, .2, .3])
  const strong = select({ '840030016': 300, '840030015': 3.9, '840030018': .4, '840030020': 34.4 },
    { '840030015': 4.1, '840030020': 34.3 }, 170)
  assert.equal(assessNfpScoreV2(strong, strongHistory).label, 'EURUSD Short')
  assert.equal(assessNfpScoreV2(strong, strongHistory).strength, 'strong')

  // A rebound to smaller job losses must still carry a negative hiring vote.
  const loss = select({ '840030016': -50 }, { '840030016': -100 }, -100)
  const losses = assessNfpScoreV2(loss, withMonths([-300, -200, -100]))
  assert.equal(losses.readings[0].value, -50)
  assert.equal(losses.label, 'EURUSD Long'); assert.equal(losses.strength, 'moderate')
  assert.match(losses.explanation, /cut jobs/)
  const flatHistory = withMonths([150, 150, 150])
  const flat = select({}, {}, 150)
  assert.equal(assessNfpScoreV2(flat, flatHistory).label, 'Uncomputed')

  // Participation qualifies unemployment, never adds its own directional vote.
  const unemploymentOnly = select({ '840030015': 4 }, { '840030015': 4.1 }, 150)
  const unchangedParticipation = assessNfpScoreV2(unemploymentOnly, flatHistory)
  const fallingParticipation = { ...unemploymentOnly, events: unemploymentOnly.events.map((e) => e.event_id === '840030017' ?
    { ...e, actual: 62.2, actual_raw_scaled_1e6: '62200000', previous: 62.3, previous_raw_scaled_1e6: '62300000' } : e) }
  const qualified = assessNfpScoreV2(fallingParticipation, flatHistory)
  assert.equal(unchangedParticipation.readings[1].weight, 30); assert.equal(qualified.readings[1].weight, 15)
  assert.equal(qualified.total, unchangedParticipation.total / 2)
  assert.match(qualified.strengthReason, /positive vote is halved/)
  assert.equal(qualified.strength, 'moderate')
  const missingParticipation = assessNfpScoreV2({ ...unemploymentOnly,
    events: unemploymentOnly.events.filter((e) => e.event_id !== '840030017') }, flatHistory)
  assert.equal(missingParticipation.readings[1].weight, 30)
  assert.match(missingParticipation.strengthReason, /Participation is unavailable/)
  assert.equal(missingParticipation.reduced, false)
  const noEmployment = { ...weak, events: weak.events.filter((e) => !['840030015', '840030016'].includes(e.event_id)) }
  assert.equal(assessNfpScoreV2(noEmployment, weakHistory).label, 'Uncomputed')
  const noHours = { ...weak, events: weak.events.filter((e) => e.event_id !== '840030020') }
  const partial = assessNfpScoreV2(noHours, weakHistory)
  assert.equal(partial.label, 'EURUSD Long'); assert.equal(partial.strength, 'weak')
  assert.match(partial.strengthReason, /Limited data/)
  const noRevision = { ...weak, events: weak.events.map((e) => e.event_id === '840030016' ?
    { ...e, revised_previous: null, revised_previous_raw_scaled_1e6: null } : e) }
  assert.equal(assessNfpScoreV2(noRevision, weakHistory).readings[3].points, null)
  const higherRevision = { ...weak, events: weak.events.map((e) => e.event_id === '840030016' ?
    { ...e, revised_previous: 220, revised_previous_raw_scaled_1e6: '220000000' } : e) }
  assert.ok(assessNfpScoreV2(higherRevision, weakHistory).total > score.total, 'Revision is an intentional input in NFP v2')

  // Shutdown-style skipped reference month: September +119k, November +64k,
  // newly published October -105k in the broker's revised_previous field.
  // The -224k subtraction is not a revision of the same month.
  const skipped = groupInspectorReleases(reading(2025, 10, { '840030016': 64 },
    { '840030016': 119 }, -105))[0]
  const skippedHistory = history.filter(e => e.period_seconds !== Date.UTC(2025, 9, 1) / 1000)
  assert.equal(nfpV2Features(skipped, skippedHistory).features.revision.value, null)
  const skippedScore = assessNfpScoreV2(skipped, skippedHistory)
  assert.equal(skippedScore.readings[3].points, null)
  assert.equal(skippedScore.readings[1].points, null, 'Missing October household data cannot establish November monthly unemployment')
  assert.equal(skippedScore.readings[4].points, null, 'A gap cannot silently become a one-month hours comparison')
  assert.match(skippedScore.readings[3].reason, /preceding reference month/)
  assert.equal(skipped.events.find(e => e.event_id === '840030016').revised_previous, -105,
    'Keep valid broker values; exclude an invalid interpretation, not the data')
  const absentPrior = weakHistory.filter(e => e !== weakHistory.find(row =>
    row.event_id === '840030016' && row.period_seconds === Date.UTC(2026, 5, 1) / 1000))
  assert.equal(nfpV2Features(weak, absentPrior).features.revision.value, null)
  const intervening = reading(2025, 9).find(e => e.event_id === '840030016')
  assert.equal(nfpV2Features(skipped, [...skippedHistory, { ...intervening,
    release_at: skipped.releaseAt }]).features.revision.value, null, 'Same-time new month is not an earlier publication')
  assert.equal(nfpV2Features(skipped, [...skippedHistory, { ...intervening,
    release_at: skipped.releaseAt + 1 }]).features.revision.value, null, 'Future data cannot establish a revision')
  const priorForRevision = weakHistory.find(e => e.event_id === '840030016' &&
    e.period_seconds === Date.UTC(2026, 5, 1) / 1000)
  assert.equal(nfpV2Features(weak, [...weakHistory, { ...priorForRevision, value_id: 'duplicate-prior' }]).features.revision.value, null)
  const { suppliedPriorLabels, revisedFamilyComparison } = await server.ssrLoadModule('./src/inspector/grading/reading-grading.ts')
  const { nfpMagnitudeFamily } = await server.ssrLoadModule('./src/inspector/magnitude/magnitude-families.ts')
  const skippedPayroll = skipped.events.find(e => e.event_id === '840030016')
  assert.equal(suppliedPriorLabels(skippedPayroll).value, 'Provider prior')
  const comparison = revisedFamilyComparison(skippedPayroll, 'jobs', nfpMagnitudeFamily)
  assert.equal(comparison.label, 'A−PriorP'); assert.equal(comparison.delta, 169)
  assert.match(comparison.explanation, /not a revision/)

  assert.equal(assessNfpScoreV2(null, history), null)
  for (const change of [{ familyId: 'us-cpi' }, { currency: 'EUR' }, { country: 'EU' }])
    assert.equal(supportsNfpV2({ ...weak, ...change }), false)
  const future = reading(2026, 7, { '840030016': 1000000 })
  assert.deepEqual(assessNfpScoreV2(weak, [...weakHistory, ...weak.events, ...future]), score)
  assert.deepEqual(assessNfpScoreV2(weak, [...weakHistory, ...weakHistory]), score)
  const noForecasts = (e) => ({ ...e, forecast: -1e12, forecast_raw_scaled_1e6: 'bad' })
  assert.deepEqual(assessNfpScoreV2({ ...weak, events: weak.events.map(noForecasts) }, weakHistory.map(noForecasts)), score)
  const copy = { ...weak, events: weak.events.map((e) => ['840030022', '840030023', '840030032', '840030019', '840030024'].includes(e.event_id) ?
    { ...e, actual: -1e6, actual_raw_scaled_1e6: '-1000000000000' } : e) }
  const composition = assessNfpScoreV2(copy, weakHistory)
  assert.deepEqual(composition.readings, score.readings); assert.equal(composition.total, score.total)
  const early = groupInspectorReleases(reading(2015, 5))[0]
  assert.equal(assessNfpScoreV2(early, history).label, 'Uncomputed')
  assert.equal(assessNfpScoreV2({ ...weak, timingUncertain: true }, history).label, 'Uncomputed')
  const monthly = weakHistory.find((e) => e.event_id === '840030016' && e.period_seconds === Date.UTC(2026, 5, 1) / 1000)
  const lacking = weakHistory.filter((e) => e !== monthly)
  assert.equal(assessNfpScoreV2(weak, lacking).readings[0].points, null)
  assert.equal(assessNfpScoreV2(weak, [...weakHistory, { ...monthly, value_id: 'duplicate' }]).readings[0].points, null)
  const revision = { ...monthly, value_id: 'timed-revision', actual: 300, actual_raw_scaled_1e6: '300000000' }
  assert.deepEqual(assessNfpScoreV2(weak, [...weakHistory, { ...revision, release_at: weak.releaseAt + 1 }]), score)
  assert.equal(assessNfpScoreV2(weak, [...weakHistory, { ...revision, release_at: weak.releaseAt - 1 }]).readings[0].value,
    -120, 'The publication-supplied nearest-month revision supersedes an earlier vintage of that month')
  assert.equal(assessNfpScoreV2(weak, weakHistory.map((e) => e === monthly ?
    { ...e, availability: 'not-returned-by-latest-query' } : e)).readings[0].points, null)
  for (const change of [{ unit: 1 }, { multiplier: 0 }, { actual: null }, { actual_raw_scaled_1e6: 'bad' },
    { actual_raw_scaled_1e6: '999999999999999999999' }, { currency: 'EUR' }, { country_code: 'EU' },
    { availability: 'not-returned-by-latest-query' }, { time_mode: 1 }, { release_at: weak.releaseAt + 1 },
    { period_seconds: 0 }, { period_seconds: Date.UTC(2026, 7, 1) / 1000 }]) {
    const invalid = { ...weak, events: weak.events.map((e) => e.event_id === '840030016' ? { ...e, ...change } : e) }
    assert.equal(assessNfpScoreV2(invalid, weakHistory).readings[0].points, null, JSON.stringify(change))
  }
  const wrongMonth = { ...weak, events: weak.events.map((e) => e.event_id === '840030018' ?
    { ...e, period_seconds: Date.UTC(2026, 5, 1) / 1000 } : e) }
  assert.equal(assessNfpScoreV2(wrongMonth, weakHistory).label, 'Uncomputed')
  const duplicateCurrent = { ...weak, events: [...weak.events, { ...weak.events.find((e) => e.event_id === '840030016'), value_id: 'duplicate-current' }] }
  assert.equal(assessNfpScoreV2(duplicateCurrent, weakHistory).readings[0].points, null)
  // Exact weighted cancellation: +1 hiring (40) vs -1 unemployment (30) and -1 revision (10).
  const tied = assessNfpScoreV2(select({ '840030016': 170, '840030015': 4.2 }, { '840030015': 4.1 }, 130), flatHistory)
  assert.equal(tied.total, 0); assert.equal(tied.tieBreak.id, 'hiring')
  assert.equal(tied.label, 'EURUSD Short'); assert.equal(tied.strength, 'weak')
  console.log('✓ NFP v2 pace, losses, revisions, participation qualification, supporting exclusion, gaps, cutoffs and weighted cancellation')

  const { NfpScoreV2 } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/NFP/ui/NfpScoreV2.tsx')
  globalThis.fetch = async () => { throw new Error('Unexpected fetch') }
  const table = mount(NfpScoreV2, { release: weak, brokerId: null, events: weakHistory })
  await table.render()
  assert.match(table.container.querySelector('.scoring-engine-version').textContent, /v2\.2/)
  assert.equal(table.container.querySelector('[aria-label="NFP v2 pair direction"]').textContent, 'EURUSD Long')
  assert.equal(table.container.querySelector('[aria-label="NFP v2 evidence strength"]').textContent, 'strong evidence')
  assert.ok(table.container.querySelector('[aria-label="NFP v2 change size"]'))
  assert.equal(table.container.querySelector('[aria-label="How this scorer works"]'),null)
  assert.equal(table.container.querySelector('[aria-label="NFP v2 component scores"]').closest('details'), null)
  assert.equal(table.container.querySelectorAll('[aria-label="NFP v2 component scores"] tbody tr').length, 5)
  assert.equal(table.container.querySelectorAll('[aria-label="NFP v2 supporting context"] tbody tr').length, 6)
  await table.render({ release: noHours, brokerId: null, events: weakHistory })
  assert.match(table.container.textContent, /Reduced data: 4 of 5/)

  const { InspectorPanel } = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  const prefs = { ...defaultInspectorPreferences(), detailView: 'scoring-v2' }
  let saved, opened
  const view = { selectedRelease: weak, preferences: prefs, supported: true, now: Date.UTC(2026, 9, 1),
    brokerTime: false, brokerId: null, brokerOffsetSeconds: 0, range: { from: weak.releaseAt - 1000, to: weak.releaseAt + 1000 },
    rangePreset: 'custom', rangeDates: { from: '2026-08-07', to: '2026-08-07' }, customFrom: '2026-08-07', customTo: '2026-08-07',
    releases: [weak], allReleases: groupInspectorReleases([...weakHistory, ...weak.events]), magnitudeHistory: { rows: {}, partial: false },
    storage: { loading: false, error: null, coverage: {}, source: null }, selectRelease() {}, selectCustomRange() {},
    applyPreferences(next) { saved = next }, setRangePreset() {}, setCustomFrom() {}, setCustomTo() {} }
  const props = { view, symbol: 'EURUSD.a', source: null, error: null, timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 }, onOpenScatter(r) { opened = r } }
  const panel = mount(InspectorPanel, props)
  await panel.render()
  const dropdown = panel.container.querySelector('[aria-label="Inspector view"]')
  assert.equal(dropdown.value, 'scoring')
  assert.equal(panel.container.querySelector('[aria-label="NFP v2 pair direction"]').textContent, 'EURUSD Long')
  assert.equal(panel.container.querySelector('[aria-label="CPI v2 pair direction"]'), null)
  assert.equal(panel.container.querySelector('option[value="scoring-v3"]'), null)
  await React.act(async () => { dropdown.value = 'scatter'; dropdown.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.equal(opened.id, weak.id); assert.equal(dropdown.value, 'scoring')
  await React.act(async () => { dropdown.value = 'scoring'; dropdown.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.equal(saved.detailView, 'scoring')
  await panel.render({ ...props, view: { ...view, preferences: { ...prefs, detailView: 'table' } } })
  assert.match(panel.container.textContent, /Provider prior: 130k/)
  assert.match(panel.container.textContent, /A−PriorP/)
  const tableDropdown = panel.container.querySelector('[aria-label="Inspector view"]')
  await React.act(async () => { tableDropdown.value = 'scoring'; tableDropdown.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.equal(saved.detailView, 'scoring')
  await panel.render({ ...props, view: { ...view, selectedRelease: { ...weak, familyId: 'ppi' } } })
  assert.equal(panel.container.querySelector('[aria-label="Inspector view"]').value, 'scoring')
  assert.equal(panel.container.querySelector('option[value="scoring-v2"]'), null)
  await panel.render({ ...props, symbol: 'USDJPY', view: { ...view, supported: false } })
  assert.equal(panel.container.querySelector('[aria-label="NFP v2 pair direction"]'), null)
  localStorage.setItem(inspectorStorageKey, JSON.stringify(prefs))
  const workspace = exportWorkspace()
  localStorage.clear(); restoreWorkspace(workspace)
  assert.equal(readInspectorPreferences().detailView, 'scoring')
  const paths = []
  globalThis.fetch = async (url) => {
    paths.push(url)
    if (url === '/storage-api/health') return { ok: true, json: async () => ({ revision: 1, sources: [{ id: 'test-broker', publisher_status: 'live', server_now: 1 }], collector_error: null }) }
    const params = new URL(url, 'http://localhost').searchParams
    assert.equal(params.get('currency'), 'USD'); assert.equal(params.get('time_basis'), 'chart')
    assert.equal(params.get('event_ids'), nfpV2SeriesIds.slice().sort().join(','))
    return { ok: true, json: async () => ({ source_id: 'test-broker', revision: 1, timestamp_convention: 'trade_server_time', time_basis: 'chart',
      event_ids: nfpV2SeriesIds, events: weakHistory, coverage: {}, next_cursor: null }) }
  }
  const stored = mount(NfpScoreV2, { release: weak, brokerId: 'test-broker', events: [] })
  await stored.render()
  await React.act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)) })
  assert.ok(paths.some((p) => p.startsWith('/storage-api/calendar?')))
  assert.equal(stored.container.querySelector('[aria-label="NFP v2 pair direction"]').textContent, 'EURUSD Long')
  console.log('✓ NFP v2 result and optional context details, scoped navigation, saved selection and independent history fetch')
} finally {
  await React.act(async () => { for (const root of roots) root.unmount() })
  await dom.happyDOM.abort(); dom.close()
  for (const key of keys) {
    if (previous[key]) Object.defineProperty(globalThis, key, previous[key])
    else delete globalThis[key]
  }
  await server.close()
}
