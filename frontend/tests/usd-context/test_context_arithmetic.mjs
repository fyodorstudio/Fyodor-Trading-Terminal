import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false } })
try {
  const load = p => server.ssrLoadModule('./src/' + p + '.ts')
  const { combineContext } = await load('scoring-system/context/usd/combine-context')
  const { contextWeights } = await load('scoring-system/context/usd/policy')
  const { eurMembers } = await load('scoring-system/context/relative/memory/eur-members')
  const { relativeContext } = await load('scoring-system/context/relative/relative-context')
  const { explainContext, explainUpdate } = await load('scoring-system/context/usd/explanation')
  const { compareCpiPublication } = await load('scoring-system/context/usd/publication-comparison')
  const at = Date.UTC(2025, 0, 1), close = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-12, label)
  const source = (family, total, coverage = 1) => ({ family, sourceId: family, sourceLabel: family,
    chartAt: at, releaseAt: at, total, coverage, reduced: coverage < 1, usdDirection: total > 0 ? 'stronger' : total < 0 ? 'weaker' : 'uncomputed',
    strength: 'strong', reason: '', explanation: '', changeSize: null, tie: false })
  const combine = (sources, enabled = sources.map(s => s.family)) => combineContext(Object.fromEntries(sources.map(s => [s.family, s])), enabled, at)
  // Reconstruct from component votes, rather than copying the aggregation formula.
  // CPI has only the 20% annual signal, at +3 points: source = +0.6.
  const partialCpi = source('cpi', 3 * .2, .2)
  const assessed = combine([partialCpi, source('nfp', 2), source('ism', 2)])
  close(assessed.members.find(m => m.family === 'cpi').contribution, 3 * .2 * .28,
    'The annual component occupies 20% of the 28% family budget exactly once')
  close(assessed.total, 3 * .2 * .28 + 2 * .30 + 2 * .10)
  assert.equal(assessed.decision.state, 'directional')
  assert.equal(assessed.strength, 'weak')
  assert.match(assessed.explanation, /Available-evidence interpretation only/)
  const all = Object.keys(contextWeights)
  const partialAll = combine(all.map(f => source(f, 4 * .8, .8)))
  close(partialAll.total, 3.2, '80% measured components at +4 occupy 80%, rather than 64%, of the full budget')
  close(partialAll.decision.coverage, .8)
  const unavailable = combine([source('claims', null, 0)], all)
  assert.equal(unavailable.total, null)
  const measuredZero = combine([source('claims', 0)])
  assert.equal(measuredZero.decision.coverage, 1)
  assert.equal(measuredZero.decision.state, 'mixed')
  close(combine([partialCpi, source('nfp', 2), source('ism', 2)], ['cpi', 'nfp', 'ism', 'ism']).total, assessed.total)

  const eurPartial = { slot: 'inflation', family: 'euro-inflation', label: 'Euro inflation', chartAt: at,
    releaseAt: at, reference: 2025 * 12, score: 3 * .2, coverage: .2, provisional: false }
  const members = eurMembers(at, [eurPartial])
  close(members[0].contribution, 3 * .2 / 4 * .4,
    'EUR partial component weight is also retained once before normalization')
  assert.equal(eurMembers(at, [{ ...eurPartial, chartAt: at + 1 }])[0].status, 'unavailable')
  const completeUsd = combine(all.map(f => source(f, 2)))
  const usdPoint = { chartAt: at, result: completeUsd, latest: null, update: '' }
  const euroPoint = { chartAt: at, total: .6, coverage: .8, usableCoverage: .8,
    members: [{ ...members[0], contribution: .6 }], update: '' }
  const relative = relativeContext(euroPoint, usdPoint)
  // A small pair lead is Mixed even if both underlying legs are strong.
  assert.equal(relative.label, 'Mixed evidence')
  const qualified = relativeContext({ ...euroPoint, total: -.6, members: [{ ...members[0], contribution: -.6 }] }, usdPoint)
  assert.equal(qualified.label, 'EURUSD Short')
  assert.equal(qualified.strength, 'weak')
  assert.match(qualified.explanation, /EUR 80.0%, USD 100.0%/)
  const zeroNfp = combine([source('nfp', 0), source('claims', 2)])
  assert.doesNotMatch(explainContext(zeroNfp.direction, zeroNfp.members, false), /outweighs/,
    'An ordinal standalone tie priority is not an opposing net vote')
  assert.match(explainUpdate('Claims', { direction: 'stronger', total: .01,
    decision: { state: 'mixed', reason: '', coverage: 1, agreement: .01 } }, zeroNfp, zeroNfp.members),
    /changes from Mixed evidence to/)
  const oldCpi = combine([source('cpi', 3 * .2, .2)])
  const nextCpi = combine([source('cpi', 3 * .4, .4)])
  const publication = compareCpiPublication({ enabled: ['cpi'], points: [
    { chartAt: at - 1, result: oldCpi }, { chartAt: at, result: nextCpi }] },
    { id: 'cpi', releaseAt: at, chartTime: at / 1000, timingUncertain: false }, at)
  close(publication.voteChange, 3 * .2 * .28,
    'Publication comparison uses exactly the same one-time component budget as Raycaster')
  console.log('✓ Component-to-family budget conservation, no coverage squaring, missing/zero separation, finite chronology and qualified relative direction')
} finally { await server.close() }
