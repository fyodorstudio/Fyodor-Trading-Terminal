import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false } })
const dom = new Window({ url: 'http://localhost:5173' })
const keys = ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'localStorage', 'ResizeObserver', 'IS_REACT_ACT_ENVIRONMENT']
const previous = Object.fromEntries(keys.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
  value: key === 'window' ? dom : key === 'document' ? dom.document : key === 'ResizeObserver' ? class { observe() {} disconnect() {} } : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom[key] })
const { createRoot } = await import('react-dom/client')
const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
const render = node => React.act(async () => root.render(node))
const frames = new Map(); let frameId = 0
dom.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId }; dom.cancelAnimationFrame = id => frames.delete(id)
try {
  const load = p => server.ssrLoadModule('./src/' + p)
  const { combineContext } = await load('usd-context/core/combine-context.ts')
  const { roofSupport } = await load('usd-context/sequences/core/relationship-support.ts')
  const { selectedRoofProjection } = await load('raycaster/ribbon/roof-ribbon-timeline.ts')
  const { RaycasterBox } = await load('raycaster/ui/RaycasterBox.tsx')
  const { ContextRibbon } = await load('raycaster/ribbon/ContextRibbon.tsx')
  const { SupportSplit } = await load('usd-context/ui/SupportSplit.tsx')
  const { RoofAuditControls } = await load('usd-context/sequences/ui/RoofAuditControls.tsx')
  const audit = await load('usd-context/sequences/audit/audit-storage.ts')
  const at = Date.UTC(2026, 0, 1, 12, 30), hour = 3600000
  const source = (family, total) => ({ family, total, chartAt: at, releaseAt: at, sourceId: family, sourceLabel: family.toUpperCase(),
    usdDirection: total > 0 ? 'stronger' : 'weaker', strength: 'moderate', reduced: false, tie: false, coverage: 1, reason: '', explanation: '', changeSize: null })
  const result = combineContext({ cpi: source('cpi', 2), claims: source('claims', -2), nfp: source('nfp', -3) }, ['cpi', 'claims', 'nfp'], at)
  const context = { chartAt: at, result, latest: result.members[0], update: 'Publication' }
  const combo = { id: 'pair', kind: 'release-relationship', title: 'CPI + Claims', chartAt: at, sources: result.members.filter(s => s.family !== 'nfp'),
    before: null, after: result, direction: 'stronger', strength: 'moderate', explanation: '', checks: [], experimental: false }
  const timeline = { points: [context], enabled: ['cpi', 'claims', 'nfp'], version: 'test', excludedTiming: 0, relationships: { episodes: [combo], fresh: [] } }
  const captured = JSON.stringify([combo, timeline]), storage = JSON.stringify({ ...localStorage })
  const projection = selectedRoofProjection(timeline, combo)
  assert.equal(projection.current, true)
  assert.equal(selectedRoofProjection(timeline, combo), projection, 'Repeated hover renders reuse the exact projection object')
  const stale = { ...combo, after: { ...result, total: 123 } }
  const staleProjection = selectedRoofProjection(timeline, stale)
  assert.equal(staleProjection.current, false); assert.equal(staleProjection.points.length, 0)
  assert.equal(selectedRoofProjection(timeline, stale), staleProjection, 'Stale selections do not rebuild on hover')
  let cleared = 0, toggled = 0
  const boxProps = { symbol: 'EURUSD', point: context, cutoff: at, loading: false, message: null,
    timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 }, selectedCombo: combo, onClose() {}, onClearCombo: () => cleared++,
    roofCandyVisible: true, onToggleRoofCandy: () => toggled++ }
  await render(React.createElement(RaycasterBox, boxProps))
  const accumulated = container.querySelector('[aria-label="Accumulated context"]')
  const selected = container.querySelector('[aria-label="Selected roof snapshot"]')
  assert.match(accumulated.textContent, /Long leads/); assert.match(selected.textContent, /Short leads/)
  assert.notEqual(accumulated.querySelector('.support-split').textContent, selected.querySelector('.support-split').textContent, 'Combo shares do not borrow accumulated percentages')
  assert.match(selected.textContent, /CPI gives most Short support.*CLAIMS gives opposing Long support/)
  assert.match(selected.textContent, /Snapshot at/)
  assert.equal(container.querySelector('.raycaster-calculations').open, false)
  assert.equal(container.querySelector('.raycaster-reaction').open, false, 'Price observations are directly accessible without occupying the default reading')
  await React.act(async () => container.querySelector('[aria-label="Clear selected roof"]').click()); assert.equal(cleared, 1)
  await React.act(async () => [...selected.querySelectorAll('button')].find(b => b.textContent === 'Hide Roof Candy').click()); assert.equal(toggled, 1)
  await render(React.createElement(RaycasterBox, { ...boxProps, selectionNotice: 'Inputs or history changed. Reopen the roof.' }))
  assert.match(container.querySelector('[role="status"]').textContent, /Reopen/)
  assert.equal(JSON.stringify({ ...localStorage }), storage, 'Display, clearing and toggling do not write preferences')

  const balanced = { ...roofSupport(combo), state: 'balanced', direction: null, long: 1, short: 1 }
  await render(React.createElement(SupportSplit, { support: balanced, compact: true }))
  assert.match(container.textContent, /L 50\.0%S 50\.0%Balanced/)
  await render(React.createElement(SupportSplit, { support: { ...balanced, state: 'conflicted', direction: 'long' }, compact: true }))
  assert.equal(container.querySelector('.support-state'), null, 'Percentages no longer repeat the yellow Conflict text')
  assert.ok(container.querySelector('.support-split.conflicted'), 'Opposing support retains its amber cue')
  for (const state of ['unchanged', 'insufficient']) {
    await render(React.createElement(SupportSplit, { support: { ...balanced, state, long: 0, short: 0 }, compact: true }))
    assert.match(container.textContent, /L —S —/); assert.doesNotMatch(container.textContent, /100|50/)
  }

  let coordinates = 0
  const handlers = new Set()
  const scale = { getVisibleRange: () => ({ from: (at - hour / 2) / 1000, to: (at + hour / 2) / 1000 }), width: () => 200,
    options: () => ({ barSpacing: 100 }), timeToCoordinate: t => { coordinates++; return (t - (at - hour / 2) / 1000) / 3600 * 100 },
    subscribeVisibleLogicalRangeChange: fn => handlers.add(fn), unsubscribeVisibleLogicalRangeChange: fn => handlers.delete(fn),
    subscribeSizeChange: fn => handlers.add(fn), unsubscribeSizeChange: fn => handlers.delete(fn) }
  const ribbonProps = { chartApi: { timeScale: () => scale }, bars: [{ time: (at - hour / 2) / 1000 }, { time: (at + hour / 2) / 1000 }],
    timeframe: 'H1', points: projection.points, now: at + hour / 2, relative: false, version: 'Selected relationship presentation v1',
    relationshipTitle: combo.title, startAt: at, loading: false, notice: null, symbol: 'EURUSD', brokerId: 'Broker' }
  await render(React.createElement(ContextRibbon, ribbonProps))
  const strip = container.querySelector('[aria-label="Roof Candy · CPI + Claims · USD inputs"]')
  assert.ok(strip); assert.equal(container.querySelector('[aria-label="Outside events"]'), null, 'Roof Candy does not duplicate outside-event controls')
  const segment = strip.querySelector('.ribbon-segment')
  assert.equal(segment.style.left, '50px'); assert.equal(segment.style.width, '50px', 'Strip starts at exact activation, never the source span')
  assert.ok(segment.classList.contains('conflicted')); assert.ok(segment.classList.contains('lead-short'))
  const oldCoordinates = coordinates
  await React.act(async () => { for (let i = 0; i < 200; i++) segment.dispatchEvent(new dom.PointerEvent('pointermove', { clientX: 20, bubbles: true })) })
  assert.equal(coordinates, oldCoordinates); assert.equal(frames.size, 1, 'Relationship hover coalesces without reprojection/scoring')
  await React.act(async () => { for (const [id, fn] of frames) { frames.delete(id); fn() } })
  await React.act(async () => segment.click())
  const dialog = container.querySelector('[aria-label="Selected relationship explanation"]')
  assert.match(dialog.textContent, /CPI \+ Claims.*Short leads/)
  assert.match(dialog.textContent, /Accumulated USD context at the same time.*Long leads/)
  assert.equal(dialog.querySelector('details').open, false)
  assert.match(dialog.querySelector('.relationship-split').textContent, /Long 26\.3%Short 73\.7%/)
  await React.act(async () => [...dialog.querySelectorAll('[role="group"] button')].find(b => b.textContent === 'Opposed').click())
  const records = audit.readRoofAudits()
  assert.equal(records.length, 1)
  const snapshot = JSON.parse(records[0].snapshot)
  assert.equal(snapshot.displayedSupport.direction, 'short'); assert.equal(snapshot.displayedSupport.short, .56)
  assert.equal(snapshot.kind, 'release-relationship'); assert.equal(snapshot.chartAt, at)
  await React.act(async () => document.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.equal(container.querySelector('[role="dialog"]'), null)
  const originalRange = scale.getVisibleRange
  scale.getVisibleRange = () => ({ from: (at - 2 * hour) / 1000, to: (at - hour) / 1000 })
  await React.act(async () => { for (const fn of handlers) fn() })
  await React.act(async () => { for (const [id, fn] of frames) { frames.delete(id); fn() } })
  assert.equal(container.querySelector('.ribbon-segment'), null)
  assert.match(container.querySelector('.ribbon-empty').textContent, /combo starts.*Move the chart/, 'A view before activation explains the empty strip')
  assert.match(container.querySelector('.context-ribbon-legend').textContent, /Selected combo.*starts/)
  scale.getVisibleRange = originalRange
  await render(React.createElement(ContextRibbon, { ...ribbonProps, points: staleProjection.points, notice: 'Inputs changed; reopen the roof.' }))
  assert.ok(container.querySelector('.ribbon-segment.uncomputed'))
  assert.match(container.textContent, /reopen the roof/)
  await render(React.createElement(RoofAuditControls, { combo, symbol: 'EURUSD', broker: 'Broker', support: { ...balanced, state: 'insufficient' } }))
  assert.equal([...container.querySelectorAll('[role="group"] button')].filter(b => b.disabled).length, 6, 'No directional agreement verdict for an insufficient reading')
  assert.equal(JSON.stringify([combo, timeline]), captured)
  await render(null); assert.equal(handlers.size, 0, 'Relationship chart subscriptions detach')
  console.log('✓ Headless roof/accumulated distinction, shared percentage boxes, plain drivers, neutral states, activation-only Candy, conflict edges, coalesced hover, stale selection, audit capture and cleanup')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.close()
  for (const key of keys) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key] }
}
