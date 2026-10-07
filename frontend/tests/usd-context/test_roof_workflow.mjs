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
    sources: inputs.map((s, i) => ({ ...s, change: i ? .05 : -.2 })), before: null, after,
    direction: 'weaker', strength: 'weak', explanation: 'Test snapshot', checks: [], experimental: true }
  const preserved = JSON.stringify(combo)
  const summary = comboSummary(combo)
  assert.match(summary.why, /Jobless Claims updates favor USD weakness, outweighing opposing changes from PCE/)
  assert.equal(summary.activation, 'pce', 'Activation names only the publication at the qualification time')
  assert.equal(comboSummary({ ...combo, chartAt: at + 1 }).activation, 'Memory update; no new publication')
  assert.match(comboSummary({ ...combo, sources: combo.sources.map(s => ({ ...s, change: s.family === 'claims' ? -.1 : .1 })) }).why, /cancel/)
  assert.match(comboSummary({ ...combo, direction: 'uncomputed' }).why, /do not establish/)
  assert.match(comboSummary({ ...combo, kind: 'ism-sectors', sources: [{ ...inputs[0], usdDirection: 'uncomputed' }, inputs[1]] }).why, /Only part/)

  const candidate = (id, props = {}) => ({ combo: { ...combo, id, ...props }, left: 100, right: 300, labelX: 200, ticks: [100, 300], hidden: 0 })
  const crowded = [candidate('old'), candidate('new', { chartAt: at + 1 }), candidate('established', { kind: 'weekly-labor', experimental: false }),
    candidate('strong', { kind: 'ism-sectors', strength: 'strong', experimental: false }), candidate('far', { chartAt: at + 2 })]
  crowded.at(-1).left = 600; crowded.at(-1).right = 700; crowded.at(-1).labelX = 650
  const focused = layoutRoofs(crowded, true)
  assert.deepEqual(focused.positioned.map(p => p.combo.id).sort(), ['established', 'far', 'strong'], 'Evidence and established relationships take priority before freshness')
  assert.equal(focused.overflow.length, 2)
  assert.deepEqual(layoutRoofs(crowded.slice(0, 2), true).positioned.map(p => p.combo.id), ['new'], 'Newest repeated combination is the representative')
  for (const focus of [true, false]) {
    const result = layoutRoofs(crowded, focus)
    assert.deepEqual([...result.positioned.map(p => p.combo.id), ...result.overflow.map(c => c.id)].sort(), crowded.map(p => p.combo.id).sort(), 'Every roof remains accessible')
    for (const lane of new Set(result.positioned.map(p => p.lane))) {
      const labels = result.positioned.filter(p => p.lane === lane).sort((a, b) => a.labelX - b.labelX)
      for (let i = 1; i < labels.length; i++) assert.ok(labels[i].labelX - labels[i - 1].labelX >= 178, 'Same-lane labels do not overlap')
    }
  }

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
