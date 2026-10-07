import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const server = await createServer({ root: rootDir, server: { middlewareMode: true } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT', 'fetch']
const previous = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys.slice(0, 7)) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const roots = []
const mount = async (Component, props) => {
  const container = document.createElement('div'); document.body.appendChild(container)
  const root = createRoot(container); roots.push(root)
  await React.act(async () => root.render(React.createElement(Component, props)))
  return container
}
const select = (element, value) => React.act(async () => {
  assert.ok(element); element.value = value; element.dispatchEvent(new dom.Event('change', { bubbles: true }))
})
const click = (element) => React.act(async () => {
  assert.ok(element); element.dispatchEvent(new dom.MouseEvent('click', { bubbles: true }))
})
const input = (element, value) => React.act(async () => {
  assert.ok(element)
  Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype, 'value').set.call(element, String(value))
  element.dispatchEvent(new dom.Event('input', { bubbles: true }))
  element.dispatchEvent(new dom.Event('change', { bubbles: true }))
})

try {
  const { scoringSignalBinding, prepareScoringSignalHistory, scoringSignalModel } = await server.ssrLoadModule('./src/scatter-plot/inspection/scoring-signal-model.ts')
  const { assessCpiScoreV3 } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/CPI/assessment/cpi-score-v3.ts')
  const { assessNfpScoreV2 } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/NFP/assessment/nfp-score-v2.ts')
  const { cpiSignalSettings, nfpSignalSettings } = await server.ssrLoadModule('./src/inspector/scoring/shared/core/signal-magnitude-settings.ts')
  const { cpiMagnitudeFamily } = await server.ssrLoadModule('./src/inspector/magnitude/magnitude-families.ts')
  const { MagnitudeCalculationDetails } = await server.ssrLoadModule('./src/scatter-plot/inspection/MagnitudeCalculationDetails.tsx')
  const { MagnitudeScatterPlot } = await server.ssrLoadModule('./src/scatter-plot/plot/MagnitudeScatterPlot.tsx')
  const { ScatterPlotDock } = await server.ssrLoadModule('./src/scatter-plot/index.ts')
  const { CpiScoreV4 } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/CPI/ui/CpiScoreV4.tsx')
  const { NfpScoreV2 } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/NFP/ui/NfpScoreV2.tsx')
  const { exportWorkspace, restoreWorkspace, parseWorkspaceSnapshot } = await server.ssrLoadModule('./src/workspace-portability/workspace-snapshot.ts')
  const fixtures = {}
  for (const familyId of ['us-cpi', 'jobs']) {
    const binding = scoringSignalBinding(familyId)
    const events = Array.from({ length: 43 }, (_, month) => {
      const at = Date.UTC(2015, month + 1, 12, 12, 30), period = Date.UTC(2015, month, 1) / 1000
      return binding.seriesIds.map((id) => {
        const payroll = ['840030016', '840030022', '840030023', '840030032'].includes(id)
        const actual = payroll ? 100 + (month % 4) * 50 : id === '840030020' ? 34 + (month % 3) * .1 :
          id === '840030015' ? 4 + (month % 3) * .1 : id === '840030017' ? 62.3 :
          id === '840030008' ? 3 + (month % 3) * .1 : .1 + (month % 4) * .1
        const prior = payroll ? 150 : id === '840030015' ? 4.3 : actual - .1
        const raw = (value) => String(Math.round(value * 1e6))
        return { value_id: `${period}:${id}`, event_id: id, name: id, currency: 'USD', country_code: 'US', country_name: 'United States',
          event_code: id, server_time_seconds: at / 1000 + 10800, chart_time_seconds: at / 1000 + 10800,
          release_at: at, period_seconds: period, revision: 0, time_mode: 0, importance: 'high', impact: 'none', availability: 'observed',
          unit: payroll ? 4 : id === '840030020' ? 3 : 1, multiplier: payroll ? 1 : 0, digits: payroll ? 0 : 1,
          actual, previous: prior, revised_previous: payroll ? 160 : null, forecast: 9999,
          actual_raw_scaled_1e6: raw(actual), previous_raw_scaled_1e6: raw(prior), revised_previous_raw_scaled_1e6: payroll ? raw(160) : null }
      })
    }).flat()
    const now = Date.UTC(2019, 0, 1), history = prepareScoringSignalHistory(events, now, binding)
    const assess = familyId === 'us-cpi' ? assessCpiScoreV3 : assessNfpScoreV2
    fixtures[familyId] = { binding, events, history, now, assess }
    for (const signal of binding.signals) {
      for (const index of [5, 29, 35, 42]) {
        const release = history[index].release
        const model = scoringSignalModel(history, binding, signal.id, release.id)
        const score = assess(release, events).readings.find((row) => row.id === signal.id)
        for (const key of ['value', 'points', 'limits', 'sampleCount', 'size', 'reason', 'inputs'])
          assert.deepEqual(model.inspection.signal[key], score[key], `${familyId}/${signal.id}/${index}/${key} chart-scoring parity`)
        assert.equal(model.inspection.earlierCount, score.sampleCount)
        assert.ok(model.inspection.samples.some((point) => point.at > release.releaseAt) || index === 42)
        assert.equal(model.inspection.distribution?.count ?? score.sampleCount, score.sampleCount)
        const truncated = history.filter((entry) => entry.release.releaseAt <= release.releaseAt)
        assert.deepEqual(scoringSignalModel(truncated, binding, signal.id, release.id).inspection.signal, model.inspection.signal,
          'Later chart context never changes earlier calibration')
      }
      const override = familyId === 'jobs' && signal.unit === 'thousand jobs' ? [1, 2, 3] : [.001, .002, .003]
      const release = history.at(-1).release, settings = { [signal.id]: override }
      const manual = scoringSignalModel(history, binding, signal.id, release.id, settings).inspection.signal
      const score = assess(release, events, settings).readings.find((row) => row.id === signal.id)
      assert.equal(manual.magnitudeMode, 'custom'); assert.deepEqual(manual.limits, override)
      assert.equal(manual.points, score.points); assert.deepEqual(manual.automaticLimits, score.automaticLimits)
      assert.equal(scoringSignalModel(history, binding, signal.id, history[5].release.id, settings).inspection.signal.points, null,
        'Manual overrides do not bypass minimum-history requirement')
    }
  }
  assert.equal(scoringSignalBinding('us-cpi').label, 'CPI v4.1')
  assert.equal(scoringSignalBinding('ism-services').label, 'ISM Services v3')
  assert.equal(scoringSignalBinding('ism-manufacturing').label, 'ISM Manufacturing v3')
  assert.equal(scoringSignalBinding('pce').label, 'PCE v1'); assert.equal(scoringSignalBinding('fomc'), null)
  console.log('✓ CPI/NFP component parity, publication cutoffs, contextual later dots and manual calibration parity')

  const { binding, events, history, now } = fixtures['us-cpi']
  const selected = history[35].release
  const model = scoringSignalModel(history, binding, 'fresh', selected.id)
  const changed = events.map((event) => event.release_at === selected.releaseAt && event.event_id === '840030006' ?
    { ...event, actual: null, actual_raw_scaled_1e6: null } : event)
  const missingHistory = prepareScoringSignalHistory(changed, now, binding)
  const missing = scoringSignalModel(missingHistory, binding, 'fresh', selected.id)
  assert.equal(missing.inspection.delta, null); assert.equal(missing.inspection.point, null)
  assert.match(missing.inspection.signal.reason, /Requires/)
  assert.ok(missing.points.find((point) => point.at > selected.releaseAt).breakBefore)
  assert.equal(scoringSignalModel(missingHistory, binding, 'fresh', null).inspection.releaseId, history.at(-1).release.id)
  const early = model.points.find((point) => point.signal.points === null)
  assert.ok(early); assert.equal(early.signal.size, null, 'Early derived values can be plotted without pretending to be scored')
  const details = await mount(MagnitudeCalculationDetails, { model, seriesLabel: 'Latest core pace' })
  assert.match(details.textContent, /Actual core m\/m.*Prior three-month average.*Scoring signal.*Automatic/)
  const svg = await mount(MagnitudeScatterPlot, { model, zoom: true, onInspect: () => {} })
  assert.ok(svg.querySelector('[aria-label="Release date versus scoring signal scatter plot"]'))
  assert.match(svg.querySelector('[data-point-id] title').textContent, /earlier-history thresholds; N =/)
  assert.ok(svg.querySelectorAll('[data-cutoff]').length > 0)
  const tied = scoringSignalModel(history, binding, 'annual', selected.id)
  assert.equal(tied.inspection.signal.limits[0], tied.inspection.signal.limits[1], 'Quantiles can legitimately tie')
  assert.ok(tied.inspection.distribution, 'Automatic tied boundaries must render without invented epsilon spacing')
  const unemployment = scoringSignalModel(fixtures.jobs.history, fixtures.jobs.binding, 'unemployment', null)
  assert.equal(unemployment.inspection.delta, .3)
  assert.equal(unemployment.inspection.actual, 4); assert.equal(unemployment.inspection.previous, 4.3)
  console.log('✓ Exact signal/baseline presentation, tied quantiles, inverted unemployment and missing-publication gaps')

  const requests = []
  globalThis.fetch = async (url) => {
    requests.push(String(url))
    if (url === '/storage-api/health') return { ok: true, json: async () => ({ revision: 1, sources: [{ id: 'test-broker', publisher_status: 'live', server_now: now / 1000 }], collector_error: null }) }
    const params = new URL(url, 'http://localhost').searchParams
    return { ok: true, json: async () => ({ source_id: 'test-broker', revision: 1, timestamp_convention: 'trade_server_time', time_basis: 'chart',
      event_ids: params.get('event_ids').split(','), events, coverage: { USD: { missing: [] } }, next_cursor: null }) }
  }
  const target = { brokerId: 'test-broker', familyId: 'us-cpi', releaseId: selected.id, at: selected.releaseAt }
  const dock = await mount(ScatterPlotDock, { brokerId: 'test-broker', clockOffsetMs: now - Date.now(), target })
  const inspector = await mount(CpiScoreV4, { release: selected, events, now, timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 } })
  const nfpInspector = await mount(NfpScoreV2, { release: fixtures.jobs.history.at(-1).release, events: fixtures.jobs.events })
  const before = requests.length
  const inspectorBefore = inspector.textContent
  await select(dock.querySelector('[aria-label="Scatter Plot Measure"]'), 'signal')
  assert.equal(dock.querySelector('.scatter-plot-inspection time').textContent, new Date(selected.releaseAt).toISOString().slice(0, 10))
  assert.equal(dock.querySelector('[aria-label="Scatter Plot Signal"]').options.length, 4)
  await select(dock.querySelector('[aria-label="Signal magnitude mode"]'), 'custom')
  for (const [index, label] of ['Small', 'Medium', 'Large'].entries())
    await input(dock.querySelector(`[aria-label="${label} signal upper boundary"]`), (index + 1) * .001)
  assert.match(dock.textContent, /Unsaved chart preview/)
  assert.equal(inspector.textContent, inspectorBefore, 'Boundary preview never updates Inspector')
  assert.deepEqual(cpiSignalSettings.read(), {})
  await React.act(async () => dock.querySelector('[aria-label="Scoring signal boundaries"]').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.deepEqual(cpiSignalSettings.read(), { fresh: [.001, .002, .003] })
  assert.match(inspector.textContent, /manual override boundaries/)
  assert.notEqual(inspector.textContent, inspectorBefore)
  assert.deepEqual(nfpSignalSettings.read(), {}); assert.doesNotMatch(nfpInspector.textContent, /manual override boundaries/)
  const nfpBefore = nfpInspector.textContent
  await React.act(async () => nfpSignalSettings.save('hiring', [1, 2, 3]))
  assert.match(nfpInspector.textContent, /manual override boundaries/)
  assert.notEqual(nfpInspector.textContent, nfpBefore)
  assert.deepEqual(cpiSignalSettings.read(), { fresh: [.001, .002, .003] }, 'NFP edits cannot change CPI settings')
  assert.deepEqual(cpiMagnitudeFamily.settings.read(), {}, 'Raw A−P boundaries remain untouched')
  await select(dock.querySelector('[aria-label="Scatter Plot Signal"]'), 'trend')
  assert.equal(dock.querySelector('[aria-label="Signal magnitude mode"]').value, 'automatic')
  await select(dock.querySelector('[aria-label="Scatter Plot Signal"]'), 'fresh')
  assert.equal(dock.querySelector('[aria-label="Signal magnitude mode"]').value, 'custom')
  assert.equal(requests.length, before, 'Measure, signal and boundary edits reuse fetched history')

  const snapshot = exportWorkspace()
  assert.deepEqual(JSON.parse(snapshot.entries[cpiSignalSettings.key]), { fresh: [.001, .002, .003] })
  assert.deepEqual(JSON.parse(snapshot.entries[nfpSignalSettings.key]), { hiring: [1, 2, 3] })
  assert.throws(() => parseWorkspaceSnapshot(JSON.stringify({ ...snapshot, entries: { [cpiSignalSettings.key]: JSON.stringify({ fresh: [1, 1, 2] }) } })))
  await React.act(async () => cpiSignalSettings.save('fresh', null))
  assert.equal(inspector.textContent, inspectorBefore)
  await React.act(async () => restoreWorkspace(snapshot))
  assert.match(inspector.textContent, /manual override boundaries/, 'Workspace restore refreshes live scorer subscriptions')
  await click([...dock.querySelectorAll('button')].find((button) => button.textContent === 'Use automatic'))
  assert.deepEqual(cpiSignalSettings.read(), {}); assert.equal(inspector.textContent, inspectorBefore)
  await React.act(async () => nfpSignalSettings.save('hiring', null))
  assert.equal(nfpInspector.textContent, nfpBefore)
  await select(dock.querySelector('[aria-label="Scatter Plot Measure"]'), 'ap')
  assert.ok(dock.querySelector('[aria-label="Scatter Plot Series"]')); assert.equal(dock.querySelector('[aria-label="Scatter Plot Signal"]'), null)
  console.log('✓ Measure/component controls, isolated saved overrides, preview/apply/reset, live Inspector and workspace restoration')
} finally {
  await React.act(async () => { for (const root of roots) root.unmount() })
  await dom.happyDOM.abort(); dom.close()
  for (const key of keys) {
    if (previous[key]) Object.defineProperty(globalThis, key, previous[key])
    else delete globalThis[key]
  }
  await server.close()
}
