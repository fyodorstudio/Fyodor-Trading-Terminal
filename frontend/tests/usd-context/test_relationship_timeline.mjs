import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false } })
try {
  const load = p => server.ssrLoadModule('./src/' + p)
  const { combineContext } = await load('usd-context/core/combine-context.ts')
  const { buildRelationshipTimeline } = await load('usd-context/sequences/core/relationship-timeline.ts')
  const { roofSupport } = await load('usd-context/sequences/core/relationship-support.ts')
  const { buildRoofRibbonTimeline } = await load('raycaster/ribbon/roof-ribbon-timeline.ts')
  const { ribbonIndex } = await load('raycaster/ribbon/ribbon-timeline.ts')
  const { roofAuditScope } = await load('usd-context/sequences/audit/audit-model.ts')
  const at = Date.UTC(2026, 0, 1, 12, 30), day = 86400000
  const source = (family, total, chartAt = at, sourceId = family) => ({ family, total, chartAt, releaseAt: chartAt,
    sourceId, sourceLabel: family.toUpperCase(), usdDirection: total > 0 ? 'stronger' : total < 0 ? 'weaker' : 'uncomputed',
    strength: 'moderate', reduced: false, tie: false, coverage: 1, reason: '', explanation: '', changeSize: null })
  const context = (members, chartAt) => {
    const result = combineContext(Object.fromEntries(members.map(s => [s.family, s])), ['cpi', 'claims', 'retail'], chartAt)
    return { chartAt, result, latest: members.find(s => s.chartAt === chartAt) ?? null, update: 'Canonical update' }
  }
  const inputs = [source('cpi', 2), source('claims', -2), source('retail', 0)]
  const first = context(inputs, at)
  const combo = { id: 'pair/cpi-claims', kind: 'release-relationship', title: 'CPI + Claims', chartAt: at,
    sources: first.result.members.filter(s => s.family !== 'retail'), before: null, after: first.result,
    direction: 'stronger', strength: 'moderate', explanation: '', checks: [], experimental: false,
    catalogue: { enabled: ['cpi', 'claims', 'retail'], fresh: [], fed: null } }
  const unrelated = context([inputs[0], inputs[1], source('retail', -4, at + 1000)], at + 1000)
  const changed = context([inputs[0], source('claims', 3, at + day, 'claims-new'), inputs[2]], at + day)
  const timeline = { points: [first, unrelated, changed, context([inputs[0], changed.result.members[1], inputs[2]], at + 16 * day)],
    enabled: ['cpi', 'claims', 'retail'], version: 'test', excludedTiming: 0, relationships: { episodes: [combo], fresh: [] } }
  const original = JSON.stringify([timeline, combo])
  const points = buildRelationshipTimeline(timeline, combo)
  assert.deepEqual(points[0].support, roofSupport(combo), 'Activation exactly reuses the roof support')
  assert.equal(points[0].at, at)
  assert.equal(points[0].support.state, 'conflicted')
  assert.equal(points.some(p => p.at === at + 1000), false, 'Unrelated release does not become a selected pair update')
  const newClaims = points.find(p => p.at === at + day)
  assert.equal(newClaims.kind, 'publication'); assert.equal(newClaims.support.state, 'aligned')
  assert.equal(newClaims.support.direction, 'short')
  assert.deepEqual(newClaims.support.sources.map(s => s.family), ['cpi', 'claims'])
  assert.equal(points.at(-1).support.state, 'insufficient', 'Missing selected participant does not shrink to the survivor')
  assert.equal(points.at(-1).support.direction, null); assert.equal(points.at(-1).kind, 'expiry')
  assert.equal(JSON.stringify([timeline, combo]), original, 'Display projection never mutates canonical inputs')
  const ribbon = buildRoofRibbonTimeline(timeline, combo)
  assert.equal(ribbonIndex(ribbon, at - 1), -1, 'No relationship before activation')
  assert.equal(ribbon[0].direction, 'conflicted')
  const before = buildRelationshipTimeline({ ...timeline, points: timeline.points.slice(0, 2) }, combo)
  assert.deepEqual(points.filter(p => p.at < at + day), before, 'Future removal preserves every earlier reading')
  const aged = context(inputs, at + day)
  const aging = buildRelationshipTimeline({ ...timeline, points: [first, aged] }, combo)
  assert.equal(aging[1].kind, 'aging')
  assert.ok(aging[1].support.long < aging[0].support.long)
  assert.ok(aging[1].support.short < aging[0].support.short)

  // Fresh changes are distinct from positive standalone source scores.
  const freshSources = first.result.members.filter(s => s.family !== 'retail').map((s, i) => ({ ...s,
    change: i ? .1 : -.5, comparable: true }))
  const freshCombo = { ...combo, id: 'fresh/cpi-claims', kind: 'fresh-news', sources: freshSources,
    catalogue: { ...combo.catalogue, fresh: freshSources }, strength: 'weak' }
  const freshTimeline = { ...timeline, points: [first, context(inputs, at + 8 * day)],
    relationships: { episodes: [freshCombo], fresh: [{ chartAt: at, members: freshSources, total: -.4, direction: 'weaker', agreeingDomains: 1, explanation: '' }] } }
  const freshPoints = buildRelationshipTimeline(freshTimeline, freshCombo)
  assert.equal(freshPoints[0].support.direction, 'long')
  assert.equal(freshPoints.find(p => p.at === at + 7 * day).support.state, 'insufficient', 'Exact seven-day cutoff is projected without a later publication')
  assert.equal(freshPoints.find(p => p.at === at + 7 * day).kind, 'expiry')
  assert.equal(freshPoints[0].evidence, 'weak')
  const companion = { ...source('ppi', 0), change: 0, comparable: false }
  const withCompanion = { ...freshCombo, sources: [...freshSources, companion], catalogue: { ...freshCombo.catalogue, fresh: [...freshSources, companion] } }
  const companionTimeline = { ...freshTimeline, points: [first, context(inputs, at + day), context(inputs, at + 8 * day)], relationships: {
    ...freshTimeline.relationships, episodes: [withCompanion], fresh: [{ ...freshTimeline.relationships.fresh[0], members: [...freshSources, companion] }] } }
  assert.equal(buildRelationshipTimeline(companionTimeline, withCompanion).some(p => p.at === at + day && p.support.state === 'insufficient'), false,
    'A non-voting fresh companion must not become a required participant on the next aging stage')

  // A named policy stops being active; unrelated macro votes belong to its
  // combined scope while it is active, unlike a generic pair.
  const policyFirst = { ...first, result: { ...first.result, policy: { ...first.result.policy, mode: 'weekly-labor-priority' } } }
  const policyCombo = { ...combo, kind: 'weekly-labor', after: policyFirst.result }
  const policyTimeline = { ...timeline, points: [policyFirst, unrelated], relationships: { episodes: [policyCombo], fresh: [] } }
  const policyPoints = buildRelationshipTimeline(policyTimeline, policyCombo)
  assert.equal(policyPoints[0].support.sources.length, 3)
  assert.equal(policyPoints[1].support.state, 'insufficient')
  assert.match(policyPoints[1].support.missing.join(' '), /rule is inactive/)

  // ISM resolves original sector contributions, never two full family votes.
  const ism = source('ism', .8, at, 'ism-assembled')
  const ismContext = { chartAt: at, result: combineContext({ ism }, ['ism'], at), latest: ism, update: '' }
  const sectorInputs = [
    { ...source('ism', 2, at, 'services'), sourceLabel: 'ISM Services', sector: 'services', contribution: 1.4, status: 'active' },
    { ...source('ism', -2, at - day, 'manufacturing'), sourceLabel: 'ISM Manufacturing', sector: 'manufacturing', contribution: -.6, status: 'active' },
  ]
  const ismCombo = { ...combo, id: 'ism/roof', kind: 'ism-sectors', title: 'ISM sectors', sources: sectorInputs, after: ismContext.result }
  const pending = source('ism', -.6, at + 30 * day, 'ism-pending')
  const pendingContext = { chartAt: pending.chartAt, result: combineContext({ ism: pending }, ['ism'], pending.chartAt), latest: pending, update: '' }
  const ismTimeline = { ...timeline, enabled: ['ism'], points: [ismContext, pendingContext], relationships: { episodes: [ismCombo], fresh: [],
    ismSources: [{ sourceId: ism.sourceId, sources: sectorInputs }, { sourceId: pending.sourceId, sources: [sectorInputs[1]] }] } }
  const ismPoints = buildRelationshipTimeline(ismTimeline, ismCombo)
  assert.equal(ismPoints[0].support.short, 1.4); assert.equal(ismPoints[0].support.long, .6)
  assert.equal(ismPoints[1].support.state, 'insufficient', 'Pending sector is not replaced with an older month')

  const action = { ...source('fed', null, at), policyAction: { action: 'Cut', delta: -25, actual: 4.25 } }
  const fedCombo = { ...combo, kind: 'fed-relationship', sources: [first.result.members[0], action], catalogue: { ...combo.catalogue, fed: action } }
  const fedTimeline = { ...timeline, points: [first, context(inputs, at + 46 * day)],
    relationships: { episodes: [fedCombo], fresh: [], fedSources: [action] } }
  const fedPoints = buildRelationshipTimeline(fedTimeline, fedCombo)
  assert.equal(fedPoints[0].support.votes.length, 1, 'Fed basis points never enter support shares')
  assert.equal(fedPoints.find(p => p.at === at + 45 * day).support.state, 'insufficient')
  // Selecting a later Fed action chooses the pair, not the beginning of history.
  const claimsContext = (time, total, id) => ({ chartAt: time,
    result: combineContext({ claims: source('claims', total, time, id) }, ['claims'], time), latest: source('claims', total, time, id), update: '' })
  const historicalContexts = [claimsContext(at, -1, 'early-claims'), claimsContext(at + day, 1, 'hold-claims'),
    claimsContext(at + 10 * day, -2, 'cut-claims'), claimsContext(at + 20 * day, 3, 'increase-claims'), claimsContext(at + 66 * day, 1, 'late-claims')]
  const actions = [['Hold', 0, 1], ['Cut', -25, 10], ['Increase', 25, 20]].map(([name, delta, days]) => ({
    ...source('fed', null, at + days * day, 'fed-' + name), usdDirection: delta > 0 ? 'stronger' : delta < 0 ? 'weaker' : 'uncomputed',
    policyAction: { action: name, delta, actual: 4.25 } }))
  const historicalCombos = actions.map((fedAction, i) => ({ ...fedCombo, id: 'claims-fed/' + i, chartAt: fedAction.chartAt,
    sources: [historicalContexts[i + 1].result.members[0], fedAction], after: historicalContexts[i + 1].result,
    checks: [], catalogue: { enabled: ['claims'], fresh: [], fed: fedAction } }))
  const historicalTimeline = { ...timeline, enabled: ['claims'], points: historicalContexts,
    relationships: { episodes: historicalCombos, fresh: [], fedSources: actions } }
  const immutableHistory = JSON.stringify(historicalTimeline)
  const completeHistory = buildRelationshipTimeline(historicalTimeline, historicalCombos[2], true)
  assert.equal(completeHistory[0].at, at)
  assert.equal(completeHistory[0].support.state, 'insufficient', 'No future Fed action is backfilled')
  for (const historicalCombo of historicalCombos) {
    const point = completeHistory.find(p => p.at === historicalCombo.chartAt)
    assert.deepEqual(point.support, roofSupport(historicalCombo), 'Each historical publication preserves its canonical shares')
    assert.equal(point.snapshot, historicalCombo)
    assert.equal(point.support.votes.length, 1, 'No Fed action type becomes a numerical vote')
    assert.match(point.label, new RegExp(historicalCombo.catalogue.fed.policyAction.action, 'i'))
  }
  assert.equal(completeHistory.find(p => p.at === at + 65 * day).support.state, 'insufficient', 'Latest action expires at its own boundary')
  assert.deepEqual(buildRelationshipTimeline(historicalTimeline, historicalCombos[0], true), completeHistory,
    'Selecting a different date or Fed action of the same pair yields the same history')
  for (const point of completeHistory) {
    assert.ok(point.snapshot.sources.every(s => s.chartAt <= point.at), 'Historical snapshots contain no future source')
    assert.ok(!point.snapshot.catalogue.fed || point.snapshot.catalogue.fed.chartAt <= point.at)
  }
  const truncatedHistory = { ...historicalTimeline, points: historicalContexts.slice(0, 3), relationships: {
    ...historicalTimeline.relationships, episodes: historicalCombos.slice(0, 2), fedSources: actions.slice(0, 2) } }
  assert.deepEqual(buildRelationshipTimeline(truncatedHistory, historicalCombos[1], true), completeHistory.filter(p => p.at <= at + 10 * day),
    'Removing future history preserves every earlier segment')
  assert.equal(buildRoofRibbonTimeline(historicalTimeline, historicalCombos[2])[0].at, at, 'Production Candy includes pre-selection history')
  assert.equal(JSON.stringify(historicalTimeline), immutableHistory)
  const states = points => points.map(p => ({ at: p.at, support: p.support, kind: p.kind }))
  assert.deepEqual(states(buildRelationshipTimeline(freshTimeline, freshCombo, true)), states(freshPoints),
    'Full fresh history retains exact seven-day boundaries')
  const audit = JSON.parse(roofAuditScope(combo, 'EURUSD', 'Broker').snapshot)
  assert.equal(audit.kind, combo.kind); assert.equal(audit.displayedSupport.state, 'conflicted')
  assert.equal(audit.presentationVersion, 'support-display-v1')
  assert.equal(audit.displayedSupport.short, roofSupport(combo).short)
  assert.notEqual(roofAuditScope(combo, 'EURUSD', 'Broker').snapshot, roofAuditScope(combo, 'EURUSD', 'Broker', points.at(-1).support).snapshot)
  console.log('✓ Selected relationship activation parity, fixed scope, aging/replacement/expiry, exact fresh cutoff, policy inactivity, ISM sectors, Fed separation, future removal and displayed audit provenance')
} finally { await server.close() }
