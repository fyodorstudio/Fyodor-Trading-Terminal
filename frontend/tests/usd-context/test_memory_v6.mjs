import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { history, latestRows, families, settings, claims } from './fixtures.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const server = await createServer({ root, server: { middlewareMode: true, hmr: false } })
try {
  const load = p => server.ssrLoadModule('./src/usd-context/core/' + p + '.ts')
  const { combineContext } = await load('combine-context')
  const { buildContextTimeline } = await load('build-context-timeline')
  const { contextAt } = await load('context-lookup')
  const { sourceMemory, contextDayMs: day } = await load('memory/source-retention')
  const { sourceCoverage } = await load('source-coverage')
  const { claimsConfirmation } = await load('memory/claims-confirmation')
  const at = Date.UTC(2020, 0, 1, 12)
  const source = (family, total, age = 0, patch = {}) => ({ family, sourceId: family, sourceLabel: family,
    releaseAt: at - age * day, chartAt: at - age * day, total,
    usdDirection: total > 0 ? 'stronger' : 'weaker', strength: 'strong', reduced: false,
    tie: false, coverage: 1, explanation: '', reason: '', changeSize: null, ...patch })
  for (const [family, halfLife] of [['claims', 7], ['nfp', 30], ['cpi', 30], ['gdp', 90]]) {
    assert.equal(sourceMemory(source(family, 2, halfLife), at, 10).retention, .5)
    assert.equal(sourceMemory(source(family, 2, halfLife), at, 10).effectiveWeight, 5)
  }
  const partial = source('cpi', -.6, 0, { coverage: .2, reduced: true })
  assert.equal(combineContext({ cpi: partial }, ['cpi'], at).total, -.0336)
  assert.equal(partial.total, -.6, 'Context caution never changes standalone totals')
  assert.equal(sourceCoverage([{ points: 2, weight: 15, baseWeight: 30 }, { points: 1, weight: 70 }]), 1,
    'An intentional participation qualifier is not missing data')
  assert.equal(sourceCoverage([{ points: null, weight: 80 }, { points: -3, weight: 20 }]), .2)
  for (const coverage of [NaN, Infinity, -1, 0, 1.1]) {
    const result = combineContext({ cpi: { ...partial, coverage } }, ['cpi'], at)
    assert.equal(result.direction, 'uncomputed'); assert.equal(result.members[0].contribution, 0)
    assert.ok(Number.isFinite(result.members[0].memory.effectiveWeight))
  }
  const weekly = [source('claims', .5, 14), source('claims', .2, 7)]
  const current = source('claims', 1, 0, { strength: 'moderate' })
  const traits = claimsConfirmation(current, weekly)
  assert.equal(traits.confirmed, true); assert.equal(traits.streak, 3)
  for (const preceding of [[weekly[0]], [weekly[0], { ...weekly[1], usdDirection: 'weaker' }],
    [weekly[0], { ...weekly[1], releaseAt: at - 3 * day }],
    [weekly[0], { ...weekly[1], coverage: .79 }], [weekly[0], { ...weekly[1], reduced: true }]]) {
    assert.equal(claimsConfirmation(current, preceding).confirmed, false)
  }
  assert.equal(claimsConfirmation({ ...current, total: 0 }, weekly).confirmed, false)
  assert.equal(claimsConfirmation({ ...current, strength: 'weak' }, weekly).confirmed, false)
  const nfp = source('nfp', -1, 14, { strength: 'weak' })
  const confirmed = { ...current, traits }
  const resolution = combineContext({ nfp, claims: confirmed }, ['nfp', 'claims'], at)
  assert.equal(resolution.policy.mode, 'weekly-labor-priority')
  assert.equal(resolution.policy.weights.nfp, 20); assert.equal(resolution.policy.weights.claims, 20)
  assert.equal(Object.values(resolution.policy.weights).reduce((a, b) => a + b, 0), 100)
  assert.equal(resolution.members.length, 2, 'Prior weekly observations add no extra votes')
  for (const patch of [{ chartAt: at - 13 * day }, { strength: 'strong' }, { usdDirection: 'stronger', total: 1 }]) {
    assert.equal(combineContext({ nfp: { ...nfp, ...patch }, claims: confirmed }, ['nfp', 'claims'], at).policy.mode, 'balanced')
  }
  assert.equal(combineContext({ nfp, claims: confirmed }, ['nfp'], at).policy.mode, 'balanced')
  const inverse = combineContext({ nfp: { ...nfp, total: 1, usdDirection: 'stronger' },
    claims: { ...confirmed, total: -1, usdDirection: 'weaker' } }, ['nfp', 'claims'], at)
  assert.equal(inverse.policy.mode, 'weekly-labor-priority'); assert.equal(inverse.direction, 'weaker')

  const events = [...history, ...latestRows, ...claims(180, [250, 1.87, 250])]
  const input = { events, families, settings, asOf: Date.UTC(2018, 7, 1) }
  const timeline = buildContextTimeline(input)
  const boundary = timeline.points.find(p => p.chartAt % day === 0 &&
    p.result.members.some(m => m.status === 'active') && p.update.startsWith('Memory update'))
  assert.ok(boundary, 'Aging updates are present between publications')
  assert.equal(contextAt(timeline, boundary.chartAt - 1).latest.sourceId, boundary.latest.sourceId)
  const replay = buildContextTimeline({ ...input, asOf: boundary.latest.releaseAt,
    events: events.filter(e => e.release_at <= boundary.latest.releaseAt) })
  assert.deepEqual(contextAt(replay, boundary.chartAt), boundary, 'Later releases cannot change an earlier daily memory boundary')
  assert.deepEqual(buildContextTimeline({ ...input, events: events.map(e => ({ ...e, forecast: -999 })) }), timeline)
  assert.equal(buildContextTimeline({ ...input, families: [] }).points.length, 0)
  console.log('✓ Cadence retention, component coverage, bounded/symmetric weekly labor, counterexamples, daily chronology and forecast isolation')
} finally { await server.close() }
