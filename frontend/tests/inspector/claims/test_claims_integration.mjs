import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'
import { reading, history, ids } from './fixtures.mjs'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'), server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT', 'fetch', 'Worker']
const previous = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys.slice(0, 7)) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const roots = []
const mount = (Component, props) => {
  const container = document.createElement('div'); document.body.appendChild(container)
  const root = createRoot(container); roots.push(root)
  return { container, root, render: (next = props) => React.act(async () => root.render(React.createElement(Component, next))) }
}
const choose = (element, value) => React.act(async () => { assert.ok(element); element.value = value; element.dispatchEvent(new dom.Event('change', { bubbles: true })) })
const click = element => React.act(async () => { assert.ok(element); element.click() })
const input = (element, value) => React.act(async () => {
  Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype, 'value').set.call(element, String(value))
  element.dispatchEvent(new dom.Event('input', { bubbles: true })); element.dispatchEvent(new dom.Event('change', { bubbles: true }))
})
try {
  const { ClaimsScore } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/CLAIMS/ui/ClaimsScore.tsx')
  const { calculateClaimsAnalysis } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/CLAIMS/runtime/claims-analysis.ts')
  const { InspectorPanel } = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  const { groupInspectorReleases, defaultInspectorPreferences } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { inspectorScoringBinding } = await server.ssrLoadModule('./src/inspector/scoring/scoring-registry.ts')
  const { ScatterPlotDock } = await server.ssrLoadModule('./src/scatter-plot/index.ts')
  const { claimsSignalSettings, legacyClaimsSignalSettings, cpiSignalSettings, pceSignalSettings } = await server.ssrLoadModule('./src/inspector/scoring/shared/core/signal-magnitude-settings.ts')
  const { magnitudeFamilies } = await server.ssrLoadModule('./src/inspector/magnitude/magnitude-families.ts')
  const { exportWorkspace, restoreWorkspace, parseWorkspaceSnapshot } = await server.ssrLoadModule('./src/workspace-portability/workspace-snapshot.ts')
  const rows = reading(52, [220, 1.82, 220]), events = [...history, ...rows]
  const release = groupInspectorReleases(rows)[0], now = Date.UTC(2026, 8, 1)
  assert.equal(inspectorScoringBinding('EURUSD.a', release).familyId, 'claims')
  assert.equal(inspectorScoringBinding('GBPUSD', release), null)
  const app = mount(ClaimsScore, { release, events, history: {} }); await app.render()
  await React.act(async () => legacyClaimsSignalSettings.save('initial-trend', [.001, .002, .003]))
  assert.deepEqual(claimsSignalSettings.read(), {}, 'V1 custom cutoffs cannot silently grade new V2 features')
  assert.match(app.container.textContent, /Scoring system v2/)
  assert.ok(app.container.querySelector('[aria-label="Jobless Claims level context"]'))
  assert.equal(app.container.querySelector('[aria-label="Jobless Claims pair direction"]').textContent, 'EURUSD Long')
  assert.equal(app.container.querySelectorAll('details').length, 0)
  assert.equal(app.container.querySelectorAll('[aria-label="Jobless Claims component scores"] tbody tr').length, 3)
  assert.match(app.container.textContent, /benefit eligibility/)
  const prefs = { ...defaultInspectorPreferences(), detailView: 'scoring' }
  let saved, opened
  const view = { supported: true, selectedRelease: release, preferences: prefs, brokerId: null, now, brokerTime: false,
    releases: [release], allReleases: groupInspectorReleases(events), range: { from: release.releaseAt - 86400000, to: release.releaseAt + 86400000 },
    storage: { coverage: {}, loading: false, error: null, source: null }, magnitudeHistory: { rows: {}, loading: false, error: null, coverageMissing: false }, selectRelease() {},
    rangeDates: { from: '2026-08-01', to: '2026-08-31' }, rangePreset: 'custom', setRangePreset() {},
    customFrom: '2026-08-01', customTo: '2026-08-31', setCustomFrom() {}, setCustomTo() {}, selectCustomRange() {},
    applyPreferences(next) { saved = next }, brokerOffsetSeconds: 0 }
  const props = { view, symbol: 'EURUSD.a', source: null, error: null, timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 }, onOpenScatter(selected) { opened = selected } }
  const panel = mount(InspectorPanel, props); await panel.render()
  const dropdown = panel.container.querySelector('[aria-label="Inspector view"]')
  assert.equal(dropdown.value, 'scoring'); assert.equal(dropdown.querySelector('[value="scoring"]').disabled, false)
  assert.equal(panel.container.querySelector('[aria-label="Jobless Claims pair direction"]').textContent, 'EURUSD Long')
  assert.equal(panel.container.querySelectorAll('.inspector-scoring-view').length, 2)
  await choose(dropdown, 'scatter'); assert.equal(opened.id, release.id); assert.equal(saved, undefined)
  await choose(dropdown, 'table'); assert.equal(saved.detailView, 'table')
  await panel.render({ ...props, view: { ...view, preferences: { ...prefs, detailView: 'scoring-v3' } } })
  assert.equal(panel.container.querySelector('[aria-label="Inspector view"]').value, 'scoring')
  await panel.render({ ...props, symbol: 'GBPUSD', view: { ...view, supported: false } })
  assert.equal(panel.container.querySelector('[aria-label="Jobless Claims pair direction"]'), null)

  const paths = []
  globalThis.fetch = async url => {
    paths.push(String(url))
    if (url.endsWith('/health')) return { ok: true, json: async () => ({ revision: 1, collector_error: null,
      sources: [{ id: 'claims-broker', publisher_status: 'live', server_now: now / 1000 }] }) }
    const params = new URL(url, 'http://localhost').searchParams
    assert.equal(params.get('currency'), 'USD'); assert.equal(params.get('time_basis'), 'chart')
    assert.deepEqual(params.get('event_ids').split(',').sort(), [...ids].sort())
    return { ok: true, json: async () => ({ source_id: 'claims-broker', revision: 1, timestamp_convention: 'trade_server_time', time_basis: 'chart',
      event_ids: ids, events, coverage: { USD: { missing: [] } }, next_cursor: null }) }
  }
  const stored = mount(ClaimsScore, { release, events: [], brokerId: 'claims-broker', history: {} }); await stored.render()
  assert.equal(stored.container.querySelector('[aria-label="Jobless Claims pair direction"]').textContent, 'EURUSD Long')
  const target = { brokerId: 'claims-broker', familyId: 'claims', releaseId: release.id, at: release.releaseAt }
  const dock = mount(ScatterPlotDock, { brokerId: 'claims-broker', clockOffsetMs: now - Date.now(), target }); await dock.render()
  const requestsBeforeEdits = paths.length
  await choose(dock.container.querySelector('[aria-label="Scatter Plot Measure"]'), 'signal')
  assert.equal(dock.container.querySelector('[aria-label="Scatter Plot Signal"]').options.length, 3)
  const beforePreview = app.container.textContent
  await choose(dock.container.querySelector('[aria-label="Signal magnitude mode"]'), 'custom')
  for (const [index, name] of ['Small', 'Medium', 'Large'].entries()) await input(dock.container.querySelector(`[aria-label="${name} signal upper boundary"]`), (index + 1) * .001)
  assert.equal(app.container.textContent, beforePreview)
  await React.act(async () => dock.container.querySelector('[aria-label="Scoring signal boundaries"]').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })))
  assert.deepEqual(claimsSignalSettings.read(), { 'initial-trend': [.001, .002, .003] })
  assert.match(app.container.textContent, /manual override boundaries/)
  assert.deepEqual(cpiSignalSettings.read(), {}); assert.deepEqual(pceSignalSettings.read(), {})
  assert.deepEqual(magnitudeFamilies.find(f => f.familyId === 'claims').settings.read(), {})
  assert.equal(paths.length, requestsBeforeEdits)
  const workspace = exportWorkspace()
  assert.deepEqual(JSON.parse(workspace.entries[claimsSignalSettings.key]), { 'initial-trend': [.001, .002, .003] })
  assert.throws(() => parseWorkspaceSnapshot(JSON.stringify({ ...workspace, entries: { [claimsSignalSettings.key]: '{"wrong":[1,2,3]}' } })))
  await React.act(async () => claimsSignalSettings.save('initial-trend', null))
  assert.equal(app.container.textContent, beforePreview)
  await React.act(async () => restoreWorkspace(workspace))
  assert.match(app.container.textContent, /manual override boundaries/)
  await click([...dock.container.querySelectorAll('button')].find(button => button.textContent === 'Use automatic'))
  assert.equal(app.container.textContent, beforePreview)
  console.log('✓ Claims Inspector menu/flat view, scoped inventory, plotted controls, preview/apply/reset and portable live settings')

  await React.act(async () => { for (const root of roots.splice(0)) root.unmount() })
  const workers = []
  globalThis.Worker = class {
    jobs = []; terminated = false
    constructor() { workers.push(this) }
    postMessage(job) { this.jobs.push(job) }
    terminate() { this.terminated = true }
  }
  const workerProps = { release, events, history: {} }, workerView = mount(ClaimsScore, workerProps)
  await workerView.render(); assert.equal(workers.length, 1); assert.equal(workers[0].jobs.length, 1)
  assert.match(workerView.container.textContent, /Calculating/)
  const job = workers[0].jobs[0]
  await React.act(async () => workers[0].onmessage({ data: { id: job.id, result: calculateClaimsAnalysis(job.input) } }))
  assert.match(workerView.container.textContent, /EURUSD Long/)
  await workerView.render({ ...workerProps })
  assert.equal(workers[0].jobs.length, 1, 'Unchanged release/history must not rescore on parent rerenders')
  await React.act(async () => claimsSignalSettings.save('initial-trend', [.001, .002, .003]))
  assert.equal(workers[0].jobs.length, 2)
  assert.equal(workerView.container.querySelector('[aria-label="Jobless Claims pair direction"]').textContent, 'Uncomputed', 'Stale results are hidden during recalculation')
  await React.act(async () => workers[0].onmessage({ data: { id: job.id, result: calculateClaimsAnalysis(job.input) } }))
  assert.match(workerView.container.textContent, /Calculating/, 'Superseded replies must be ignored')
  await React.act(async () => workers[0].onerror({}))
  assert.match(workerView.container.textContent, /Background calculation failed/)
  assert.equal(workerView.container.querySelector('[aria-label="Jobless Claims pair direction"]').textContent, 'Uncomputed')
  await React.act(async () => { for (const root of roots.splice(0)) root.unmount() })
  assert.equal(workers[0].terminated, true)
  console.log('✓ Claims worker reuse, live settings invalidation, stale reply rejection, failure disclosure and cleanup')
} finally {
  await React.act(async () => { for (const root of roots) root.unmount() })
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
