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
const series = {}, chart = { subscribeCrosshairMove: callback => { handler = callback; subscribed++ }, unsubscribeCrosshairMove: () => { unsubscribed++ } }
const tick = async () => React.act(async () => { for (const [id, callback] of frames) { frames.delete(id); callback() } })
try {
  const { Raycaster } = await server.ssrLoadModule('./src/raycaster/Raycaster.tsx')
  const { buildContextTimeline } = await server.ssrLoadModule('./src/usd-context/core/build-context-timeline.ts')
  const { contextSeriesIds } = await server.ssrLoadModule('./src/usd-context/core/score-publication.ts')
  const { FloatingDrawingToolbar } = await server.ssrLoadModule('./src/market-data/chart-drawings/FloatingDrawingToolbar.tsx')
  const { ChartWorkspaceHeader } = await server.ssrLoadModule('./src/terminal-shell/ChartWorkspaceHeader.tsx')
  const { defaultInspectorPreferences } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { exportWorkspace, parseWorkspaceSnapshot, restoreWorkspace } = await server.ssrLoadModule('./src/workspace-portability/workspace-snapshot.ts')
  const preference = await server.ssrLoadModule('./src/raycaster/storage/raycaster-preferences.ts')
  const familySettings = await server.ssrLoadModule('./src/raycaster/storage/raycaster-family-settings.ts')
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
  const render = (next = props) => React.act(async () => root.render(React.createElement(Raycaster, next)))
  await render()
  assert.equal(workers.length, 1); assert.equal(workers[0].jobs.length, 1)
  assert.match(container.textContent, /Calculating USD context/)
  const job = workers[0].jobs[0]
  await React.act(async () => workers[0].onmessage({ data: { id: job.id, result: buildContextTimeline(job.input) } }))
  assert.match(container.textContent, /Hover a candle/)
  const selected = latestRows.find(e => e.event_id === '840030008')
  const open = Math.floor(selected.chart_time_seconds / 3600) * 3600
  await React.act(async () => { for (let i = 0; i < 200; i++) handler({ time: open, point: { x: i, y: 5 }, seriesData: new Map([[series, {}]]) }) })
  assert.equal(frames.size, 1, 'Pointer events must coalesce into one frame')
  await tick()
  assert.match(container.textContent, /EURUSD (Long|Short)/)
  assert.match(container.textContent, /Latest update: CPI/)
  assert.match(container.textContent, /broker time \(candle end/)
  assert.equal(workers[0].jobs.length, 1, 'Hovering must not dispatch any scoring work')
  const gear = container.querySelector('button[aria-label="Raycaster calculation and inputs"]')
  await React.act(async () => gear.click())
  const details = container.querySelector('[role="dialog"]')
  assert.ok(details); assert.equal(gear.getAttribute('aria-expanded'), 'true')
  assert.equal(document.activeElement, details)
  const inputRow = name => details.querySelector(`[aria-label="Use ${name}"]`).closest('tr')
  for (const [name, weight] of [['CPI v3.1', '40%'], ['NFP v2', '40%'], ['ISM v3', '10%'], ['Retail Sales v1', '10%']]) {
    assert.equal(inputRow(name).children[1].textContent, weight)
    assert.equal(inputRow(name).querySelector('button').getAttribute('aria-pressed'), 'true')
    assert.match(inputRow(name).children[3].textContent, /EURUSD (Long|Short)/)
    assert.match(inputRow(name).children[4].textContent, /Source .* ×/)
  }
  assert.match(details.querySelector('tfoot').textContent, /100%EURUSD (Long|Short)/)
  assert.match(details.textContent, /Inspector selections do not affect/)
  assert.match(details.textContent, /45 days/)
  assert.match(details.textContent, /Forecasts are excluded/)
  assert.equal(workers[0].jobs.length, 1, 'Opening details must not recalculate')
  await React.act(async () => handler({ time: open, point: undefined, seriesData: new Map() }))
  await tick()
  assert.match(details.textContent, /last inspected candle/)
  assert.match(container.querySelector('.raycaster-bias').textContent, /EURUSD (Long|Short)/)
  assert.equal(workers[0].jobs.length, 1, 'Holding a candle while inspecting details must not rescore')
  await React.act(async () => details.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.equal(container.querySelector('[role="dialog"]'), null)
  assert.equal(document.activeElement, gear)
  assert.match(container.querySelector('.raycaster-bias').textContent, /Hover a candle/)
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
  assert.deepEqual(familySettings.readRaycasterFamilies(), ['cpi', 'nfp', 'ism', 'retail'])
  const count = requests.length
  await render({ ...props, symbol: 'USDJPY' })
  assert.match(container.querySelector('.raycaster-bias').textContent, /Hover a candle/, 'Pair changes clear the held candle')
  await React.act(async () => handler({ time: open, point: { x: 1, y: 5 }, seriesData: new Map([[series, {}]]) }))
  await tick()
  assert.match(container.textContent, /USDJPY (Long|Short)/)
  assert.equal(requests.length, count); assert.equal(workers[0].jobs.length, 1, 'Pair inversion reuses the USD timeline')
  await render({ ...props, clockOffsetMs: props.clockOffsetMs + 3000 })
  assert.match(container.querySelector('.raycaster-bias').textContent, /Hover a candle/)
  await React.act(async () => handler({ time: open, point: { x: 1, y: 5 }, seriesData: new Map([[series, {}]]) }))
  await tick()
  assert.equal(requests.length, count); assert.equal(workers[0].jobs.length, 1, 'Clock ticks between publications must reuse the timeline')
  await render({ ...props, timeframe: 'M15' })
  assert.match(container.querySelector('.raycaster-bias').textContent, /Hover a candle/)
  await render(props)
  assert.match(container.querySelector('.raycaster-bias').textContent, /Hover a candle/, 'Returning to the prior scope must not resurrect its held candle')
  assert.equal(workers[0].jobs.length, 1)
  await React.act(async () => nfpSignalSettings.save('hiring', [20, 40, 80]))
  assert.equal(workers[0].jobs.length, 2, 'Applied source magnitudes must rebuild context')
  assert.deepEqual(workers[0].jobs[1].input.settings.nfp.hiring, [20, 40, 80])
  assert.match(container.textContent, /Calculating/)
  const appliedJob = workers[0].jobs[1]
  await React.act(async () => workers[0].onmessage({ data: { id: appliedJob.id, result: buildContextTimeline(appliedJob.input) } }))
  await React.act(async () => handler({ time: open, point: undefined, seriesData: new Map() }))
  await tick(); assert.match(container.textContent, /Hover a candle/)
  await React.act(async () => familySettings.saveRaycasterFamilies(['nfp']))
  assert.equal(workers[0].jobs.length, 3); assert.match(container.textContent, /Calculating/)
  await React.act(async () => workers[0].onerror({}))
  assert.match(container.textContent, /Background calculation failed/)
  await React.act(async () => familySettings.saveRaycasterFamilies([]))
  assert.equal(workers[0].terminated, true)
  assert.match(container.textContent, /Enable an input in Raycaster/)
  await React.act(async () => gear.click())
  const allOff = container.querySelector('[role="dialog"]')
  assert.equal(allOff.querySelector('[aria-label="Use CPI v3.1"]').textContent, 'Off')
  assert.match(allOff.textContent, /Enabled weight: 0%/)
  await React.act(async () => allOff.querySelector('[aria-label="Use Retail Sales v1"]').click())
  assert.deepEqual(familySettings.readRaycasterFamilies(), ['retail'])
  assert.equal(workers.length, 2)
  assert.deepEqual(workers[1].jobs[0].input.families, ['retail'])
  const retailJob = workers[1].jobs[0]
  await React.act(async () => workers[1].onmessage({ data: { id: retailJob.id, result: buildContextTimeline(retailJob.input) } }))
  assert.match(allOff.textContent, /Enabled weight: 10%/)
  await React.act(async () => container.querySelector('[aria-label="Close Raycaster details"]').click())
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
  assert.equal(container.querySelector('[aria-label="Hide drawing toolbar"]').nextElementSibling, toggle)
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
  assert.deepEqual(JSON.parse(exported.entries[familySettings.raycasterFamiliesKey]), ['retail'])
  for (const invalid of [['ppi'], ['ism', 'ism'], 'retail']) assert.throws(() => parseWorkspaceSnapshot(JSON.stringify({ ...exported,
    entries: { [familySettings.raycasterFamiliesKey]: JSON.stringify(invalid) } })), /Invalid/)
  assert.throws(() => familySettings.saveRaycasterFamilies(['bad']), RangeError)
  familySettings.saveRaycasterFamilies(['cpi'])
  restoreWorkspace(exported)
  assert.deepEqual(familySettings.readRaycasterFamilies(), ['retail'])
  localStorage.setItem(familySettings.raycasterFamiliesKey, JSON.stringify(['ism', 'nfp']))
  window.dispatchEvent(new dom.StorageEvent('storage', { key: familySettings.raycasterFamiliesKey }))
  assert.deepEqual(familySettings.readRaycasterFamilies(), ['nfp', 'ism'])
  assert.equal(exported.entries[preference.raycasterVisibleKey], 'true')
  assert.deepEqual(JSON.parse(exported.entries[preference.raycasterPositionKey]), { x: 21, y: 64 })
  assert.throws(() => parseWorkspaceSnapshot(JSON.stringify({ ...exported, entries: { [preference.raycasterPositionKey]: '{"x":-1,"y":0}' } })), /Invalid/)
  assert.equal(preference.readRaycasterVisible(), true)
  assert.equal(buildContextTimeline({ events: [], families: [], settings, asOf: 0 }).points.length, 0)
  console.log('✓ Mounted Raycaster hover, worker reuse/cleanup, calculation popover, adjacent independent header toggle and portable preferences')
} finally {
  await React.act(async () => root.unmount())
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
