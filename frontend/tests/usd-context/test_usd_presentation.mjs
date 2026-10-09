import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false } })
try {
  const load = p => server.ssrLoadModule('./src/' + p + '.ts')
  const { combineContext } = await load('scoring-system/context/usd/combine-context')
  const { contextResultLabel } = await load('scoring-system/context/usd/usd-pair')
  const { contextFamilyExpiry } = await load('scoring-system/context/usd/policy')
  const { usdContextPresentation: present, usdPresentationUpdate } = await load('raycaster/core/usd-context-presentation')
  const { raycasterLabel } = await load('raycaster/ui/raycaster-label')
  const { buildRibbonTimeline } = await load('raycaster/ribbon/ribbon-timeline')
  const { relativeContext } = await load('scoring-system/context/relative/relative-context')
  const at = Date.UTC(2026, 0, 1), day = 86400000
  const source = (family, total, patch = {}) => ({ family, total, chartAt: at, releaseAt: at, sourceId: family, sourceLabel: family.toUpperCase(),
    usdDirection: total > 0 ? 'stronger' : total < 0 ? 'weaker' : 'uncomputed', strength: 'moderate', reduced: false, tie: false, coverage: 1,
    reason: '', explanation: '', ...patch })
  const combine = (sources, clock = at, enabled = sources.map(s => s.family)) => combineContext(Object.fromEntries(sources.map(s => [s.family, s])), enabled, clock)
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`)
  const freeze = o => { if (o && typeof o === 'object') { Object.values(o).forEach(freeze); Object.freeze(o) } return o }
  const narrow = freeze(combine([source('cpi', 3), source('nfp', -2.7)]))
  const original = JSON.stringify(narrow), p = present('EURUSD', narrow, at)
  assert.equal(contextResultLabel('EURUSD', narrow), 'Mixed evidence', 'Publication and relative gates remain unchanged')
  assert.equal(p.state, 'conflicted'); assert.equal(p.direction, 'short'); assert.equal(p.evidence, 'weak'); assert.equal(p.narrow, true)
  assert.match(p.label, /Conflicted · Short leads/)
  close(p.long, .81); close(p.short, .84); close(p.net, -.03); close(p.separation, .03 / 1.65)
  assert.deepEqual(p.leaders, ['CPI'])
  assert.equal(present('EURUSD', narrow, at + day), p, 'Immutable snapshots share their cached presentation')
  assert.notEqual(present('EURUSD', { ...narrow }, at), p, 'A rebuilt snapshot cannot reuse stale support')
  assert.equal(present('EURUSD', narrow, at - 1).state, 'insufficient', 'Cache cannot bypass a caller clock before publication')
  assert.equal(JSON.stringify(narrow), original, 'Presentation leaves canonical snapshots intact')
  for (const symbol of ['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'EURUSD.a']) {
    assert.equal(present(symbol, narrow).direction, 'short'); close(present(symbol, narrow).short, .84)
  }
  for (const symbol of ['USDJPY', 'USDCHF', 'USDCAD', 'USDJPY.a']) {
    const inverse = present(symbol, narrow)
    assert.equal(inverse.direction, 'long'); close(inverse.long, p.short); close(inverse.net, -p.net)
  }
  assert.equal(present('EURGBP', narrow).state, 'insufficient')
  assert.equal(present('EURUSD', null).state, 'insufficient')
  const balanced = combine([source('cpi', 3), source('nfp', -2.8)])
  assert.notEqual(balanced.direction, 'uncomputed', 'Legacy priority can pick a raw tie side')
  assert.equal(present('EURUSD', balanced).state, 'balanced'); assert.equal(present('EURUSD', balanced).direction, null)
  assert.equal(present('EURUSD', balanced).evidence, null)
  const zero = present('EURUSD', combine([source('claims', 0)]))
  assert.equal(zero.state, 'unchanged'); assert.equal(zero.direction, null); assert.equal(zero.coverage, 1)
  assert.equal(present('EURUSD', combine([source('claims', null)])).state, 'insufficient', 'Unavailable is distinct from measured zero')
  const aligned = present('EURUSD', combine([source('cpi', 2, { strength: 'strong' }), source('nfp', 2, { strength: 'strong' })]))
  assert.equal(aligned.state, 'aligned'); assert.equal(aligned.evidence, 'strong')
  const broad = present('EURUSD', combine([source('cpi', 3), source('nfp', -.5)]))
  assert.equal(broad.state, 'conflicted'); assert.equal(broad.narrow, false); assert.equal(broad.evidence, 'moderate')
  const partial = combine([source('cpi', 1, { coverage: .6, reduced: true })])
  const qualified = present('EURUSD', partial)
  close(qualified.short, .28); close(qualified.coverage, .6)
  assert.equal(qualified.evidence, 'weak', 'Coverage qualifies a score, rather than scaling it a second time')
  assert.equal(present('EURUSD', combine([source('cpi', 1, { coverage: .599 })])).state, 'insufficient')
  assert.equal(present('EURUSD', combine([source('claims', 1)], at, ['claims', 'cpi'])).state, 'insufficient', 'Unusable configured budgets cannot invent a lead')
  for (const invalid of [{ ...narrow, total: NaN }, { ...narrow, total: Infinity }, { ...narrow, total: 100 },
    { ...narrow, members: [narrow.members[0], narrow.members[0]] },
    { ...narrow, members: narrow.members.map(m => ({ ...m, contribution: NaN })) },
    { ...narrow, decision: { ...narrow.decision, coverage: NaN } }]) assert.equal(present('EURUSD', invalid).state, 'insufficient')

  // The display uses resolved policy votes, even when base weights would lead the other way.
  const labor = combine([source('cpi', 1, { traits: { kind: 'cpi', monthlyCore: .2, threeMonthCore: .2, annualCore: 3, monthlyPressure: 1, annualPressure: 1 } }),
    source('nfp', -.5, { strength: 'strong', traits: { kind: 'nfp', hiringChange: -10, unemploymentSignal: -1 } })])
  assert.equal(labor.policy.mode, 'labor-priority')
  assert.ok(1 * .28 - .5 * .30 > 0, 'Base weights would favor USD strength in this fixture')
  const lp = present('EURUSD', labor)
  assert.equal(lp.direction, 'long'); close(lp.long, .25); close(lp.short, .08)
  const weekly = combine([source('nfp', 1, { strength: 'weak' }), source('claims', -2, { chartAt: at + 15 * day, traits: { kind: 'claims', streak: 3, confirmed: true } })], at + 15 * day)
  assert.equal(weekly.policy.mode, 'weekly-labor-priority')
  close(present('EURUSD', weekly).long, .4)
  close(present('EURUSD', weekly).short, .2 * 2 ** (-15 / 30))

  // A retained lead can change at memory and expiry clocks without a publication.
  const inputs = [source('nfp', 1), source('claims', -3)]
  const points = [at, at + 7 * day, at + contextFamilyExpiry('claims')].map(chartAt => ({ chartAt, result: combine(inputs, chartAt), latest: inputs[1],
    update: chartAt === at ? 'Atomic publications' : 'Memory update: older votes lose influence' }))
  const ribbon = buildRibbonTimeline({ points }, null, false, 'EURUSD')
  assert.deepEqual(ribbon.map(r => [r.direction, r.presentation.direction, r.kind]), [['balanced', null, 'publication'], ['conflicted', 'short', 'memory'], ['short', 'short', 'expiry']])
  for (const r of ribbon) {
    const pp = present('EURUSD', r.usd.result, r.at)
    assert.equal(r.presentation, pp); assert.equal(r.label, pp.label); assert.equal(r.evidence, pp.evidence)
    assert.equal(raycasterLabel({ loading: false, message: null, cutoff: r.at, relative: null, result: r.usd.result, symbol: 'EURUSD' }), r.label)
  }
  assert.match(usdPresentationUpdate('EURUSD', points[0], ribbon[0].presentation), /NFP.*CLAIMS.*Accumulated context:.*No lead/)
  assert.equal(ribbon[1].update, points[1].update, 'Aging does not become invented news')
  const eur = { points: [{ chartAt: at, total: .4, coverage: 1, usableCoverage: 1, members: [{ chartAt: at, contribution: .4, coverage: 1, status: 'active' }], update: 'EUR publication' }] }
  const relative = buildRibbonTimeline({ points }, eur, true, 'EURUSD')
  for (const r of relative) {
    const expected = relativeContext(r.eur, r.usd)
    assert.equal(r.label, expected.label); assert.equal(r.direction, expected.direction); assert.equal(r.evidence, expected.strength)
    assert.equal(r.explanation, expected.explanation); assert.equal('presentation' in r, false, 'USD display metadata never enters relative points')
    assert.equal(raycasterLabel({ loading: false, message: null, cutoff: r.at, relative: expected, result: r.usd.result, symbol: 'EURUSD' }), expected.label)
  }
  console.log('✓ USD retained-policy support, pair orientation, weak narrow leads, zero/missing/clock gates, caching, memory/expiry, shared labels and unchanged relative semantics')
} finally { await server.close() }
