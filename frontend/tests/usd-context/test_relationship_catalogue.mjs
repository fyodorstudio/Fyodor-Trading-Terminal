import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false } })
try {
  const load = p => server.ssrLoadModule('./src/usd-context/' + p + '.ts')
  const { relationshipPairs, macroRelationshipFamilies: families } = await load('sequences/core/relationship-registry')
  const { relationshipSupport: resolve, roofSupport, supportLabel, relationshipResultLabel, relationshipAvailability } = await load('sequences/core/relationship-support')
  const { createIsmFreshMemory, updateIsmFresh } = await load('sequences/core/ism-fresh')
  const { freshNewsAt, freshWindowMs } = await load('sequences/core/fresh-news')
  const { buildContextRelationships } = await load('sequences/core/build-relationships')
  const { withFedRelationshipStages, fedRelationshipSources, coherentFedSources } = await load('sequences/core/fed-relationships')
  const { contextWeights } = await load('core/policy')
  const day = 86400000, at = Date.UTC(2026, 8, 3, 12, 30)
  const source = (family, total, time = at, patch = {}) => ({ family, total, chartAt: time, releaseAt: time - 3 * 3600000,
    sourceId: `${family}/${time}`, sourceLabel: family, usdDirection: total == null ? 'uncomputed' : total > 0 ? 'stronger' : total < 0 ? 'weaker' : 'uncomputed',
    strength: 'moderate', coverage: 1, status: 'active', contribution: total == null ? 0 : total * (contextWeights[family] ?? 0) / 100,
    memory: { retention: 1 }, comparisonBasis: family, calibrationBasis: 'same', ...patch })
  const result = members => ({ direction: 'uncomputed', total: null, strength: null, members, missing: [], explanation: '', reason: '', tie: false })
  const snapshot = (sources, patch = {}) => ({ id: 'test', kind: 'release-relationship', title: 'Test', chartAt: at,
    sources, before: null, after: result(sources.filter(s => s.family !== 'fed')), checks: [], experimental: false, ...patch })
  assert.equal(relationshipPairs.length, 36)
  assert.equal(new Set(relationshipPairs.map(p => [...p.families].sort().join('+'))).size, 36)
  assert.equal(relationshipPairs.filter(p => !p.families.includes('fed')).length, 28)
  assert.equal(relationshipPairs.filter(p => p.families.includes('fed')).length, 8)
  for (const pair of relationshipPairs) assert.equal(new Set(pair.families).size, 2)

  // Exhaust all 247 macro subsets using an independent arithmetic oracle.
  const all = families.map((f, i) => source(f, (i % 2 ? -1 : 1) * (i % 4 + 1), at - i * day,
    { memory: { retention: (10 - i) / 10 }, contribution: 999 }))
  const full = snapshot(all)
  let subsets = 0
  for (let mask = 0; mask < 1 << families.length; mask++) {
    const chosen = families.filter((_, i) => mask & 1 << i)
    if (chosen.length < 2) continue
    subsets++
    const votes = all.filter(s => chosen.includes(s.family)).map(s => s.total * contextWeights[s.family] / 100 * s.memory.retention)
    const r = resolve(full, chosen)
    const expectedLong = votes.reduce((n, v) => n + Math.max(0, -v), 0), expectedShort = votes.reduce((n, v) => n + Math.max(0, v), 0)
    assert.ok(Math.abs(r.long - expectedLong) < 1e-10 && Math.abs(r.short - expectedShort) < 1e-10)
    assert.equal(r.sources.length, chosen.length, 'No duplicates or additional context vote')
    assert.deepEqual(resolve(full, [...chosen, ...chosen]), r, 'Selections deduplicate')
    assert.notEqual(r.state, 'insufficient')
  }
  assert.equal(subsets, 247)
  assert.equal(all[0].contribution, 999, 'Resolver cannot mutate canonical contribution')
  // Low magnitude in a large declared budget can lead over a larger PPI magnitude.
  let r = resolve(snapshot([source('cpi', -1), source('ppi', 4)]))
  assert.equal(supportLabel(r), 'Conflicted · Long leads'); assert.ok(r.long > r.short)
  r = resolve(snapshot([source('claims', -1), source('pce', 1.01)]))
  assert.equal(supportLabel(r), 'Conflicted · Short leads'); assert.equal(r.narrow, true)
  assert.equal(supportLabel(resolve(snapshot([source('claims', -1), source('pce', 1)]))), 'Balanced conflict · No lead')
  assert.equal(supportLabel(resolve(snapshot([source('claims', 0), source('pce', 0)]))), 'Unchanged · No lead')
  const unknown = snapshot([source('claims', -1), source('pce', null)])
  assert.equal(supportLabel(resolve(unknown)), 'Insufficient evidence'); assert.equal(resolve(unknown).direction, null)
  const future = snapshot([source('claims', -1), source('pce', 1, at + 1)])
  assert.equal(resolve(future).state, 'insufficient')
  const expired = snapshot([source('claims', -1), source('pce', 1, at, { status: 'expired' })])
  assert.equal(resolve(expired).state, 'insufficient')
  const policy = snapshot([source('claims', -1), source('nfp', 1)], { kind: 'weekly-labor',
    after: result([source('claims', -1), source('nfp', 1), source('gdp', 2, at, { status: 'expired', contribution: 0 })]) })
  assert.equal(roofSupport(policy).state, 'conflicted', 'An unrelated expired source cannot erase a qualifying policy relationship')
  assert.equal(roofSupport(policy).qualified, true)
  const disabled = snapshot([source('claims', -1)], { catalogue: { enabled: ['claims'], fresh: [], fed: null } })
  assert.equal(relationshipAvailability(disabled, 'cpi', 'release'), 'Input disabled')
  assert.equal(resolve(disabled, ['claims', 'cpi']).state, 'insufficient')
  const fresh = snapshot([source('claims', -1), source('pce', 1)], { catalogue: { enabled: ['claims', 'pce'], fed: null,
    fresh: [source('claims', -1, at, { change: -.1, comparable: true }), source('pce', 1, at, { change: .105, comparable: true })] } })
  assert.equal(supportLabel(resolve(fresh, ['claims', 'pce'], 'fresh')), 'Conflicted · Short leads')
  fresh.catalogue.fresh[1].comparable = false
  assert.equal(resolve(fresh, ['claims', 'pce'], 'fresh').state, 'insufficient')
  fresh.catalogue.fresh[1].comparable = true; fresh.catalogue.fresh[1].chartAt = at - freshWindowMs
  assert.equal(resolve(fresh, ['claims', 'pce'], 'fresh').state, 'insufficient')

  // ISM Manufacturing/Services compare their own consecutive sector readings.
  const memory = createIsmFreshMemory()
  const sector = (name, total, time, reference, patch = {}) => ({ ...source('ism', total, time), sector: name, referenceMonth: reference,
    sourceId: `${name}/${time}`, assessment: source('ism', total, time, { sourceId: `${name}/${time}`, comparisonBasis: name, ...patch }) })
  const oldM = sector('manufacturing', -2, at - 30 * day, 2026 * 12 + 6), oldS = sector('services', 1, at - 28 * day, 2026 * 12 + 6)
  updateIsmFresh(memory, [oldM], source('ism', -.6, oldM.chartAt), undefined, oldM.chartAt)
  updateIsmFresh(memory, [oldM, oldS], source('ism', .1, oldS.chartAt), source('ism', -.6, oldM.chartAt), oldS.chartAt)
  const newM = sector('manufacturing', -1, at - 2 * day, 2026 * 12 + 7)
  const m = updateIsmFresh(memory, [newM], source('ism', -.3, newM.chartAt), source('ism', .1, oldS.chartAt), newM.chartAt)
  assert.equal(m.change, .03); assert.equal(m.comparable, true, 'Partial monthly assembly can still have a comparable sector change')
  const newS = sector('services', -1, at, 2026 * 12 + 7)
  const s = updateIsmFresh(memory, [newM, newS], source('ism', -1), source('ism', -.3, newM.chartAt), at)
  assert.equal(s.change, -.11, 'Manufacturing +.03 and Services -.14 share one 70/30 budget')
  assert.equal(s.scoreChange, -.14, 'Earlier Manufacturing change is not charged again on Services publication')
  assert.ok(Math.abs(s.replacementChange - s.scoreChange - s.calibrationChange - s.memoryRenewal - s.availabilityChange) < 1e-10)
  assert.equal(updateIsmFresh(memory, [newM, newS], source('ism', -1), undefined, at), null, 'Duplicate sector source cannot add votes')
  const flow = freshNewsAt(new Map([['ism', s]]), newM.chartAt + freshWindowMs)
  assert.equal(flow.members[0].change, -.14, 'Each sector expires at its own seven-day boundary')
  const gap = sector('services', 1, at + 30 * day, 2026 * 12 + 9)
  assert.equal(updateIsmFresh(memory, [gap], source('ism', .7, gap.chartAt), undefined, gap.chartAt).comparable, false, 'A missing reference month breaks comparability')
  const calibrationMemory = createIsmFreshMemory()
  const calibratedOld = sector('manufacturing', 4, at - 30 * day, 2026 * 12 + 6,
    { calibrationBasis: 'old', components: [{ id: 'x', value: 1, points: 4, weight: 100, limits: [.1, .2, .3] }] })
  const calibratedNew = sector('manufacturing', 1, at, 2026 * 12 + 7,
    { calibrationBasis: 'new', components: [{ id: 'x', value: 1, points: 1, weight: 100, limits: [2, 3, 4] }] })
  updateIsmFresh(calibrationMemory, [calibratedOld], source('ism', 1.2, calibratedOld.chartAt), undefined, calibratedOld.chartAt)
  const calibrationOnly = updateIsmFresh(calibrationMemory, [calibratedNew], source('ism', .3), source('ism', 1.2, calibratedOld.chartAt), at)
  assert.equal(calibrationOnly.change, 0); assert.equal(calibrationOnly.calibrationChange, -.09, 'Changing sector calibration alone adds no fresh vote')

  // Fed has no magnitude weight, hold no action direction, and extra stages
  // reuse accumulated results without adding Candy/Raycaster publication clocks.
  const macro = source('claims', 1, at - day), hold = source('fed', null, at, { policyAction: { action: 'Rate hold', delta: 0, actual: 4 }, usdDirection: 'uncomputed' })
  const fedCombo = snapshot([macro, hold], { catalogue: { enabled: ['claims'], fresh: [], fed: hold } })
  assert.equal(relationshipResultLabel(fedCombo), 'Rate hold · Aligned · Short')
  assert.equal(resolve(fedCombo).short, .1, 'No artificial Fed budget')
  hold.policyAction = { action: 'Rate reduction', delta: -25, actual: 3.75 }; hold.usdDirection = 'weaker'
  assert.match(relationshipResultLabel(fedCombo), /Conflicted.*Short leads in macro evidence.*Rate reduction/)
  let fedSubsets = 0
  for (let mask = 1; mask < 1 << families.length; mask++) {
    const chosen = families.filter((_, i) => mask & 1 << i)
    const selected = [...chosen, 'fed']
    const c = snapshot([...all, hold], { catalogue: { enabled: families, fresh: [], fed: hold } })
    assert.deepEqual(resolve(c, selected), resolve(c, chosen), 'Every Fed composition retains the exact macro split')
    fedSubsets++
  }
  assert.equal(fedSubsets, 255, 'All 502 USD groups compose on demand, with Fed kept separate')
  const point = { chartAt: at - day, result: result([macro]), latest: macro, update: 'Claims' }, points = [point]
  const augmented = withFedRelationshipStages(points, new Map([[at, hold]]))
  assert.equal(points.length, 1); assert.equal(augmented.length, 2); assert.equal(augmented[1].result, point.result)
  const relationships = buildContextRelationships(augmented, new Map(), new Map(), new Map([[at, hold]]))
  assert.equal(relationships.episodes.filter(e => e.kind === 'fed-relationship').length, 1)
  assert.equal(relationships.episodes[0].after, point.result)
  assert.equal(relationships.episodes[0].before, point.result, 'Fed-only activation does not pretend prior macro context was missing')
  assert.equal(withFedRelationshipStages(points, new Map([[at - 2 * day, hold]])).length, 1, 'No future macro source at an early Fed meeting')
  const firstMacro = { ...point, chartAt: at, result: result([source('claims', 1, at)]) }
  const priorFed = { ...hold, chartAt: at - day }
  const seeded = buildContextRelationships([firstMacro], new Map([[at, result([])]]), new Map(), new Map([[priorFed.chartAt, priorFed]]))
  assert.equal(seeded.episodes.find(e => e.kind === 'fed-relationship').catalogue.fed, priorFed, 'A known meeting before the first macro clock remains eligible')
  assert.equal(fedRelationshipSources([{ familyId: 'fed-chair' }]).size, 0, 'Speech rows are excluded')
  const meeting = id => ({ id, familyId: 'fomc', country: 'US', currency: 'USD', chartTime: at / 1000, releaseAt: at, timingUncertain: false, events: [] })
  const ambiguous = fedRelationshipSources([meeting('a'), meeting('b')]).get(at)
  assert.equal(ambiguous.usdDirection, 'uncomputed'); assert.match(ambiguous.role, /Multiple meetings/)
  assert.equal(ambiguous.policyAction.delta, null)
  assert.equal(coherentFedSources(new Map([[at, { ...hold, releaseAt: at + day }]]), [{ chartAt: at + 1, releaseAt: at }]).size, 0,
    'Later actual availability cannot appear at an earlier broker clock')
  console.log('✓ All 36 pairs / 247 macro subsets, weighted conflict/zero/missing, ISM sector comparability and expiry, separate Fed actions and unchanged accumulated snapshots')
} finally { await server.close() }
