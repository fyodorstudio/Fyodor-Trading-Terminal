import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT']
const previous = Object.fromEntries(keys.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
const render = node => React.act(async () => root.render(node))
const frames = new Map(); let frameId = 0
dom.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId }; dom.cancelAnimationFrame = id => frames.delete(id)
try {
  const load = p => server.ssrLoadModule('./src/' + p)
  const { buildRibbonTimeline, ribbonIndex, visibleRibbonIntervals } = await load('raycaster/ribbon/ribbon-timeline.ts')
  const { ribbonCoordinate, ribbonClockAtCoordinate } = await load('raycaster/ribbon/ribbon-geometry.ts')
  const { ContextRibbon } = await load('raycaster/ribbon/ContextRibbon.tsx')
  const { ContextViewControls } = await load('terminal-shell/chart-overlays/ContextViewControls.tsx')
  const preferences = await load('usd-context/sequences/storage/sequence-preferences.ts')
  const relativePreferences = await load('pair-context/storage/relative-preferences.ts')
  const { workflowSnapshot, validTradeWorkflow, emptyWorkflow } = await load('trader-notebook/workflow/workflow-model.ts')
  const { TraderNotebookPanel } = await load('trader-notebook/notebook-dock/TraderNotebookPanel.tsx')
  const workspace = await load('workspace-portability/workspace-snapshot.ts')
  const hour = 3600000, at = Date.UTC(2025, 0, 1, 12)
  const usdPoint = (chartAt, total, publication = true) => ({ chartAt, latest: { chartAt: publication ? chartAt : at }, update: publication ? 'CPI replaces the prior vote' : 'Memory update: older votes lose influence',
    result: { direction: total > 0 ? 'stronger' : 'weaker', total, strength: 'moderate', explanation: 'Declared USD interpretation', members: [{ family: 'cpi', sourceLabel: 'CPI', chartAt: at,
      contribution: total, status: 'active', memory: { effectiveWeight: 100 } }], missing: [], tie: false } })
  const usd = { points: [usdPoint(at, 1), usdPoint(at + hour / 2, -1), usdPoint(at + hour, 1, false), usdPoint(at + 4 * hour, -1)], version: 'test-context-v6' }
  const eurPoint = (chartAt, total) => ({ chartAt, total, coverage: 1, update: 'Euro inflation published', members: [{ chartAt, contribution: total, coverage: 1, provisional: false, status: 'active' }] })
  const eur = { points: [eurPoint(at + hour / 4, .5), eurPoint(at + hour / 2, -.5)], excludedTiming: 0 }
  const source = JSON.stringify([usd, eur])
  const points = buildRibbonTimeline(usd, eur, false, 'EURUSD')
  assert.deepEqual(points.map(p => p.direction), ['short', 'long', 'short', 'long'])
  assert.equal(points[2].kind, 'memory', 'Carried latest publication does not turn aging into news')
  assert.deepEqual(buildRibbonTimeline(usd, null, false, 'USDJPY').map(p => p.direction), ['long', 'short', 'long', 'short'], 'USD-base pair orientation is inverted')
  const merged = buildRibbonTimeline(usd, eur, true, 'EURUSD')
  assert.deepEqual(merged.map(p => p.at), [at, at + hour / 4, at + hour / 2, at + hour, at + 4 * hour])
  assert.equal(merged[0].direction, 'insufficient', 'Relative mode needs both legs')
  assert.equal(merged[0].evidence, null)
  assert.equal(merged[1].direction, 'long', 'An EUR-only update changes relative context')
  assert.equal(merged[2].direction, 'short', 'Simultaneous EUR/USD publications resolve atomically')
  assert.match(merged[2].update, /CPI.*EUR: Euro inflation/)
  const redundantEur = { points: [{ ...eurPoint(at + hour / 4, .5), updateKind: 'publication', members: [{ ...eurPoint(at, .5).members[0], chartAt: at }] }] }
  assert.equal(buildRibbonTimeline(usd, redundantEur, true, 'EURUSD')[1].kind, 'publication', 'A country publication remains news even when its aggregate already owns the vote')
  const expiredUsd = { ...usd, points: [usd.points[0], { ...usdPoint(at + hour, 0, false), result: { ...usd.points[0].result, members: [{ ...usd.points[0].result.members[0], status: 'expired' }] } }] }
  assert.equal(buildRibbonTimeline(expiredUsd, null, false, 'EURUSD')[1].kind, 'expiry', 'Expiry is distinct from daily aging')
  assert.equal(JSON.stringify([usd, eur]), source, 'Display timeline never changes engine inputs')
  assert.equal(ribbonIndex(points, at + hour / 2 - 1), 0)
  assert.equal(ribbonIndex(points, at + hour / 2), 1)
  assert.equal(ribbonIndex(points, at - 1), -1)
  const visible = visibleRibbonIntervals(points, at - hour, at + hour / 2)
  assert.equal(visible[0].point, null, 'History before first admitted point stays unavailable')
  assert.deepEqual(visible.map(i => i.to), [at, at + hour / 2], 'Future changes never leak before publication')
  let reads = 0
  const longHistory = Array.from({ length: 100000 }, (_, i) => ({ get at() { reads++; return at + i * 1000 } }))
  const tiny = visibleRibbonIntervals(longHistory, at + 50000000, at + 50002000)
  assert.equal(tiny.length, 2); assert.ok(reads < 30, 'Viewport lookup is binary, not a full-history scan')

  const bars = [0, 1, 2, 3, 4].map(n => ({ time: (at + n * hour) / 1000 }))
  let rangeHandler, sizeHandler, coordinates = 0, unsubscribed = 0
  const scale = { getVisibleRange: () => ({ from: at / 1000, to: (at + hour) / 1000 }), width: () => 400,
    options: () => ({ barSpacing: 100 }), timeToCoordinate: t => { coordinates++; return (t - at / 1000) / 3600 * 100 },
    subscribeVisibleLogicalRangeChange: fn => { rangeHandler = fn }, unsubscribeVisibleLogicalRangeChange: fn => { assert.equal(fn, rangeHandler); unsubscribed++ },
    subscribeSizeChange: fn => { sizeHandler = fn }, unsubscribeSizeChange: fn => { assert.equal(fn, sizeHandler); unsubscribed++ } }
  assert.equal(ribbonCoordinate(scale, bars, at + hour / 2, 3600), 50)
  assert.equal(ribbonClockAtCoordinate(scale, bars, 50, 3600), at + hour / 2)
  const gapBars = [bars[0], { time: (at + 72 * hour) / 1000 }]
  const gapScale = { ...scale, timeToCoordinate: t => t === gapBars[0].time ? 0 : 100 }
  assert.equal(ribbonClockAtCoordinate(gapScale, gapBars, 50, 3600), at + hour / 2, 'Weekend gaps must not distort the hovered candle clock')
  const props = { chartApi: { timeScale: () => scale }, bars, timeframe: 'H1', points, now: at + hour + hour / 2,
    relative: false, version: usd.version, loading: false, notice: null }
  await render(React.createElement(ContextRibbon, props))
  const segments = [...container.querySelectorAll('.ribbon-segment')]
  assert.deepEqual(segments.map(b => b.classList.contains('long')), [false, true, false])
  assert.deepEqual(segments.map(b => b.style.width), ['50px', '50px', '50px'], 'Publication and current-time clipping are exact within H1')
  assert.match(container.textContent, /USD side/)
  const pointerCalls = coordinates
  await React.act(async () => { for (let i = 0; i < 200; i++) segments[1].dispatchEvent(new dom.PointerEvent('pointermove', { clientX: 25, bubbles: true })) })
  assert.equal(coordinates, pointerCalls); assert.equal(frames.size, 1, 'Ribbon hover coalesces a pointer burst without re-scoring')
  await React.act(async () => { for (const [id, fn] of frames) { frames.delete(id); fn() } })
  assert.match(container.querySelector('.ribbon-hover').textContent, /EURUSD Long/)
  await React.act(async () => segments[1].click())
  assert.match(container.querySelector('[role="dialog"]').textContent, /EURUSD Long.*test-context-v6/)
  assert.match(container.querySelector('[role="dialog"]').textContent, /Publication update/)
  await React.act(async () => container.querySelector('[aria-label="Close ribbon explanation"]').click())
  await React.act(async () => segments[2].click())
  assert.match(container.querySelector('[role="dialog"]').textContent, /Memory aging update/)
  const calls = coordinates
  await React.act(async () => { for (let i = 0; i < 200; i++) rangeHandler(); sizeHandler() })
  assert.equal(coordinates, calls); assert.equal(frames.size, 1, 'Panning coalesces before projection')
  await React.act(async () => { for (const [id, fn] of frames) { frames.delete(id); fn() } })
  await render(React.createElement(ContextRibbon, { ...props, points: merged, relative: true }))
  assert.equal(container.querySelector('[role="dialog"]'), null, 'Changing mode clears the old explanation')
  assert.match(container.textContent, /EUR vs USD/)
  assert.ok(container.querySelector('.ribbon-segment.insufficient'))
  await render(null); assert.equal(unsubscribed, 4)

  preferences.saveSequencePreferences({ roofs: true, fresh: true, ribbon: false })
  await render(React.createElement(ContextViewControls, { symbol: 'EURUSD', supported: true }))
  assert.equal(container.querySelector('[aria-label="Show Raycaster"]'), null)
  await React.act(async () => container.querySelector('[aria-label="Show context ribbon"]').click())
  assert.equal(preferences.readSequencePreferences().ribbon, true)
  await React.act(async () => container.querySelector('[aria-label="Hide roofs"]').click())
  assert.equal(preferences.readSequencePreferences().ribbon, true, 'Roof visibility does not disable ribbon')
  assert.equal(preferences.readSequencePreferences().roofs, false)
  await React.act(async () => container.querySelector('[aria-label="Fundamental tools settings"]').click())
  const guide = container.querySelector('[role="dialog"]')
  await React.act(async () => [...guide.querySelectorAll('[role="tab"]')].find(b => b.textContent === 'Roofs').click())
  assert.match(guide.textContent, /filled dot marks activation.*width is not an active duration/)
  assert.match(guide.textContent, /Click a hollow dot for its contributing release/)
  assert.match(guide.textContent, /Claims \+ NFP/)
  await React.act(async () => { guide.querySelector('select').value = 'relative'; guide.querySelector('select').dispatchEvent(new dom.Event('change', { bubbles: true })) })
  assert.equal(relativePreferences.readRelativePreferences().mode, 'relative')
  await render(React.createElement(ContextViewControls, { symbol: 'USDJPY', supported: true }))
  assert.equal(container.querySelector('[aria-label="Show roofs"]').disabled, true)
  assert.equal(container.querySelector('[aria-label="Hide context ribbon"]').disabled, false)
  assert.equal(preferences.validSequencePreferences({ roofs: true, fresh: false }), true, 'Old display preference remains valid')
  assert.equal(preferences.validSequencePreferences({ roofs: true, fresh: false, ribbon: 'yes' }), false)

  const context = { recordedAt: at, asOf: at + hour, symbol: 'EURUSD', broker: 'Broker', mode: 'relative', version: 'v6/v1', inputs: ['USD:cpi', 'EUR:euro-pmi'], label: 'EURUSD Long', evidence: 'moderate', update: 'New publication', partial: false }
  let plan = { direction: 'long', entryPrice: 1.1, slPrice: 1.09, tpPrice: 1.12, showOnChart: true,
    workflow: { ...emptyWorkflow, thesis: 'My thesis', priceInvalidation: 'H1 closes below support', reviewTrigger: 'opposing-moderate', context } }
  let pinned = null
  function Notebook() { const [draft, setDraft] = React.useState(plan); return React.createElement(TraderNotebookPanel, {
    selectedSymbol: 'EURUSD', quote: null, latestBarTime: at / 1000, plan: draft, registeredArrows: [], selectedArrowId: null,
    onPlanChange: p => { plan = p; setDraft(p); localStorage.setItem('trader_plan_EURUSD', JSON.stringify(p)) }, onSelectArrowId() {},
    onRegisterArrow: arrow => { pinned = arrow }, onDeleteArrow() {} }) }
  await render(React.createElement(Notebook))
  assert.match(container.textContent, /What observable condition would make my reason for this trade no longer hold/)
  assert.equal(container.querySelector('.trade-workflow textarea').value, 'My thesis')
  const risk = container.querySelectorAll('.trade-workflow textarea')[3]
  await React.act(async () => { const setter = Object.getOwnPropertyDescriptor(dom.HTMLTextAreaElement.prototype, 'value').set; setter.call(risk, 'One planned risk unit'); risk.dispatchEvent(new dom.Event('input', { bubbles: true })) })
  assert.equal(plan.workflow.riskLimit, 'One planned risk unit')
  assert.equal(JSON.parse(localStorage.getItem('trader_plan_EURUSD')).workflow.riskLimit, 'One planned risk unit')
  await React.act(async () => container.querySelector('.register-arrow-btn-compact').click())
  assert.equal(pinned.workflow.reviewTrigger, 'opposing-moderate')
  assert.deepEqual(pinned.workflow.context, context)
  plan.workflow.context.inputs.push('USD:nfp')
  assert.deepEqual(pinned.workflow.context.inputs, context.inputs.slice(0, 2), 'Pinning copies the workflow and input selection')
  assert.ok(validTradeWorkflow(pinned.workflow)); assert.equal(validTradeWorkflow({ ...pinned.workflow, context: { ...context, mode: 'bad' } }), false)
  assert.equal(workflowSnapshot(undefined), undefined, 'Old arrows retain absent workflow')
  const arrow = { ...pinned, id: 'pin', createdAt: at }
  await render(React.createElement(TraderNotebookPanel, { selectedSymbol: 'EURUSD', quote: null, latestBarTime: at / 1000,
    plan, registeredArrows: [arrow], selectedArrowId: 'pin', onPlanChange() { throw Error('Pinned workflow must not be edited') }, onSelectArrowId() {}, onRegisterArrow() {}, onDeleteArrow() {} }))
  assert.ok([...container.querySelectorAll('.trade-workflow textarea')].every(t => t.readOnly))
  localStorage.setItem('fyodor.registered_arrows.v1', JSON.stringify([arrow]))
  const exported = workspace.exportWorkspace()
  assert.ok(JSON.parse(exported.entries['fyodor.registered_arrows.v1'])[0].workflow.context)
  assert.equal(JSON.parse(exported.entries[preferences.sequencePreferencesKey]).ribbon, true)
  workspace.restoreWorkspace(exported)
  assert.equal(JSON.parse(localStorage.getItem('trader_plan_EURUSD')).workflow.riskLimit, 'One planned risk unit')
  assert.throws(() => workspace.parseWorkspaceSnapshot(JSON.stringify({ ...exported, entries: { trader_plan_EURUSD: JSON.stringify({ ...plan, workflow: { bad: true } }) } })), /Invalid/)
  console.log('✓ Exact atomic ribbon timeline, pair inversion, viewport bounds, pan coalescing, independent controls, mode guide, Notebook workflow/pin snapshots and workspace restore')
} finally {
  await React.act(async () => root.unmount())
  await server.close(); await dom.happyDOM.close()
  for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
}
