import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false } })
try {
  const load = p => server.ssrLoadModule('./src/' + p + '.ts')
  const { interpretationQuality } = await load('usd-context/core/interpretation-quality')
  const { combineContext } = await load('usd-context/core/combine-context')
  const { contextResultLabel, contextResultTone } = await load('usd-context/core/usd-pair')
  const { relativeContext } = await load('pair-context/core/relative-context')
  const { eurConfiguredWeight } = await load('pair-context/core/eur-quality')
  const { buildRibbonTimeline } = await load('raycaster/ribbon/ribbon-timeline')
  const at = Date.UTC(2025, 0, 1), day = 86400000
  const source = (family, total, coverage = 1, patch = {}) => ({ family, sourceId: family, sourceLabel: family, chartAt: at, releaseAt: at,
    total, coverage, usdDirection: total > 0 ? 'stronger' : total < 0 ? 'weaker' : 'uncomputed', strength: 'moderate', reduced: coverage < 1,
    tie: false, reason: '', explanation: '', ...patch })
  const combine = (sources, enabled = sources.map(s => s.family), clock = at) => combineContext(Object.fromEntries(sources.map(s => [s.family, s])), enabled, clock)
  assert.equal(interpretationQuality(1, 2, .599).state, 'insufficient')
  assert.equal(interpretationQuality(1, 2, .6).state, 'directional')
  assert.equal(interpretationQuality(1, 4, 1).state, 'mixed')
  assert.equal(interpretationQuality(0, 0, 1).state, 'mixed')
  assert.equal(interpretationQuality(null, 0, 1).state, 'insufficient')
  const primary = combine([source('cpi', 1, .2), source('nfp', 2), source('ism', 2)])
  assert.ok(primary.total > 0, 'The raw score remains auditable')
  assert.equal(primary.decision.state, 'directional', 'Available overall evidence can qualify a direction despite a partial primary')
  assert.equal(primary.strength, 'weak', 'Incomplete evidence never silently becomes a complete-context conclusion')
  assert.match(primary.explanation, /CPI.*missing, incomplete or expired/)
  assert.equal(contextResultLabel('EURUSD', primary), 'EURUSD Short')
  assert.equal(contextResultTone(primary), 'short')
  const selected = combine([source('claims', 1)])
  assert.equal(selected.decision.coverage, 1, 'An explicitly selected subset uses its configured budget')
  assert.equal(contextResultLabel('EURUSD', selected), 'EURUSD Short')
  assert.equal(contextResultLabel('USDJPY', selected), 'USDJPY Long')
  const old = combine([source('claims', 1)], ['claims'], at + 7 * day)
  assert.equal(old.decision.coverage, 1, 'Usability and age retention remain distinct')
  assert.equal(old.members[0].memory.retention, .5)
  const neutral = combine([source('claims', 0)])
  assert.equal(neutral.members[0].status, 'active', 'A measured zero is usable evidence')
  assert.equal(neutral.total, 0)
  assert.equal(contextResultLabel('EURUSD', neutral), 'Mixed evidence')
  const absent = combine([source('claims', null)])
  assert.equal(absent.members[0].status, 'unavailable')
  assert.equal(absent.total, null)
  assert.equal(contextResultLabel('EURUSD', absent), 'Insufficient context')
  const cancelled = combine([source('nfp', -2.8), source('cpi', 3)])
  assert.equal(cancelled.total, 0)
  assert.equal(contextResultLabel('EURUSD', cancelled), 'Mixed evidence', 'A raw priority tie cannot leak into combined output')
  const mixed = combine([source('nfp', -2.7), source('cpi', 3)])
  assert.ok(mixed.total > 0)
  assert.equal(contextResultLabel('EURUSD', mixed), 'Mixed evidence')
  const eur = { total: .5, coverage: 1, usableCoverage: 1, members: [{ contribution: .5, coverage: 1, status: 'active', provisional: false }] }
  const usd = { chartAt: at, latest: { chartAt: at }, result: selected, update: 'Claims publication' }
  assert.equal(relativeContext(null, usd).label, 'Insufficient context')
  assert.equal(relativeContext({ ...eur, usableCoverage: .4 }, usd).label, 'Insufficient context')
  assert.equal(relativeContext(eur, { ...usd, result: primary }).label, 'Mixed evidence', 'Relative agreement is tested independently of USD leg direction')
  assert.equal(relativeContext({ ...eur, total: .8, members: [{ ...eur.members[0], contribution: .8 }] }, { ...usd, result: primary }).strength, 'weak')
  assert.equal(relativeContext(eur, usd).label, 'EURUSD Long')
  const exactEur = { ...eur, total: selected.total / 4, members: [{ ...eur.members[0], contribution: selected.total / 4 }] }
  assert.equal(relativeContext(exactEur, usd).label, 'Mixed evidence')
  assert.equal(eurConfiguredWeight(['euro-inflation', 'german-inflation']), 40, 'Overlapping proxies do not expand a budget')
  assert.equal(eurConfiguredWeight(['euro-labor']), 30)
  const points = [{ ...usd, result: primary }, { ...usd, chartAt: at + day, result: mixed }]
  const ribbon = buildRibbonTimeline({ points, version: 'v7' }, null, false, 'EURUSD')
  assert.deepEqual(ribbon.map(p => p.direction), ['short', 'mixed'])
  assert.equal(ribbon[0].evidence, 'weak')
  assert.ok(!/Long|Short/.test(ribbon[1].label) && ribbon[1].evidence === null, 'Candy never leaks a withheld raw pressure as direction')
  const sparse = combine([source('cpi', .5, .2)])
  assert.equal(sparse.decision.state, 'insufficient', 'Partial primary alone does not satisfy the overall usable-budget rule')
  for (const args of [[NaN, 1, 1], [Infinity, 1, 1], [1, Infinity, 1], [1, -1, 1], [1, 1, NaN], [1, 1, 1.1], [2, 1, 1]]) {
    const decision = interpretationQuality(...args)
    assert.equal(decision.state, 'insufficient', 'Invalid numerical context never acquires a direction')
    assert.ok(Number.isFinite(decision.coverage) && Number.isFinite(decision.agreement))
  }
  const future = combine([source('claims', 1, 1, { chartAt: at + day })])
  assert.equal(future.total, null, 'A directly supplied future source cannot vote at the earlier clock')
  assert.equal(combine([source('claims', 1)], ['claims', 'claims']).decision.coverage, 1, 'Duplicate enabled inputs do not expand the denominator')
  console.log('✓ Qualified available-evidence direction, zero vs missing, finite gates, subset budgets, no primary veto, age separation, pair modes and Candy parity')
} finally { await server.close() }
