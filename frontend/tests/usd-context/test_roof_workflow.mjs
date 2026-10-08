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
try {
  const load = p => server.ssrLoadModule('./src/' + p)
  const { layoutRoofs } = await load('usd-context/sequences/chart/roof-layout.ts')
  const { createRoofPlan, prepareRoofAnchors, projectRoofPlan, knownRoofCount } = await load('usd-context/sequences/chart/roof-plan.ts')
  const { comboSummary } = await load('usd-context/sequences/ui/combo-summary.ts')
  const { RoofAuditControls } = await load('usd-context/sequences/ui/RoofAuditControls.tsx')
  const { roofAuditScope, sameRoofAudit, validRoofAudits } = await load('usd-context/sequences/audit/audit-model.ts')
  const audit = await load('usd-context/sequences/audit/audit-storage.ts')
  const workspace = await load('workspace-portability/workspace-snapshot.ts')
  const { combineContext } = await load('usd-context/core/combine-context.ts')
  const at = Date.UTC(2025, 1, 28, 15, 30)
  const source = (family, total, chartAt) => ({ family, total, chartAt, releaseAt: chartAt, sourceId: family, sourceLabel: family,
    usdDirection: total < 0 ? 'weaker' : 'stronger', strength: 'moderate', reduced: false, tie: false, coverage: 1, reason: '', explanation: '', changeSize: null })
  const inputs = [source('claims', -1, at - 86400000), source('pce', 1, at)]
  const after = combineContext(Object.fromEntries(inputs.map(s => [s.family, s])), ['claims', 'pce'], at)
  const combo = { id: 'fresh/2025', kind: 'fresh-news', title: 'Fresh-news sequence', chartAt: at,
    sources: inputs.map((s, i) => ({ ...s, change: i ? .05 : -.2, comparable: true })), before: null, after,
    direction: 'weaker', strength: 'weak', explanation: 'Test snapshot', checks: [], experimental: true }
  const preserved = JSON.stringify(combo)
  const summary = comboSummary(combo)
  assert.match(summary.why, /claims gives most Long support.*pce gives opposing Short support/)
  assert.equal(summary.activation, 'pce', 'Activation names only the publication at the qualification time')
  assert.equal(comboSummary({ ...combo, chartAt: at + 1 }).activation, 'Aging update · Memory update; no new publication')
  assert.match(comboSummary({ ...combo, sources: combo.sources.map(s => ({ ...s, change: s.family === 'claims' ? -.1 : .1 })) }).why, /cancel/)
  assert.match(comboSummary({ ...combo, sources: combo.sources.map(s => ({ ...s, comparable: false })) }).why, /not enough usable evidence/)
  assert.match(comboSummary({ ...combo, kind: 'ism-sectors', sources: [{ ...inputs[0], total: null, usdDirection: 'uncomputed' }, inputs[1]] }).why, /not enough usable evidence/)

  const candidate = (id, props = {}) => ({ combo: { ...combo, id, ...props }, left: 100, right: 300, labelX: 200, endpoints: [], hidden: 0 })
  const crowded = [candidate('old'), candidate('new', { chartAt: at + 1 }), candidate('established', { kind: 'weekly-labor', experimental: false }),
    candidate('strong', { kind: 'ism-sectors', strength: 'strong', experimental: false }), candidate('far', { chartAt: at + 2 })]
  crowded.at(-1).left = 600; crowded.at(-1).right = 700; crowded.at(-1).labelX = 650
  const focused = layoutRoofs(crowded, true)
  assert.deepEqual(focused.positioned.map(p => p.combo.id).sort(), ['established', 'far', 'new', 'strong'], 'Evidence and established relationships take priority before freshness')
  assert.equal(focused.overflow.length, 1)
  assert.deepEqual(layoutRoofs(crowded.slice(0, 2), true).positioned.map(p => p.combo.id), ['new'], 'Newest repeated combination is the representative')
  for (const focus of [true, false]) {
    const result = layoutRoofs(crowded, focus)
    assert.deepEqual([...result.positioned.map(p => p.combo.id), ...result.overflow.map(c => c.id)].sort(), crowded.map(p => p.combo.id).sort(), 'Every roof remains accessible')
    for (const lane of new Set(result.positioned.map(p => p.lane))) {
      const labels = result.positioned.filter(p => p.lane === lane).sort((a, b) => a.labelX - b.labelX)
      for (let i = 1; i < labels.length; i++) assert.ok(labels[i].labelX - labels[i - 1].labelX >= 178, 'Same-lane labels do not overlap')
    }
  }

  const hour = 3600000
  const bars = Array.from({ length: 100 }, (_, i) => ({ time: (at + i * hour) / 1000 }))
  const roofSources = (start, end, suffix) => [source('claims', -1, at + start * hour), source('pce', -1, at + end * hour)]
    .map((s, i) => ({ ...s, sourceId: suffix + '/' + i }))
  const episodes = Array.from({ length: 18 }, (_, i) => ({ ...combo, id: 'stable/' + i, chartAt: at + (i * 4 + 3) * hour,
    sources: roofSources(i * 4, i * 4 + 3, i), kind: i % 2 ? 'ism-sectors' : 'fresh-news', experimental: i % 2 === 0 }))
  const markers = episodes.flatMap(e => e.sources.map(s => ({ release: { id: s.sourceId } })))
  const count = knownRoofCount(episodes, episodes[5].chartAt - 1)
  assert.equal(count, 5, 'Only already-activated roofs enter the fixed history layout')
  assert.equal(prepareRoofAnchors(episodes, bars, 'H1', markers, true, count).length, count)
  for (const focused of [true, false]) {
    const anchors = prepareRoofAnchors(episodes, bars, 'H1', markers, true, episodes.length)
    const plan = createRoofPlan(anchors, 12, focused)
    const a = projectRoofPlan(plan, 20, 500), b = projectRoofPlan(plan, -40, 500), c = projectRoofPlan(plan, 20, 500)
    const shared = a.positioned.filter(p => b.positioned.some(q => q.combo.id === p.combo.id))
    assert.ok(shared.length > 2, 'Zoomed-out fixture keeps several roofs across shifted viewports')
    for (const p of shared) {
      const q = b.positioned.find(q => q.combo.id === p.combo.id)
      assert.equal(q.lane, p.lane, 'Panning cannot repack a shared roof into a different lane')
      assert.equal(q.labelX - p.labelX, -60)
      assert.equal(q.left - p.left, -60); assert.equal(q.right - p.right, -60)
      assert.deepEqual(q.endpoints.map(e => e.x), p.endpoints.map(e => e.x - 60))
      assert.deepEqual(q.endpoints.map(e => e.publications), p.endpoints.map(e => e.publications), 'Panning keeps the same source identities and cluster members')
    }
    assert.deepEqual(c, a, 'Returning to a viewport restores identical roofs and overflow')
    assert.equal(new Set([...a.positioned.map(p => p.combo.id), ...a.overflow.map(p => p.id)]).size, a.positioned.length + a.overflow.length)
  }
  const crossing = { ...combo, id: 'crossing', chartAt: at + 20 * hour, sources: roofSources(0, 20, 'crossing') }
  const crossingMarkers = crossing.sources.map(s => ({ release: { id: s.sourceId } }))
  const crossingPlan = createRoofPlan(prepareRoofAnchors([crossing], bars, 'H1', crossingMarkers, true, 1), 10, true)
  const edge = projectRoofPlan(crossingPlan, -50, 200).positioned[0]
  assert.equal(edge.left, -50, 'An offscreen source stays the original anchor instead of jumping to a later visible source')
  assert.equal(edge.labelX, 150, 'The label stays on activation even when its source leaves the screen')
  assert.equal(projectRoofPlan(crossingPlan, 50, 100).positioned[0].right, 250, 'Crossing roofs survive an offscreen activation; the viewport clips the release symbol')
  const groupedSource = { ...crossing, id: 'grouped-crossing', sources: [
    { ...crossing.sources[0], family: 'ism', sourceId: 'services', chartAt: at + 10 * hour }, crossing.sources[1],
  ] }
  const groupedMarkers = [{ time: at / 1000, release: { id: 'ISM/month', ismPublications: [{ id: 'services' }] }, symbol: 'umbrella' },
    { time: (at + 20 * hour) / 1000, release: { id: crossing.sources[1].sourceId }, symbol: 'cloud' }]
  for (const zoom of [10, 12, 20]) {
    const groupedPlan = createRoofPlan(prepareRoofAnchors([groupedSource], bars, 'H1', groupedMarkers, true, 1), zoom, true)
    const clipped = projectRoofPlan(groupedPlan, 0, 12).positioned[0]
    assert.ok(clipped, 'The grouped symbol remains connected even with both actual publications beyond the visible range')
    assert.equal(clipped.left, 0, 'Viewport indexing uses the earlier monthly symbol, not the later Services publication')
    assert.equal(clipped.labelX, 20 * zoom)
  }
  const malformed = { ...crossing, sources: [{ ...crossing.sources[0], chartAt: crossing.chartAt + 1 }] }
  assert.equal(prepareRoofAnchors([malformed], bars, 'H1', crossingMarkers, true, 1).length, 0)
  assert.equal(prepareRoofAnchors([crossing], bars, 'H1', [], true, 1).length, 0)
  assert.equal(prepareRoofAnchors([crossing], bars, 'H1', crossingMarkers, false, 1).length, 0)
  const many = { entries: [], prefixRight: [] }; let reads = 0
  for (let i = 0; i < 100000; i++) { const start = i * 200; many.entries.push({ get left() { reads++; return start }, get right() { reads++; return start + 170 },
    roof: { combo }, positioned: null }); many.prefixRight.push(start + 170) }
  assert.equal(projectRoofPlan(many, -5000000, 400).overflow.length, 3)
  assert.ok(reads < 15, 'Panning queries intersecting roof spans rather than scanning the complete plan')

  const scope = roofAuditScope(combo, 'EURUSD', 'Broker A')
  const props = { combo, symbol: 'EURUSD', broker: 'Broker A' }
  const render = value => React.act(async () => root.render(value))
  const observe = async (windowLabel, verdict) => {
    const group = [...container.querySelectorAll('[role="group"]')].find(g => g.getAttribute('aria-label') === windowLabel)
    await React.act(async () => [...group.querySelectorAll('button')].find(b => b.textContent === verdict).click())
  }
  await render(React.createElement(RoofAuditControls, props))
  await observe('Activation H1 candle', 'Opposed'); await observe('Next 4 H1 candles', 'Aligned')
  assert.deepEqual(audit.readRoofAudits()[0].observations, { h1: 'Opposed', next4: 'Aligned' }, 'Different horizons retain separate observations')
  assert.match(container.querySelector('[role="status"]').textContent, /Saved locally/)
  await render(null); await render(React.createElement(RoofAuditControls, props))
  assert.equal(container.querySelectorAll('[aria-pressed="true"]').length, 2, 'Reopening restores the observations')
  await render(React.createElement(RoofAuditControls, { ...props, broker: 'Broker B' }))
  assert.equal(container.querySelectorAll('[aria-pressed="true"]').length, 0, 'Brokers do not share price-audit verdicts')
  await render(React.createElement(RoofAuditControls, { ...props, symbol: 'GBPUSD' }))
  assert.equal(container.querySelectorAll('[aria-pressed="true"]').length, 0, 'Pairs do not share verdicts')
  const changedCombo = { ...combo, after: { ...after, total: 4 } }
  await render(React.createElement(RoofAuditControls, { ...props, combo: changedCombo }))
  assert.equal(container.querySelectorAll('[aria-pressed="true"]').length, 0)
  assert.match(container.textContent, /different interpretation or input configuration/)
  assert.doesNotMatch(container.querySelector('[role="status"]').textContent, /Saved locally/, 'A stale success message does not follow a new snapshot')
  await observe('Activation H1 candle', 'Unclear')
  assert.equal(audit.readRoofAudits().length, 2, 'Both interpretation snapshots remain recorded')
  assert.ok(!sameRoofAudit(scope, roofAuditScope(changedCombo, 'EURUSD', 'Broker A')))
  await render(React.createElement(RoofAuditControls, props))
  await observe('Activation H1 candle', 'Opposed')
  assert.deepEqual(audit.readRoofAudits().find(r => sameRoofAudit(r, scope)).observations, { next4: 'Aligned' }, 'Clicking a selected label clears only that horizon')

  const exported = workspace.exportWorkspace()
  assert.equal(JSON.parse(exported.entries[audit.roofAuditsKey]).length, 2)
  await React.act(async () => { audit.saveRoofObservation(scope, 'next4', null); workspace.restoreWorkspace(exported) })
  assert.equal(audit.readRoofAudits().length, 2, 'Workspace import restores observations and notifies live controls')
  assert.equal(container.querySelectorAll('[aria-pressed="true"]').length, 1)
  assert.ok(validRoofAudits(audit.readRoofAudits()))
  assert.ok(!validRoofAudits([{ ...audit.readRoofAudits()[0], observations: { next4: 'Win' } }]))
  assert.ok(!validRoofAudits([{ ...audit.readRoofAudits()[0], observations: { unknown: 'Aligned' } }]))
  assert.throws(() => workspace.parseWorkspaceSnapshot(JSON.stringify({ ...exported, entries: { [audit.roofAuditsKey]: '[{}]' } })))
  const storageDescriptor = Object.getOwnPropertyDescriptor(dom, 'localStorage'), workingStorage = dom.localStorage
  Object.defineProperty(dom, 'localStorage', { configurable: true, value: {
    getItem: key => workingStorage.getItem(key), setItem: () => { throw new Error('Storage unavailable') },
  } })
  try {
    await observe('Next 24 H1 candles', 'Unclear')
    assert.match(container.querySelector('[role="status"]').textContent, /Kept for this session/)
    assert.equal(audit.readRoofAudits().find(r => sameRoofAudit(r, scope)).observations.next24, 'Unclear', 'Failed persistence retains a session observation')
  } finally {
    if (storageDescriptor) Object.defineProperty(dom, 'localStorage', storageDescriptor)
    else delete dom.localStorage
  }
  assert.equal(JSON.stringify(combo), preserved, 'Display and manual audits never mutate numerical snapshots')
  console.log('✓ Focused priorities and complete access, plain-language conflicts, independent audit horizons, broker/pair/snapshot isolation, clearing and workspace roundtrip')
} finally {
  await React.act(async () => root.unmount()); await server.close(); await dom.happyDOM.abort(); dom.close()
  for (const key of keys) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key] }
}
