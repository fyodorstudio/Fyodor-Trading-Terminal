import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'), server: { middlewareMode: true, hmr: false } })
try {
  const { assessCpiScoreV3, cpiScoreV3Version, supportsCpiV3 } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/CPI/assessment/cpi-score-v3.ts')
  const { groupInspectorReleases } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  assert.equal(cpiScoreV3Version, 'cpi-eurusd-release-change-v3.1')
  const ids = ['840030005', '840030006', '840030007', '840030008']
  const raw = (value) => value === null ? null : String(Math.round(value * 1e6))
  const reading = (year, referenceMonth, values, prior) => {
    const at = Date.UTC(year, referenceMonth + 1, 12, 12, 30), period = Date.UTC(year, referenceMonth, 1) / 1000
    return ids.map((id, i) => ({ value_id: `${period}:${id}`, event_id: id, name: id,
      currency: 'USD', country_code: 'US', country_name: 'United States', event_code: id,
      server_time_seconds: at / 1000 + 10800, chart_time_seconds: at / 1000 + 10800, release_at: at,
      period_seconds: period, revision: 0, time_mode: 0, importance: 'high', impact: 'none', availability: 'observed',
      unit: 1, multiplier: 0, digits: 1, actual: values[i], previous: prior[i], forecast: 999, revised_previous: -999,
      actual_raw_scaled_1e6: raw(values[i]), previous_raw_scaled_1e6: raw(prior[i]) }))
  }
  const history = []
  for (let i = 0; i < 132; i++) history.push(...reading(2015 + Math.floor(i / 12), i % 12,
    [.1 + (i % 4) * .1, .1 + ((i + 1) % 4) * .1, 3, 3 + (i % 3) * .1],
    [.2, .2, 3, 3 + ((i + 2) % 3) * .1]))
  const withMonths = (core, headline) => [...history, ...[3, 4, 5].flatMap((m, i) =>
    reading(2026, m, [headline[i], core[i], 3, 3], [.2, .2, 3, 3]))]
  const select = (core, headline, annual = 3, previousAnnual = 3) => groupInspectorReleases(
    reading(2026, 6, [headline, core, 3, annual], [.2, .2, 3, previousAnnual]))[0]

  // August 2026-style rebound: headline -0.4 -> +0.1 does not force Short.
  const augustHistory = withMonths([.4, .2, 0], [.6, .5, -.4])
  const august = select(.2, .1, 2.5, 2.6), score = assessCpiScoreV3(august, augustHistory)
  assert.equal(score.label, 'EURUSD Long')
  assert.deepEqual(score.readings.map((r) => r.value), [0, -.066666666667, -.1, -.133333333333])
  assert.equal(score.reduced, false); assert.equal(score.strength, 'strong')
  assert.equal(score.total, score.readings.reduce((sum, row) => sum + row.points * row.weight, 0) / 100)
  // October 2025-style latest deceleration overrides v2's static level pressure.
  const coolingHistory = withMonths([.2, .3, .3], [.2, .3, .4]), cooling = select(.2, .3, 3, 3.1)
  const cool = assessCpiScoreV3(cooling, coolingHistory)
  assert.equal(cool.label, 'EURUSD Long')
  assert.deepEqual(cool.readings.map((r) => r.value), [-.066666666667, 0, -.1, 0])
  assert.match(cool.explanation, /below its recent average/)
  assert.equal(cool.changeSize, 'Modest change', 'Clear agreement can describe a modest historical change')
  assert.equal(cool.strength, 'strong')
  const hotHistory = withMonths([.3, .4, .5], [.3, .4, .5]), hot = select(.6, .6, 3.3, 3.2)
  assert.equal(assessCpiScoreV3(hot, hotHistory).label, 'EURUSD Short')
  const coreOnlyHistory = withMonths([.3, .4, .5], [.4, .4, .4])
  const coreOnly = assessCpiScoreV3(select(.6, .4), coreOnlyHistory)
  assert.equal(coreOnly.label, 'EURUSD Short')
  assert.equal(coreOnly.supportingGroups, 1)
  assert.equal(coreOnly.strength, 'moderate', 'Two related core monthly signals cannot supply two separate confirmations')
  assert.match(coreOnly.strengthReason, /One evidence group/)

  assert.equal(assessCpiScoreV3(null, history), null)
  for (const change of [{ familyId: 'jobs' }, { country: 'EU' }, { currency: 'EUR' }])
    assert.equal(supportsCpiV3({ ...august, ...change }), false)
  const future = reading(2026, 7, [99, 99, 99, 99], [-99, -99, -99, -99])
  assert.deepEqual(assessCpiScoreV3(august, [...augustHistory, ...august.events, ...future]), score)
  assert.deepEqual(assessCpiScoreV3(august, [...augustHistory, ...augustHistory]), score)
  const noise = (e) => ({ ...e, forecast: -1e9, forecast_raw_scaled_1e6: 'bad', revised_previous: 1e9,
    revised_previous_raw_scaled_1e6: 'bad' })
  assert.deepEqual(assessCpiScoreV3({ ...august, events: august.events.map(noise) }, augustHistory.map(noise)), score)
  const early = groupInspectorReleases(reading(2015, 4, [.1, .1, 3, 2.9], [.2, .2, 3, 3]))[0]
  assert.equal(assessCpiScoreV3(early, history).label, 'Uncomputed')
  assert.equal(assessCpiScoreV3({ ...august, timingUncertain: true }, history).label, 'Uncomputed')

  // Annual-only releases can score honestly without inventing missing monthly data.
  const annualOnly = { ...august, events: august.events.filter((e) => e.event_id === '840030008') }
  const partial = assessCpiScoreV3(annualOnly, augustHistory)
  assert.equal(partial.label, 'EURUSD Long'); assert.equal(partial.strength, 'weak')
  assert.equal(partial.availableWeight, 20); assert.equal(partial.reduced, true)
  assert.match(partial.strengthReason, /Limited data/)
  assert.deepEqual(partial.readings.map((r) => r.points), [null, null, -1, null])
  assert.equal(assessCpiScoreV3({ ...august, events: august.events.filter((e) => e.event_id === '840030005') }, augustHistory).label,
    'Uncomputed', 'Headline alone must not decide')
  const withoutAnnual = { ...august, events: august.events.filter((e) => e.event_id !== '840030008') }
  assert.equal(assessCpiScoreV3(withoutAnnual, augustHistory).label, 'EURUSD Long')
  const monthly = augustHistory.find((e) => e.event_id === '840030006' && e.period_seconds === Date.UTC(2026, 5, 1) / 1000)
  const lackingMonth = augustHistory.filter((e) => e !== monthly)
  const gapScore = assessCpiScoreV3(august, lackingMonth)
  assert.deepEqual(gapScore.readings.slice(0, 2).map((r) => r.points), [null, null])
  assert.equal(gapScore.label, 'EURUSD Long'); assert.equal(gapScore.strength, 'weak')
  assert.deepEqual(assessCpiScoreV3(august, [...augustHistory, { ...monthly, value_id: 'duplicate' }]), gapScore)
  assert.deepEqual(assessCpiScoreV3(august, augustHistory.map((e) => e === monthly ?
    { ...e, availability: 'not-returned-by-latest-query' } : e)), gapScore)
  const revision = { ...monthly, value_id: 'revision', actual: .3, actual_raw_scaled_1e6: '300000', revision: 1 }
  assert.deepEqual(assessCpiScoreV3(august, [...augustHistory, { ...revision, release_at: august.releaseAt + 1 }]), score)
  assert.equal(assessCpiScoreV3(august, [...augustHistory, { ...revision, release_at: august.releaseAt - 1 }]).readings[0].value,
    -.1, 'Only a revision published earlier may replace an earlier actual')
  for (const change of [{ unit: 0 }, { multiplier: 1 }, { actual: null }, { actual_raw_scaled_1e6: 'bad' },
    { currency: 'EUR' }, { country_code: 'EU' }, { availability: 'not-returned-by-latest-query' }, { time_mode: 1 },
    { release_at: august.releaseAt + 1 }, { period_seconds: 0 }, { period_seconds: Date.UTC(2026, 7, 1) / 1000 }]) {
    const invalid = { ...august, events: august.events.map((e) => e.event_id === '840030006' ? { ...e, ...change } : e) }
    assert.deepEqual(assessCpiScoreV3(invalid, augustHistory).readings.slice(0, 2).map((r) => r.points), [null, null], JSON.stringify(change))
  }
  const wrongMonth = { ...august, events: august.events.map((e) => e.event_id === '840030006' ?
    { ...e, period_seconds: Date.UTC(2026, 5, 1) / 1000 } : e) }
  assert.equal(assessCpiScoreV3(wrongMonth, augustHistory).label, 'Uncomputed')
  const duplicateAnnual = { ...august, events: [...august.events, { ...august.events[3], value_id: 'annual-duplicate' }] }
  assert.equal(assessCpiScoreV3(duplicateAnnual, augustHistory).readings[2].points, null)
  const noPrevious = { ...august, events: august.events.map((e) => e.event_id === '840030008' ? { ...e, previous: null } : e) }
  assert.equal(assessCpiScoreV3(noPrevious, augustHistory).readings[2].points, null)

  const flatHistory = withMonths([.4, .4, .4], [.4, .4, .4])
  const flat = select(.4, .4)
  assert.equal(assessCpiScoreV3(flat, flatHistory).label, 'Uncomputed', 'High unchanged levels do not invent fresh directional evidence')
  const tieHistory = withMonths([.3, .1, .1], [.3, .3, .3]), tie = select(.2, .3)
  const tied = assessCpiScoreV3(tie, tieHistory)
  assert.equal(tied.total, 0); assert.equal(tied.tieBreak.id, 'fresh')
  assert.equal(tied.label, 'EURUSD Short'); assert.equal(tied.strength, 'weak')
  const opposed = assessCpiScoreV3(select(.6, -2, 2.5, 3), hotHistory)
  assert.equal(opposed.label, 'EURUSD Short', 'A large headline drop cannot automatically outweigh the core monthly votes')
  assert.equal(opposed.strength, 'weak', 'Near cancellation is disclosed without a Mixed label')
  assert.match(opposed.strengthReason, /Conflicting readings/)
  console.log('✓ V3 fresh pace, rebound/deceleration, partial data, earlier-only calibration, weights, cancellation and evidence grades')

} finally { await server.close() }
