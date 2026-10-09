import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { settings, families, history, latestRows, cpi } from './fixtures.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const server = await createServer({ root, server: { middlewareMode: true, hmr: false } })
try {
  const { combineContext } = await server.ssrLoadModule('./src/scoring-system/context/usd/combine-context.ts')
  const { buildContextTimeline } = await server.ssrLoadModule('./src/scoring-system/context/usd/build-context-timeline.ts')
  const { contextAt } = await server.ssrLoadModule('./src/scoring-system/context/usd/context-lookup.ts')
  const { scorePublication } = await server.ssrLoadModule('./src/scoring-system/context/usd/score-publication.ts')
  const { contextExpiryMs, contextFamilyExpiry } = await server.ssrLoadModule('./src/scoring-system/context/usd/policy.ts')
  const { usdPair, contextPairLabel } = await server.ssrLoadModule('./src/scoring-system/context/usd/usd-pair.ts')
  const { candleContextCutoff } = await server.ssrLoadModule('./src/raycaster/chart/candle-cutoff.ts')
  const { explainUpdate } = await server.ssrLoadModule('./src/scoring-system/context/usd/explanation.ts')
  const { groupInspectorReleases } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const source = (family, total, patch = {}) => ({ family, sourceId: family, sourceLabel: family, releaseAt: 1, chartAt: 1,
    total, usdDirection: total > 0 ? 'stronger' : 'weaker', strength: 'strong', reason: '', explanation: '',
    changeSize: 'Large change', reduced: false, tie: false, ...patch })
  // A smaller positive replacement can enlarge the opposite context's lead;
  // the explanation must not describe that positive release as USD weakness.
  const positiveGdp = { ...source('gdp', 1.9), sourceLabel: 'GDP', status: 'active', contribution: .057 }
  const replacement = explainUpdate('GDP', { direction: 'weaker', total: -.398 },
    { direction: 'weaker', total: -.44 }, [positiveGdp])
  assert.match(replacement, /GDP supports USD strength/)
  assert.match(replacement, /remains USD-weakness with a larger weighted lead/)
  const atomic = explainUpdate('GDP + CPI', { direction: 'weaker', total: -.4 },
    { direction: 'weaker', total: -.2 }, [positiveGdp,
      { ...source('cpi', -.6), sourceLabel: 'CPI', status: 'active', contribution: -.168 }])
  assert.match(atomic, /GDP supports USD strength; CPI supports USD weakness/)
  assert.match(atomic, /a smaller weighted lead/)
  assert.match(explainUpdate('CPI', { direction: 'weaker', total: -.1 },
    { direction: 'stronger', total: .1 }, [{ ...positiveGdp, sourceLabel: 'CPI', status: 'unavailable' }]),
    /CPI: no usable new vote\. Combined context changes to the USD-strength bias/)
  assert.match(explainUpdate('GDP', { direction: 'stronger', total: .1 },
    { direction: 'stronger', total: .1 }, [{ ...positiveGdp, total: 0, contribution: 0 }]), /zero net source vote/)
  const initial = { nfp: source('nfp', -4), cpi: source('cpi', 1), ism: source('ism', 2) }
  const result = combineContext(initial, ['nfp', 'cpi', 'ism'], 1)
  assert.equal(result.total, -.72); assert.equal(result.direction, 'weaker'); assert.equal(result.strength, 'moderate')
  assert.match(result.explanation, /Labor evidence outweighs/)
  const agreeing = combineContext({ ...initial, cpi: source('cpi', -2) }, ['nfp', 'cpi', 'ism'], 1)
  assert.equal(agreeing.direction, 'weaker'); assert.equal(agreeing.strength, 'strong')
  assert.equal(combineContext({ ...initial, cpi: source('cpi', -2, { strength: 'moderate' }) }, ['nfp', 'cpi', 'ism'], 1).strength, 'moderate')
  const tie = combineContext({ nfp: source('nfp', -2.8), cpi: source('cpi', 3) }, ['nfp', 'cpi'], 1)
  assert.equal(tie.total, 0); assert.equal(tie.direction, 'stronger'); assert.equal(tie.strength, null)
  assert.equal(tie.decision.state, 'mixed', 'Raw tie priority remains internal; combined output abstains')
  assert.equal(combineContext({ cpi: source('cpi', 0, { tie: true, usdDirection: 'stronger' }) }, ['cpi'], 1).direction, 'stronger')
  assert.equal(combineContext({}, ['cpi'], 1).direction, 'uncomputed')
  assert.equal(combineContext(initial, ['cpi'], 1).total, .28, 'Disabled weights must not be redistributed')
  assert.equal(combineContext(initial, ['nfp', 'cpi', 'ism'], contextExpiryMs + 1).direction, 'uncomputed')
  const unavailable = combineContext({ ...initial, nfp: source('nfp', null, { usdDirection: 'uncomputed' }) }, ['nfp', 'cpi', 'ism'], 1)
  assert.equal(unavailable.total, .48); assert.equal(unavailable.strength, null)
  assert.equal(unavailable.decision.state, 'insufficient')
  const spending = combineContext({ ...initial, retail: source('retail', -4) }, ['nfp', 'cpi', 'ism', 'retail'], 1)
  assert.equal(spending.total, -1); assert.equal(spending.members.find(m => m.family === 'retail').contribution, -.28)
  assert.equal(combineContext({ ...initial, retail: source('retail', -4) }, ['ism', 'retail'], 1).total, -.08)
  const laborConflict = combineContext({ nfp: source('nfp', -4), cpi: source('cpi', -4), claims: source('claims', 1) }, ['nfp', 'cpi', 'claims'], 1)
  assert.equal(laborConflict.strength, 'moderate'); assert.match(laborConflict.reason, /NFP and Claims disagree/)
  assert.equal(combineContext({ nfp: source('nfp', -4), claims: source('claims', -4) }, ['nfp', 'claims'], 1).strength, 'moderate', 'Two labor sources cannot replace inflation confirmation')
  const weekly = combineContext({ claims: source('claims', -4) }, ['claims'], 1)
  assert.equal(weekly.total, -.4)
  assert.equal(combineContext({ claims: source('claims', -4) }, ['claims'], contextFamilyExpiry('claims')).direction, 'weaker')
  assert.equal(combineContext({ claims: source('claims', -4) }, ['claims'], contextFamilyExpiry('claims') + 1).direction, 'uncomputed')
  for (const pair of ['EURUSD', 'GBPUSD.a', 'AUDUSDm', 'NZDUSD']) assert.match(contextPairLabel(pair, 'weaker'), /Long$/)
  for (const pair of ['USDJPY', 'USDCHF.a', 'USDCAD']) assert.match(contextPairLabel(pair, 'weaker'), /Short$/)
  for (const unsupported of ['EURJPY', 'BTCUSD', 'XAUUSD', 'EURUSDXUSD']) assert.equal(usdPair(unsupported), null)
  const candle = Date.UTC(2026, 7, 7, 15) / 1000
  assert.equal(candleContextCutoff(candle, 'H1', Infinity, 10800), (candle + 3600) * 1000 - 1)
  assert.equal(candleContextCutoff(candle, 'H1', candle * 1000 - 10800000 + 1000, 10800), candle * 1000 + 1000)

  const events = [...history, ...latestRows], asOf = Date.UTC(2018, 7, 1)
  const input = { events, asOf, families, settings }, timeline = buildContextTimeline(input)
  const publications = groupInspectorReleases(latestRows)
  for (const publication of publications) {
    const at = publication.chartTime * 1000
    const full = contextAt(timeline, at), earlier = contextAt(timeline, at - 1)
    assert.equal(full.latest.releaseAt, publication.releaseAt)
    const expected = scorePublication(publication, events, settings)
    assert.deepEqual(full.result.members.find(m => m.family === expected.family).total, expected.total)
    assert.equal(full.result.members.find(m => m.family === expected.family).reduced, expected.reduced)
    assert.notEqual(earlier?.latest.sourceId, publication.id)
    const replay = buildContextTimeline({ ...input, events: events.filter(e => e.release_at <= publication.releaseAt), asOf: publication.releaseAt })
    assert.deepEqual(contextAt(replay, at), full, 'Later publications cannot change earlier context')
  }
  const manufacturing = publications.find(p => p.familyId === 'ism-manufacturing')
  const services = publications.find(p => p.familyId === 'ism-services')
  assert.equal(contextAt(timeline, manufacturing.chartTime * 1000).result.members.find(m => m.family === 'ism').reduced, true)
  assert.equal(contextAt(timeline, services.chartTime * 1000).result.members.find(m => m.family === 'ism').sourceId, services.id)
  const retailRelease = publications.find(p => p.familyId === 'retail')
  assert.equal(contextAt(timeline, retailRelease.chartTime * 1000).result.members.find(m => m.family === 'retail').sourceId, retailRelease.id)
  const retailOnly = buildContextTimeline({ ...input, families: ['retail'] })
  assert.ok(retailOnly.points.every(p => p.result.members.every(m => m.family === 'retail')))
  const claimReleases = publications.filter(p => p.familyId === 'claims')
  const lastClaims = claimReleases.toSorted((a, b) => a.releaseAt - b.releaseAt).at(-1)
  const claimOnly = buildContextTimeline({ ...input, families: ['claims'] })
  const latestClaims = contextAt(claimOnly, lastClaims.chartTime * 1000)
  assert.equal(latestClaims.result.members.length, 1, 'Weekly publications replace one slot, never accumulate')
  assert.equal(latestClaims.result.members[0].sourceId, lastClaims.id)
  assert.equal(contextAt(claimOnly, lastClaims.chartTime * 1000 + contextFamilyExpiry('claims')).result.direction, 'uncomputed')
  const single = buildContextTimeline({ ...input, families: ['ism-manufacturing'] })
  assert.ok(single.points.every(p => p.result.members.every(m => m.family === 'ism')))
  assert.equal(single.points.some(p => p.latest.sourceLabel === 'ISM Services'), false)
  assert.deepEqual(buildContextTimeline({ ...input, events: events.map(e => ({ ...e, forecast: -999 })) }), timeline)
  assert.deepEqual(buildContextTimeline({ ...input, events: [...events, ...events] }), timeline)
  const bad = buildContextTimeline({ ...input, events: events.map(e => ({ ...e, chart_time_seconds: null })) })
  assert.equal(bad.points.length, 0); assert.ok(bad.excludedTiming > 0)
  const corrected = events.map(e => e.release_at === services.releaseAt ? { ...e, chart_time_seconds: 1 } : e)
  assert.throws(() => buildContextTimeline({ ...input, events: corrected }), /inconsistent chart clocks/)
  assert.equal(contextAt(timeline, 0), null)
  assert.equal(contextAt(timeline, NaN), null)
  const expired = contextAt(timeline, timeline.points.at(-1).chartAt)
  assert.equal(expired.result.direction, 'uncomputed')
  assert.ok(expired.result.members.every(m => m.status === 'expired'))
  const future = cpi(2030, 0, [9, 9, 9])
  assert.deepEqual(buildContextTimeline({ ...input, events: [...events, ...future] }), timeline)
  console.log('✓ USD context weights, memory, chronological replay, expiry, disabled/missing gates, ties, pair inversion and H1 boundaries')
} finally { await server.close() }
