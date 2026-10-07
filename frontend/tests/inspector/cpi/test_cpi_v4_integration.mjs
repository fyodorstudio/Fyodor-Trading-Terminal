import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { history, latestRows } from '../../usd-context/fixtures.mjs'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'), server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT', 'fetch', 'Worker']
const previous = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys.slice(0, 7)) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
globalThis.Worker = undefined
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.appendChild(container)
const root = createRoot(container)
const render = (Component, props) => React.act(async () => root.render(React.createElement(Component, props)))
try {
  const { CpiScoreV4 } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/CPI/ui/CpiScoreV4.tsx')
  const { InspectorPanel } = await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  const { groupInspectorReleases, defaultInspectorPreferences, inspectorStorageKey, readInspectorPreferences } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { buildContextTimeline } = await server.ssrLoadModule('./src/usd-context/core/build-context-timeline.ts')
  const { contextPairLabel } = await server.ssrLoadModule('./src/usd-context/core/usd-pair.ts')
  const { compareCpiPublication } = await server.ssrLoadModule('./src/usd-context/core/publication-comparison.ts')
  const { calculateCpiRelease } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/CPI/runtime/cpi-release-analysis.ts')
  const { contextSeriesIds } = await server.ssrLoadModule('./src/usd-context/core/score-publication.ts')
  const preferences = await server.ssrLoadModule('./src/usd-context/storage/context-family-settings.ts')
  const { cpiSignalSettings, claimsSignalSettings } = await server.ssrLoadModule('./src/inspector/scoring/shared/core/signal-magnitude-settings.ts')
  const { exportWorkspace, restoreWorkspace } = await server.ssrLoadModule('./src/workspace-portability/workspace-snapshot.ts')
  const events = [...history, ...latestRows], now = Date.UTC(2018, 7, 1)
  const release = groupInspectorReleases(latestRows).find(r => r.familyId === 'us-cpi')
  const props = { release, brokerId: null, events, now, timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 } }
  await render(CpiScoreV4, props)
  assert.match(container.querySelector('[aria-label="CPI v4 standalone direction"]').textContent, /EURUSD (Long|Short)/)
  assert.match(container.querySelector('[aria-label="CPI v4 combined direction"]').textContent, /EURUSD (Long|Short)/)
  assert.ok(container.querySelector('[aria-label="CPI v4 previous context"]'))
  assert.match(container.querySelector('[aria-label="CPI v4 context change"]').textContent, /replaces the previous CPI vote/)
  assert.equal(container.querySelectorAll('[aria-label="CPI v4 standalone component scores"] tbody tr').length, 4)
  assert.equal(container.querySelectorAll('[aria-label="CPI v4 context inputs"] tbody tr').length, 8)
  assert.equal(container.querySelector('details, summary'), null)
  const standaloneLabel = container.querySelector('[aria-label="CPI v4 standalone direction"]').textContent
  if (!container.querySelector('[aria-label="Use CPI v4"]')) await React.act(async () => container.querySelector('[aria-label="Advanced USD input settings"]').click())
  await React.act(async () => container.querySelector('[aria-label="Use CPI v4"]').click())
  assert.equal(preferences.readContextFamilies().includes('cpi'), false)
  assert.equal(container.querySelector('[aria-label="CPI v4 standalone direction"]').textContent, standaloneLabel)
  assert.match(container.querySelector('[aria-label="CPI v4 context change"]').textContent, /CPI is Off/)
  await React.act(async () => preferences.saveContextFamilies([]))
  assert.equal(container.querySelector('[aria-label="CPI v4 standalone direction"]').textContent, standaloneLabel)
  assert.match(container.textContent, /Enable a context input/)
  await React.act(async () => preferences.saveContextFamilies(['cpi', 'nfp', 'claims', 'ism', 'retail']))

  const prefs = { ...defaultInspectorPreferences(), detailView: 'scoring-v4' }
  let saved, opened
  const view = { selectedRelease: release, preferences: prefs, supported: true, now,
    brokerTime: false, brokerId: null, brokerOffsetSeconds: 0, range: { from: release.releaseAt - 1000, to: release.releaseAt + 1000 },
    rangePreset: 'custom', rangeDates: { from: '2018-06-12', to: '2018-06-12' }, customFrom: '2018-06-12', customTo: '2018-06-12',
    releases: [release], allReleases: groupInspectorReleases(events), magnitudeHistory: { rows: {}, partial: false },
    storage: { loading: false, error: null, coverage: {}, source: null }, selectRelease() {}, selectCustomRange() {},
    applyPreferences(next) { saved = next }, setRangePreset() {}, setCustomFrom() {}, setCustomTo() {} }
  const panelProps = { view, symbol: 'EURUSD.a', source: null, error: null, timeDisplay: props.timeDisplay, onOpenScatter(r) { opened = r } }
  await render(InspectorPanel, panelProps)
  const dropdown = container.querySelector('[aria-label="Inspector view"]')
  assert.equal(dropdown.value, 'scoring')
  assert.equal(dropdown.options.length, 3)
  assert.match(dropdown.selectedOptions[0].textContent, /CPI v4/)
  assert.equal(dropdown.querySelector('[value="scoring-v3"]'), null)
  await React.act(async () => { dropdown.value = 'scatter'; dropdown.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.equal(opened.id, release.id); assert.equal(saved, undefined)
  await React.act(async () => { dropdown.value = 'scoring'; dropdown.dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.equal(saved.detailView, 'scoring')
  await render(InspectorPanel, { ...panelProps, view: { ...view, selectedRelease: { ...release, familyId: 'jobs' } } })
  assert.equal(container.querySelector('[value="scoring-v4"]'), null)
  localStorage.setItem(inspectorStorageKey, JSON.stringify(prefs))
  const workspace = exportWorkspace(); localStorage.clear(); restoreWorkspace(workspace)
  assert.equal(readInspectorPreferences().detailView, 'scoring')
  console.log('✓ CPI v4 flat dual interpretation, shared toggles/all-off independence, latest-only menu, saved-version migration/Scatter compatibility and portable preferences')

  await React.act(async () => root.render(null))
  const workers = [], requests = []
  globalThis.Worker = class { jobs = []; terminated = false; constructor() { workers.push(this) } postMessage(job) { this.jobs.push(job) } terminate() { this.terminated = true } }
  globalThis.fetch = async url => {
    requests.push(String(url))
    if (url.endsWith('/health')) return { ok: true, json: async () => ({ revision: 1, sources: [{ id: 'v4-broker', server_now: now / 1000 }], collector_error: null }) }
    const params = new URL(url, 'http://localhost').searchParams
    assert.deepEqual(params.get('event_ids').split(',').sort(), [...contextSeriesIds].sort())
    assert.equal(params.get('time_basis'), 'chart')
    return { ok: true, json: async () => ({ source_id: 'v4-broker', revision: 1, time_basis: 'chart', timestamp_convention: 'trade_server_time',
      event_ids: contextSeriesIds, events, coverage: {}, next_cursor: null }) }
  }
  const storedProps = { ...props, brokerId: 'v4-broker', events: [] }
  await render(CpiScoreV4, storedProps)
  assert.equal(workers.length, 2)
  let contextWorker = workers.find(w => w.jobs[0]?.input.families), cpiWorker = workers.find(w => w.jobs[0]?.input.release)
  const reply = async (worker, job = worker.jobs.at(-1)) => React.act(async () => worker.onmessage({ data: { id: job.id,
    result: job.input.release ? calculateCpiRelease(job.input) : buildContextTimeline(job.input) } }))
  await reply(contextWorker); await reply(cpiWorker)
  const comparison = compareCpiPublication(buildContextTimeline(contextWorker.jobs[0].input), release, now)
  assert.equal(container.querySelector('[aria-label="CPI v4 combined direction"]').textContent, contextPairLabel('EURUSD', comparison.after.result.direction))
  const previousRelease = groupInspectorReleases(history).findLast(r => r.familyId === 'us-cpi')
  await render(CpiScoreV4, { ...storedProps, release: previousRelease, now: now + 1000 })
  assert.equal(contextWorker.jobs.length, 1, 'Selecting another historical CPI reuses the context timeline')
  assert.equal(cpiWorker.jobs.length, 2)
  assert.equal(container.querySelector('[aria-label="CPI v4 standalone direction"]').textContent, 'Uncomputed', 'Stale selected-release results are hidden')
  await reply(cpiWorker, cpiWorker.jobs[0])
  assert.equal(container.querySelector('[aria-label="CPI v4 standalone direction"]').textContent, 'Uncomputed')
  await reply(cpiWorker)
  const requestCount = requests.length
  await render(CpiScoreV4, { ...storedProps, release: previousRelease, now: now + 2000 })
  assert.equal(contextWorker.jobs.length, 1); assert.equal(cpiWorker.jobs.length, 2)
  await React.act(async () => claimsSignalSettings.save('initial-trend', [1, 2, 3]))
  contextWorker = workers.filter(w => w.jobs[0]?.input.families).at(-1)
  assert.equal(workers.length, 3); assert.equal(contextWorker.jobs.length, 1); assert.equal(cpiWorker.jobs.length, 2)
  await reply(contextWorker)
  await React.act(async () => cpiSignalSettings.save('fresh', [.01, .02, .03]))
  contextWorker = workers.filter(w => w.jobs[0]?.input.families).at(-1)
  assert.equal(workers.length, 4); assert.equal(contextWorker.jobs.length, 1); assert.equal(cpiWorker.jobs.length, 3)
  assert.equal(requests.length, requestCount, 'Magnitude edits cannot reload the calendar')
  await reply(contextWorker); await reply(cpiWorker)
  await React.act(async () => preferences.saveContextFamilies([]))
  assert.equal(contextWorker.terminated, true); assert.equal(cpiWorker.terminated, false)
  assert.match(container.querySelector('[aria-label="CPI v4 standalone direction"]').textContent, /EURUSD/)
  await React.act(async () => root.render(null))
  assert.ok(workers.every(w => w.terminated))
  console.log('✓ CPI v4 scoped storage/background workers, exact Raycaster parity, selection/heartbeat reuse, applied settings, stale replies and cleanup')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
