import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { history, latestRows, families, settings } from './fixtures.mjs'

const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), server: { middlewareMode: true, hmr: false } })
try {
  const { combineContext } = await server.ssrLoadModule('./src/scoring-system/context/usd/combine-context.ts')
  const { buildContextTimeline } = await server.ssrLoadModule('./src/scoring-system/context/usd/build-context-timeline.ts')
  const { contextAt } = await server.ssrLoadModule('./src/scoring-system/context/usd/context-lookup.ts')
  const { compareCpiPublication } = await server.ssrLoadModule('./src/scoring-system/context/usd/publication-comparison.ts')
  const { groupInspectorReleases } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { contextWeights, contextExpiryMs } = await server.ssrLoadModule('./src/scoring-system/context/usd/policy.ts')
  const { ContextInputTable } = await server.ssrLoadModule('./src/usd-context/ui/ContextInputTable.tsx')
  const { ContextPolicyDetails } = await server.ssrLoadModule('./src/usd-context/ui/ContextPolicyDetails.tsx')
  const { resolveLaborInflationPolicy } = await server.ssrLoadModule('./src/scoring-system/context/usd/interaction/labor-inflation-policy.ts')
  const source = (family, total, patch = {}) => ({ family, sourceId: family, sourceLabel: family,
    chartAt: 1, releaseAt: 1, total, usdDirection: total > 0 ? 'stronger' : 'weaker', strength: 'strong',
    reduced: false, tie: false, explanation: '', reason: '', changeSize: 'Noticeable change', ...patch })
  const cpiTraits = { kind: 'cpi', monthlyCore: .3, threeMonthCore: .233333333333,
    annualCore: 3.1, monthlyPressure: 2, annualPressure: 2 }
  const nfpTraits = { kind: 'nfp', hiringChange: -81.333333333, unemploymentSignal: -.1 }
  const inputs = { nfp: source('nfp', -1.3, { traits: nfpTraits }), cpi: source('cpi', 1.45, { traits: cpiTraits }),
    claims: source('claims', .2, { strength: 'moderate' }), ism: source('ism', -1.055), retail: source('retail', 2) }
  const enabled = ['nfp', 'cpi', 'claims', 'ism', 'retail']
  const combine = (next = inputs, selected = enabled, at = 1) => combineContext(next, selected, at)
  const result = combine()
  assert.equal(result.policy.mode, 'labor-priority'); assert.equal(result.direction, 'weaker')
  assert.equal(result.total, -.4795); assert.equal(result.strength, 'moderate')
  assert.equal(result.members.find(m => m.family === 'cpi').total, 1.45, 'Standalone CPI is preserved')
  assert.equal(result.policy.weights.nfp, 50); assert.equal(result.policy.weights.cpi, 8)
  assert.equal(Object.values(result.policy.weights).reduce((sum, n) => sum + n, 0), 100)
  const original = combine({ ...inputs, cpi: { ...inputs.cpi, traits: undefined } })
  assert.equal(original.total, .0705); assert.equal(original.direction, 'stronger')
  const newInflation = combine({ ...inputs, pce: source('pce', 3) }, [...enabled, 'pce'])
  assert.equal(newInflation.policy.mode, 'balanced', 'Strong accelerating PCE blocks the CPI-only labor transfer')
  assert.equal(combine({ ...inputs, pce: source('pce', -3) }, [...enabled, 'pce']).policy.mode, 'labor-priority')
  const september = combine({ ...inputs, nfp: source('nfp', -1.05, { traits: nfpTraits }), cpi: source('cpi', 1.6, { traits: cpiTraits }),
    claims: source('claims', -1.8), ism: source('ism', .305), retail: source('retail', .65) })
  assert.equal(september.direction, 'weaker'); assert.equal(september.total, -.501)

  for (const patch of [{ monthlyCore: .4 }, { threeMonthCore: .301 }, { annualCore: 3.6 },
    { monthlyPressure: 3 }, { annualPressure: 3 }, { monthlyCore: null }, { annualCore: NaN }, { monthlyCore: Infinity }]) {
    const blocked = combine({ ...inputs, cpi: { ...inputs.cpi, traits: { ...cpiTraits, ...patch } } })
    assert.equal(blocked.policy.mode, 'balanced'); assert.deepEqual(blocked.policy.weights, contextWeights)
    assert.equal(blocked.direction, 'stronger', 'Inflation guards must prevent an unconditional labor override')
  }
  for (const patch of [{ strength: 'moderate' }, { strength: 'weak' }, { reduced: true },
    { traits: { ...nfpTraits, hiringChange: 1 } }, { traits: { ...nfpTraits, unemploymentSignal: 0 } },
    { traits: null }, { total: null, usdDirection: 'uncomputed' }]) {
    assert.equal(combine({ ...inputs, nfp: { ...inputs.nfp, ...patch } }).policy.mode, 'balanced')
  }
  assert.equal(combine({ ...inputs, cpi: { ...inputs.cpi, reduced: true } }).policy.mode, 'balanced')
  assert.equal(combine({ ...inputs, cpi: source('cpi', -1, { traits: cpiTraits }) }).policy.mode, 'balanced')
  assert.equal(combine(inputs, enabled.filter(f => f !== 'cpi')).policy.mode, 'balanced')
  assert.equal(combine(inputs, enabled.filter(f => f !== 'nfp')).policy.mode, 'balanced')
  assert.equal(combine(inputs, enabled, contextExpiryMs + 1).policy.mode, 'balanced')
  assert.equal(combine(inputs, ['cpi']).total, .406, 'Disabled labor cannot create shifted priorities')
  assert.equal(combine(inputs, enabled.filter(f => f !== 'retail')).total, -.6195, 'Missing weights are not redistributed')
  const capped = combine({ ...inputs, nfp: source('nfp', -4, { traits: nfpTraits }) })
  assert.equal(capped.strength, 'moderate', 'An opposing CPI cannot provide Strong combined confirmation')
  const opposingActivity = combine({ ...inputs, claims: source('claims', 4), ism: source('ism', 4), retail: source('retail', 4) })
  assert.equal(opposingActivity.policy.mode, 'labor-priority')
  assert.equal(opposingActivity.direction, 'stronger', 'A priority change is not a forced Long override; all enabled votes still count')
  // Literal guards include their boundaries and tolerate only arithmetic noise.
  const edge = combine({ ...inputs, cpi: { ...inputs.cpi, traits: { ...cpiTraits, monthlyCore: .30000000000000004,
    threeMonthCore: .3, annualCore: 3.5 } } })
  assert.equal(edge.policy.mode, 'labor-priority')
  assert.equal(resolveLaborInflationPolicy(result.members, { monthlyCore: .25, threeMonthCore: .25, annualCore: 3.5, pressure: 2 }).mode, 'balanced')
  assert.equal(resolveLaborInflationPolicy(result.members, { monthlyCore: .35, threeMonthCore: .35, annualCore: 3.5, pressure: 2 }).mode, 'labor-priority')

  const html = renderToStaticMarkup(React.createElement(React.Fragment, null,
    React.createElement(ContextInputTable, { families: enabled, result, symbol: 'EURUSD', loading: false, unavailable: false,
      cutoff: 1, timeDisplay: { mode: 'utc', utcOffsetMinutes: 0 }, summaryLabel: 'EURUSD Long' }),
    React.createElement(ContextPolicyDetails, { policy: result.policy })))
  assert.match(html, /8%<small>Base 28%/); assert.match(html, /50%<small>Base 30%/)
  assert.match(html, /Source \+1.45 × 8%/); assert.match(html, /Labor priority/)
  assert.match(html, /declared ceiling 0.3%/); assert.match(html, /not probabilities or confirmation of a Fed cut/)

  // End-to-end traits come from canonical validated features; future/survey noise cannot change them.
  const selected = latestRows.filter(e => e.event_id.startsWith('84003000'))
  const changes = new Map([['840030005', .3], ['840030006', .3], ['840030008', 3.1]])
  const events = [...history, ...latestRows.map(e => changes.has(e.event_id) ? { ...e, actual: changes.get(e.event_id),
    actual_raw_scaled_1e6: String(Math.round(changes.get(e.event_id) * 1e6)) } : e)]
  const release = groupInspectorReleases(events).find(r => r.releaseAt === selected[0].release_at && r.familyId === 'us-cpi')
  const input = { events, families, settings, asOf: Date.UTC(2018, 7, 1) }
  const timeline = buildContextTimeline(input), point = contextAt(timeline, release.chartTime * 1000)
  assert.equal(point.result.policy.mode, 'labor-priority')
  assert.equal(point.result.members.find(m => m.family === 'cpi').traits.monthlyCore, .3)
  assert.equal(point.result.members.find(m => m.family === 'cpi').usdDirection, 'stronger')
  assert.equal(point.result.direction, 'weaker')
  const replay = buildContextTimeline({ ...input, events: events.filter(e => e.release_at <= release.releaseAt), asOf: release.releaseAt })
  assert.deepEqual(contextAt(replay, release.chartTime * 1000), point)
  assert.deepEqual(buildContextTimeline({ ...input, events: events.map(e => ({ ...e, forecast: -999 })) }), timeline)
  const manual = buildContextTimeline({ ...input, settings: { ...settings, cpi: { fresh: [.001, .002, .003] } } })
  const manualPoint = contextAt(manual, release.chartTime * 1000)
  assert.equal(manualPoint.result.members.find(m => m.family === 'cpi').traits.monthlyPressure, 4)
  assert.equal(manualPoint.result.policy.mode, 'balanced', 'Applied magnitudes change the escalation gate alongside the standalone scorer')
  assert.equal(manualPoint.result.members.find(m => m.family === 'cpi').traits.monthlyCore, .3, 'Manual magnitudes never alter actual readings')
  const comparison = compareCpiPublication(timeline, release, input.asOf)
  assert.deepEqual(compareCpiPublication(replay, release, input.asOf), comparison)
  assert.match(comparison.explanation, /Context priorities changed to Labor priority/)
  assert.match(comparison.explanation, /CPI source replacement at prior weight/)
  assert.match(comparison.explanation, /Other existing votes also use the new priorities/)
  console.log('✓ Conditional labor priority, inflation escalation guards, missing/disabled/expired data, effective weights, counterexamples, source parity and chronological replay')
} finally { await server.close() }
