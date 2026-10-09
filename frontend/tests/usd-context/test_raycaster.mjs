import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'
import { settings, history, latestRows } from './fixtures.mjs'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT', 'fetch', 'Worker', 'ResizeObserver']
const previous = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
for (const key of keys.slice(0, 7)) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const workers = [], requests = [], frames = new Map()
let nextFrame = 0, handler, unsubscribed = 0, subscribed = 0, closed = 0
dom.requestAnimationFrame = callback => { frames.set(++nextFrame, callback); return nextFrame }
dom.cancelAnimationFrame = id => frames.delete(id)
globalThis.ResizeObserver = class { observe() {} disconnect() {} }
globalThis.Worker = class {
  jobs = []; terminated = false
  constructor() { workers.push(this) }
  postMessage(job) { this.jobs.push(job) }
  terminate() { this.terminated = true }
}
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.appendChild(container)
const root = createRoot(container)
const series = {}, chart = { subscribeCrosshairMove: callback => { handler = callback; subscribed++ }, unsubscribeCrosshairMove: () => { unsubscribed++ }, timeScale: () => ({ getVisibleRange: () => null,
  width: () => 500, subscribeVisibleLogicalRangeChange() {}, unsubscribeVisibleLogicalRangeChange() {}, subscribeSizeChange() {}, unsubscribeSizeChange() {} }) }
const tick = async () => React.act(async () => { for (const [id, callback] of frames) { frames.delete(id); callback() } })
try {
  const { Raycaster } = await server.ssrLoadModule('./src/raycaster/Raycaster.tsx')
  const { buildContextTimeline } = await server.ssrLoadModule('./src/usd-context/core/build-context-timeline.ts')
  const { contextSeriesIds } = await server.ssrLoadModule('./src/usd-context/core/score-publication.ts')
  const { FloatingDrawingToolbar } = await server.ssrLoadModule('./src/market-data/chart-drawings/FloatingDrawingToolbar.tsx')
  const { ChartWorkspaceHeader } = await server.ssrLoadModule('./src/terminal-shell/ChartWorkspaceHeader.tsx')
  const { ContextViewControls } = await server.ssrLoadModule('./src/terminal-shell/chart-overlays/ContextViewControls.tsx')
  const { defaultInspectorPreferences } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { exportWorkspace, parseWorkspaceSnapshot, restoreWorkspace } = await server.ssrLoadModule('./src/workspace-portability/workspace-snapshot.ts')
  const preference = await server.ssrLoadModule('./src/raycaster/storage/raycaster-preferences.ts')
  const familySettings = await server.ssrLoadModule('./src/raycaster/storage/raycaster-family-settings.ts')
  const sequence = await server.ssrLoadModule('./src/usd-context/sequences/storage/sequence-preferences.ts')
  const { nfpSignalSettings } = await server.ssrLoadModule('./src/inspector/scoring/shared/core/signal-magnitude-settings.ts')
  const events = [...history, ...latestRows]
  globalThis.fetch = async (url, options) => {
    requests.push({ url, signal: options?.signal })
    const broker = url.includes('/calendar?') ? new URL('http://localhost' + url).searchParams.get('source_id') : 'Broker-A'
    return { ok: true, json: async () => url.endsWith('/health') ? { revision: 1, sources: ['Broker-A', 'Broker-B'].map(id => ({ id, server_now: 1, coverage: {} })) } :
      { source_id: broker, revision: 1, time_basis: 'chart', timestamp_convention: 'trade_server_time', event_ids: contextSeriesIds,
        events, coverage: {}, next_cursor: null } }
  }
  const props = { chartApi: chart, seriesApi: series, symbol: 'EURUSD', timeframe: 'H1', brokerId: 'Broker-A',
    brokerOffsetSeconds: 10800, clockOffsetMs: Date.UTC(2018, 7, 1) - Date.now(),
    timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 }, onClose: () => { closed++ } }
  const render = (next = props) => React.act(async () => root.render(React.createElement(React.Fragment, null,
    React.createElement(ContextViewControls, { ...next, supported: true, raycasterVisible: next.boxVisible !== false, onToggleRaycaster: next.onClose }),
    React.createElement(Raycaster, next))))
  await render()
  assert.equal(workers.length, 1); assert.equal(workers[0].jobs.length, 1)
  assert.match(container.textContent, /Calculating USD context/)
  const job = workers[0].jobs[0]
  const canonicalTimeline = buildContextTimeline(job.input)
  await React.act(async () => workers[0].onmessage({ data: { id: job.id, result: canonicalTimeline } }))
  assert.match(container.textContent, /Hover a candle/)
  const initialSubscriptions = subscribed
  await render({ ...props, boxVisible: false })
  assert.equal(container.querySelector('.raycaster-bias'), null, 'The hover box can be hidden while the shared context controller remains mounted')
  assert.equal(unsubscribed, initialSubscriptions, 'Hidden hover box removes its crosshair listener')
  assert.equal(workers[0].jobs.length, 1, 'Independent visibility does not rebuild the timeline')
  await render(props)
  assert.equal(subscribed, initialSubscriptions + 1)
  const roof = canonicalTimeline.relationships.episodes.find(e => e.kind === 'release-relationship')
  assert.ok(roof)
  const savedView = localStorage.getItem(preference.raycasterVisibleKey)
  const selectedProps = { ...props, boxVisible: false, selectedCombo: roof, bars: [] }
  await render(selectedProps)
  assert.equal(container.querySelector('.raycaster-box'), null, 'Selecting a roof leaves Raycaster hidden')
  assert.equal(container.querySelector('[aria-label^="Roof Candy"]'), null, 'A selected combo respects Candy off')
  await React.act(async () => sequence.saveSequencePreferences({ ...sequence.readSequencePreferences(), ribbon: true }))
  assert.ok(container.querySelector('[aria-label^="Roof Candy"]'))
  assert.ok(container.querySelector('[aria-label^="Raycaster Candy"]'), 'The master switch shows both configured strips')
  assert.equal(workers[0].jobs.length, 1, 'Selecting a roof projects existing history without another scoring job')
  assert.equal(localStorage.getItem(preference.raycasterVisibleKey), savedView, 'Selecting a roof does not change saved Raycaster visibility')
  await React.act(async () => sequence.saveSequencePreferences({ ...sequence.readSequencePreferences(), roofCandy: false }))
  assert.equal(container.querySelector('[aria-label^="Roof Candy"]'), null)
  const otherRoof = canonicalTimeline.relationships.episodes.find(e => e.id !== roof.id)
  assert.ok(otherRoof)
  await render({ ...selectedProps, selectedCombo: otherRoof })
  assert.equal(container.querySelector('[aria-label^="Roof Candy"]'), null, 'A new combo respects the configured Roof Candy visibility')
  await render(selectedProps)
  assert.equal(container.querySelector('[aria-label^="Roof Candy"]'), null)
  await React.act(async () => sequence.saveSequencePreferences({ ...sequence.readSequencePreferences(), roofCandy: true, raycasterCandy: false }))
  await render(selectedProps)
  assert.ok(container.querySelector('[aria-label^="Roof Candy"]'))
  assert.equal(container.querySelector('[aria-label^="Raycaster Candy"]'), null, 'The two Candy configuration choices are independent')
  await React.act(async () => sequence.saveSequencePreferences({ ...sequence.readSequencePreferences(), ribbon: false }))
  await render({ ...selectedProps, selectedCombo: otherRoof })
  assert.equal(container.querySelector('[aria-label^="Roof Candy"]'), null, 'Selecting another combo cannot override the master switch')
  await React.act(async () => sequence.saveSequencePreferences({ ...sequence.readSequencePreferences(), ribbon: true, raycasterCandy: true }))
  await render({ ...selectedProps, boxVisible: true })
  assert.ok(container.querySelector('[aria-label="Accumulated context"]'), 'Opening Raycaster normally starts with Context')
  assert.equal(container.querySelector('[aria-label="Selected roof snapshot"]'), null)
  assert.match(container.querySelector('.raycaster-bias').getAttribute('aria-label'), /Hover a candle/, 'A combo does not substitute its activation clock for the chart clock')
  await render({ ...selectedProps, boxVisible: true, view: 'combo', selectedCombo: { ...roof, after: { ...roof.after, total: 123 } } })
  assert.match(container.querySelector('[aria-label="Selected roof snapshot"]').textContent, /Inputs or history changed/)
  assert.equal(workers[0].jobs.length, 1)
  let clearedCombo = 0
  await render({ ...selectedProps, boxVisible: true, view: 'combo', onClearCombo: () => clearedCombo++ })
  const closeCount = closed
  await React.act(async () => container.querySelector('.raycaster-box [aria-label="Hide Raycaster"]').click())
  assert.equal(closed, closeCount + 1)
  assert.equal(clearedCombo, 0, 'Closing Raycaster leaves the selected combo intact')
  await render(selectedProps)
  assert.ok(container.querySelector('[aria-label^="Roof Candy"]'), 'Roof Candy stays visible when the box closes')
  assert.equal(container.querySelector('.raycaster-box'), null)
  closed = closeCount
  await render({ ...props, boxVisible: false })
  assert.equal(container.querySelector('[aria-label="Selected roof snapshot"]'), null)
  assert.equal(container.querySelector('[aria-label^="Roof Candy"]'), null)
  await render(props)
  const { NotebookContextCapture } = await server.ssrLoadModule('./src/trader-notebook/workflow/NotebookContextCapture.tsx')
  const captureContainer = document.createElement('div'); document.body.append(captureContainer)
  const captureRoot = createRoot(captureContainer)
  let contextRecord = null
  try {
    const requestCount = requests.length
    await React.act(async () => captureRoot.render(React.createElement(NotebookContextCapture, { symbol: props.symbol,
      scope: { brokerId: props.brokerId, brokerOffsetSeconds: props.brokerOffsetSeconds, clockOffsetMs: props.clockOffsetMs }, onRecord: record => { contextRecord = record } })))
    assert.equal(requests.length, requestCount, 'Opening Notebook does not request a second history')
    await React.act(async () => captureContainer.querySelector('button').click())
    assert.equal(workers.length, 1, 'Notebook current-context capture shares Raycaster’s calculation job')
    assert.equal(workers[0].jobs.length, 1)
    assert.match(captureContainer.textContent, /Insufficient context/, 'Expired primaries must not leak a raw directional output into Notebook')
    await React.act(async () => captureContainer.querySelector('button').click())
    assert.equal(contextRecord.mode, 'usd')
    assert.equal(contextRecord.symbol, props.symbol)
    assert.equal(contextRecord.broker, props.brokerId)
    assert.match(contextRecord.version, /v8/)
    assert.match(contextRecord.version, /USD presentation v1/)
    assert.equal(contextRecord.asOf, contextRecord.recordedAt + props.brokerOffsetSeconds * 1000)
    assert.equal(contextRecord.label, 'Insufficient context')
    assert.ok(contextRecord.inputs.includes('USD:cpi'))
  } finally { await React.act(async () => captureRoot.unmount()); captureContainer.remove() }
  const selected = latestRows.find(e => e.event_id === '840030008')
  const open = Math.floor(selected.chart_time_seconds / 3600) * 3600
  await React.act(async () => { for (let i = 0; i < 200; i++) handler({ time: open, point: { x: i, y: 5 }, seriesData: new Map([[series, {}]]) }) })
  assert.equal(frames.size, 1, 'Pointer events must coalesce into one frame')
  await tick()
  assert.match(container.querySelector('.raycaster-bias').getAttribute('aria-label'), /EURUSD.*(Aligned|Conflicted).*(Long|Short)/)
  assert.doesNotMatch(container.textContent, /Latest update:/)
  assert.match(container.querySelector('.raycaster-clock').textContent, /candle end/)
  assert.match(container.textContent, /Context update/)
  assert.equal(workers[0].jobs.length, 1, 'Hovering must not dispatch any scoring work')
  await render({ ...props, boxVisible: false })
  await render(props)
  assert.match(container.textContent, /Hover a candle/, 'Reopening the hover box cannot revive an old candle')
  await React.act(async () => handler({ time: open, point: { x: 1, y: 5 }, seriesData: new Map([[series, {}]]) }))
  await tick()
  await React.act(async () => {
    const view = container.querySelector('[aria-label="Raycaster view"]')
    view.value = 'context-detailed'; view.dispatchEvent(new dom.Event('change', { bubbles: true }))
  })
  assert.ok(container.querySelector('.raycaster-box-detailed'))
  assert.equal(workers[0].jobs.length, 1, 'Changing Raycaster view must not launch scoring work')
  const gear = container.querySelector('button[aria-label="Fundamental tools settings"]')
  await React.act(async () => gear.click())
  const details = container.querySelector('[role="dialog"]')
  assert.ok(details); assert.equal(gear.getAttribute('aria-expanded'), 'true')
  assert.equal(document.activeElement, details)
  assert.equal(details.querySelector('table'), null, 'Fundamental settings contain no calculation tables')
  const detailedBox = container.querySelector('.raycaster-box-detailed')
  const inputRow = name => [...detailedBox.querySelectorAll('.context-input-card')].find(card => card.querySelector('h4').textContent.startsWith(name))
  for (const [name, weight] of [['CPI v4', '28%'], ['NFP v2', '30%'], ['Claims v2', '10%'], ['ISM v3', '10%'], ['Retail Sales v1', '7%']]) {
    assert.equal(inputRow(name).querySelector('[data-field="weight"]').textContent, weight)
    assert.match(inputRow(name).textContent, /Enabled/)
    assert.equal(inputRow(name).querySelector('button'), null, 'Contribution rows are read-only')
    assert.match(inputRow(name).textContent, /EURUSD (Long|Short)/)
    assert.match(inputRow(name).querySelector('.context-input-details').textContent, /Calculation.* ×/)
  }
  assert.match(inputRow('CPI v4').textContent, /Standalone engine v3.2/)
  assert.match(detailedBox.querySelector('.context-input-total').textContent, /100%.*EURUSD.*(Aligned|Conflicted).*(Long|Short)/)
  assert.match(details.textContent, /Inspector’s marker filters do not affect/)
  for (const [name, weight] of [['PCE v1', '10%'], ['PPI v1', '2%'], ['GDP v1', '3%']]) {
    assert.equal(inputRow(name).querySelector('[data-field="weight"]').textContent, weight)
    assert.match(inputRow(name).textContent, /No history/)
  }
  assert.match(detailedBox.textContent, /45 days/)
  assert.match(detailedBox.textContent, /Forecasts are excluded/)
  assert.equal(workers[0].jobs.length, 1, 'Opening details must not recalculate')
  assert.equal(details.querySelector('[aria-label="Use CPI v4.1"]'), null, 'Input editing starts hidden')
  const advanced = details.querySelector('[aria-label="Advanced USD input settings"]')
  await React.act(async () => advanced.click())
  assert.equal(advanced.getAttribute('aria-expanded'), 'true')
  assert.ok(details.querySelector('[aria-label="Use CPI v4.1"]'))
  assert.equal(workers[0].jobs.length, 1, 'Opening advanced settings must not recalculate')
  await React.act(async () => advanced.click())
  assert.equal(details.querySelector('[aria-label="Use CPI v4.1"]'), null)

  await React.act(async () => handler({ time: open, point: undefined, seriesData: new Map() }))
  await tick()
  assert.equal(container.querySelector('[aria-label="Raycaster view"]').value, 'context-detailed')
  assert.match(container.querySelector('.raycaster-bias').getAttribute('aria-label'), /EURUSD.*(Aligned|Conflicted).*(Long|Short)/)
  assert.equal(workers[0].jobs.length, 1, 'Holding a candle while inspecting details must not rescore')
  await React.act(async () => details.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.equal(container.querySelector('[role="dialog"]'), null)
  assert.equal(document.activeElement, gear)
  assert.match(container.querySelector('.raycaster-bias').getAttribute('aria-label'), /EURUSD.*(Aligned|Conflicted).*(Long|Short)/, 'Closing settings keeps the last chart reading available for the box controls')
  await React.act(async () => gear.click())
  await React.act(async () => document.body.dispatchEvent(new dom.PointerEvent('pointerdown', { bubbles: true })))
  assert.equal(container.querySelector('[role="dialog"]'), null)
  await React.act(async () => handler({ time: open, point: { x: 1, y: 5 }, seriesData: new Map([[series, {}]]) }))
  await tick()
  await React.act(async () => {
    localStorage.setItem('fyodor.inspector.eurusd.v1', JSON.stringify({ ...defaultInspectorPreferences(), families: [] }))
    window.dispatchEvent(new dom.StorageEvent('storage', { key: null }))
  })
  assert.equal(workers[0].jobs.length, 1, 'Inspector filters cannot change Raycaster inputs')
  assert.deepEqual(familySettings.readRaycasterFamilies(), ['cpi', 'nfp', 'claims', 'pce', 'ism', 'retail', 'gdp', 'ppi'])
  const count = requests.length
  await render({ ...props, symbol: 'USDJPY' })
  assert.match(container.querySelector('.raycaster-bias').getAttribute('aria-label'), /Hover a candle/, 'Pair changes clear the held candle')
  await React.act(async () => handler({ time: open, point: { x: 1, y: 5 }, seriesData: new Map([[series, {}]]) }))
  await tick()
  assert.match(container.querySelector('.raycaster-bias').getAttribute('aria-label'), /USDJPY.*(Aligned|Conflicted).*(Long|Short)/)
  assert.equal(requests.length, count); assert.equal(workers[0].jobs.length, 1, 'Pair inversion reuses the USD timeline')
  await render({ ...props, clockOffsetMs: props.clockOffsetMs + 3000 })
  assert.match(container.querySelector('.raycaster-bias').getAttribute('aria-label'), /Hover a candle/)
  await React.act(async () => handler({ time: open, point: { x: 1, y: 5 }, seriesData: new Map([[series, {}]]) }))
  await tick()
  assert.equal(requests.length, count); assert.equal(workers[0].jobs.length, 1, 'Clock ticks between publications must reuse the timeline')
  await render({ ...props, timeframe: 'M15' })
  assert.match(container.querySelector('.raycaster-bias').getAttribute('aria-label'), /Hover a candle/)
  await render(props)
  assert.match(container.querySelector('.raycaster-bias').getAttribute('aria-label'), /Hover a candle/, 'Returning to the prior scope must not resurrect its held candle')
  assert.equal(workers[0].jobs.length, 1)
  await React.act(async () => nfpSignalSettings.save('hiring', [20, 40, 80]))
  assert.equal(workers.length, 2, 'Applied source magnitudes must rebuild context')
  assert.deepEqual(workers[1].jobs[0].input.settings.nfp.hiring, [20, 40, 80])
  assert.match(container.textContent, /Calculating/)
  const appliedJob = workers[1].jobs[0]
  await React.act(async () => workers[1].onmessage({ data: { id: appliedJob.id, result: buildContextTimeline(appliedJob.input) } }))
  await React.act(async () => handler({ time: open, point: undefined, seriesData: new Map() }))
  await tick(); assert.match(container.textContent, /Hover a candle/)
  await React.act(async () => familySettings.saveRaycasterFamilies(['nfp']))
  assert.equal(workers.length, 3); assert.match(container.textContent, /Calculating/)
  await React.act(async () => workers[2].onerror({}))
  assert.match(container.textContent, /Background calculation failed/)
  await React.act(async () => familySettings.saveRaycasterFamilies([]))
  assert.equal(workers[0].terminated, true)
  assert.match(container.textContent, /Enable an input in Fundamental tools/)
  await React.act(async () => gear.click())
  const allOff = container.querySelector('[role="dialog"]')
  assert.equal(allOff.querySelector('[aria-label="Use CPI v4.1"]'), null)
  await React.act(async () => allOff.querySelector('[aria-label="Advanced USD input settings"]').click())
  assert.equal(allOff.querySelector('[aria-label="Use CPI v4.1"]').textContent, 'Off')
  assert.ok([...allOff.querySelectorAll('[aria-label^="Use "]')].every(button => button.getAttribute('aria-pressed') === 'false'))
  await React.act(async () => allOff.querySelector('[aria-label="Use Retail Sales v1"]').click())
  assert.deepEqual(familySettings.readRaycasterFamilies(), ['retail'])
  assert.equal(workers.length, 4)
  assert.deepEqual(workers[3].jobs[0].input.families, ['retail'])
  const retailJob = workers[3].jobs[0]
  await React.act(async () => workers[3].onmessage({ data: { id: retailJob.id, result: buildContextTimeline(retailJob.input) } }))
  assert.equal(allOff.querySelector('[aria-label="Use Retail Sales v1"]').getAttribute('aria-pressed'), 'true')
  assert.equal(allOff.querySelector('table'), null)
  await React.act(async () => container.querySelector('[aria-label="Close fundamental tools settings"]').click())
  assert.equal(document.activeElement, gear)
  await React.act(async () => container.querySelector('[aria-label="Hide Raycaster"]').click())
  assert.equal(closed, 1)
  await React.act(async () => root.render(null))
  assert.equal(unsubscribed, subscribed, 'All scope-change subscriptions are cleaned up')
  assert.ok(workers.every(worker => worker.terminated))
  assert.equal(frames.size, 0)

  let toggles = 0
  const headerProps = { symbol: 'EURUSD', quote: null, timeframe: 'H1', onSelectTimeframe() {},
    drawingToolbarVisible: true, onToggleDrawingToolbar() {}, raycasterVisible: false, raycasterSupported: true, onToggleRaycaster: () => toggles++ }
  await React.act(async () => root.render(React.createElement(ChartWorkspaceHeader, headerProps)))
  const toggle = container.querySelector('[aria-label="Show Raycaster"]')
  assert.ok(toggle); assert.equal(toggle.getAttribute('aria-pressed'), 'false')
  assert.equal(container.querySelector('[aria-label="Hide drawing toolbar"]').closest('.chart-toolbar-center').querySelector('[aria-label="Show Raycaster"]'), null)
  assert.equal(toggle.closest('.chart-toolbar-right').querySelector('[aria-label="Fundamental tools"]'), toggle.parentElement)
  await React.act(async () => toggle.click()); assert.equal(toggles, 1)
  await React.act(async () => root.render(React.createElement(ChartWorkspaceHeader, { ...headerProps, drawingToolbarVisible: false, raycasterVisible: true })))
  assert.equal(container.querySelector('[aria-label="Hide Raycaster"]').getAttribute('aria-pressed'), 'true')
  assert.equal(container.querySelector('[aria-label="Show drawing toolbar"]').getAttribute('aria-pressed'), 'false')
  await React.act(async () => root.render(React.createElement(ChartWorkspaceHeader, { ...headerProps, raycasterSupported: false })))
  assert.equal(container.querySelector('[aria-label="Show Raycaster"]').disabled, true)
  await React.act(async () => root.render(React.createElement(FloatingDrawingToolbar, { activeTool: null, drawingCount: 0,
    onSelectCrosshair() {}, onToolChange() {}, onClearAll() {} })))
  assert.equal(container.querySelector('[aria-label="Show Raycaster"]'), null)
  preference.saveRaycasterVisible(true); preference.saveRaycasterPosition({ x: 21, y: 64 })
  const exported = exportWorkspace()
  assert.deepEqual(JSON.parse(exported.entries[familySettings.raycasterFamiliesKey]), { version: 3, families: ['retail'] })
  for (const invalid of [['bogus'], ['ism', 'ism'], 'retail']) assert.throws(() => parseWorkspaceSnapshot(JSON.stringify({ ...exported,
    entries: { [familySettings.raycasterFamiliesKey]: JSON.stringify(invalid) } })), /Invalid/)
  assert.throws(() => familySettings.saveRaycasterFamilies(['bad']), RangeError)
  familySettings.saveRaycasterFamilies(['cpi'])
  restoreWorkspace(exported)
  assert.deepEqual(familySettings.readRaycasterFamilies(), ['retail'])
  localStorage.setItem(familySettings.raycasterFamiliesKey, JSON.stringify(['ism', 'nfp']))
  window.dispatchEvent(new dom.StorageEvent('storage', { key: familySettings.raycasterFamiliesKey }))
  assert.deepEqual(familySettings.readRaycasterFamilies(), ['nfp', 'ism'])
  localStorage.setItem(familySettings.raycasterFamiliesKey, JSON.stringify(['cpi', 'nfp', 'ism', 'retail']))
  assert.deepEqual(familySettings.readRaycasterFamilies(), ['cpi', 'nfp', 'claims', 'pce', 'ism', 'retail', 'gdp', 'ppi'], 'The old full default gains the expanded menu')
  familySettings.saveRaycasterFamilies(['cpi', 'nfp', 'ism', 'retail'])
  assert.deepEqual(familySettings.readRaycasterFamilies(), ['cpi', 'nfp', 'ism', 'retail'], 'A deliberate new Claims-Off selection survives reload')
  restoreWorkspace(exportWorkspace())
  assert.deepEqual(familySettings.readRaycasterFamilies(), ['cpi', 'nfp', 'ism', 'retail'])
  familySettings.saveRaycasterFamilies([])
  assert.deepEqual(familySettings.readRaycasterFamilies(), [])
  assert.equal(exported.entries[preference.raycasterVisibleKey], 'true')
  assert.deepEqual(JSON.parse(exported.entries[preference.raycasterPositionKey]), { x: 21, y: 64 })
  assert.throws(() => parseWorkspaceSnapshot(JSON.stringify({ ...exported, entries: { [preference.raycasterPositionKey]: '{"x":-1,"y":0}' } })), /Invalid/)
  assert.equal(preference.readRaycasterVisible(), true)
  assert.equal(buildContextTimeline({ events: [], families: [], settings, asOf: 0 }).points.length, 0)
  console.log('✓ Mounted Raycaster hover, shared gear inspection, worker reuse/cleanup, right-side independent header toggle and portable preferences')
} finally {
  await React.act(async () => root.unmount())
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
