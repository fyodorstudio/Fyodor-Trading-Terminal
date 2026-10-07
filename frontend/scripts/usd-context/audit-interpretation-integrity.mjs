// Numerical acceptance replay. No price series, forecast surprise or outside notes are inputs.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const [inputFile, outputFile] = process.argv.slice(2)
if (!outputFile) throw Error('Usage: audit-interpretation-integrity.mjs <frozen input.json> <new output.json>')
if (fs.existsSync(outputFile)) throw Error('Existing audit reports are not overwritten; choose a new output file.')
const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'))
const server = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'),
  server: { middlewareMode: true, hmr: false } })
const close = (actual, expected, label) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-9, label)
const count = (rows, key) => rows.reduce((result, row) => { const name = key(row); result[name] = (result[name] ?? 0) + 1; return result }, {})
try {
  const load = p => server.ssrLoadModule('./src/' + p + '.ts')
  const { buildContextTimeline } = await load('usd-context/core/build-context-timeline')
  const { contextAt } = await load('usd-context/core/context-lookup')
  const { contextResultLabel } = await load('usd-context/core/usd-pair')
  const { buildEurContextTimeline } = await load('pair-context/core/eur-context-timeline')
  const { eurContextAt, relativeContext } = await load('pair-context/core/relative-context')
  const { buildRibbonTimeline } = await load('raycaster/ribbon/ribbon-timeline')
  const { currentScorerLabels } = await load('inspector/scoring/shared/core/current-scoring-versions')
  const usd = buildContextTimeline(input.inputUSD), eur = buildEurContextTimeline(input.inputEUR)
  const assessments = new Map(), samples = [], counts = {}, outliers = []
  for (const point of usd.points) {
    assert.ok(Number.isFinite(point.chartAt))
    const result = point.result
    if (result.total !== null) close(result.total, result.members.reduce((n, m) => n + m.contribution, 0), 'USD sum equals displayed total')
    close(Object.values(result.policy.weights).reduce((a, b) => a + b, 0), 100, 'Policy budgets total 100%')
    for (const member of result.members) {
      assert.ok(member.chartAt <= point.chartAt, 'No future source in a snapshot')
      if (member.status !== 'active') { assert.equal(member.contribution, 0); continue }
      const expected = member.components.reduce((n, c) => n + (c.points ?? 0) * c.weight / 100, 0)
      close(member.total, expected, 'Canonical standalone equals component budget')
      close(member.contribution, expected * result.policy.weights[member.family] / 100 * member.memory.retention,
        'Every component has exactly one family weight and retention factor')
      assert.ok(Math.abs(member.total) <= 4 * member.coverage + 1e-9, 'Partial components never expand to a complete budget')
    }
    for (const member of result.members.filter(m => m.chartAt === point.chartAt)) assessments.set(member.sourceId, member)
    if (result.decision.state !== 'directional') assert.ok(!/ (Long|Short)$/.test(contextResultLabel('EURUSD', result)))
    else if (result.decision.coverage < 1 - 1e-12) assert.equal(result.strength, 'weak')
  }
  for (const a of assessments.values()) {
    const c = counts[a.family] ??= { publications: 0, computed: 0, incomplete: 0, directions: {}, components: {} }
    c.publications++; c.computed += a.total !== null; c.incomplete += a.coverage < 1
    c.directions[a.usdDirection] = (c.directions[a.usdDirection] ?? 0) + 1
    for (const component of a.components) {
      const s = c.components[component.id] ??= { usable: 0, unavailable: 0, zero: 0, extremePositive: 0, extremeNegative: 0 }
      s.usable += component.points !== null; s.unavailable += component.points === null
      s.zero += component.points === 0; s.extremePositive += component.points === 4; s.extremeNegative += component.points === -4
      if (component.points !== null) assert.ok(Number.isFinite(component.value))
      if (Math.abs(component.points) === 4 && component.limits?.[2]) outliers.push({
        family: a.family, component: component.id, chartAt: a.chartAt, value: component.value,
        extremeBoundary: component.limits[2], ratio: Math.abs(component.value) / component.limits[2] })
    }
  }
  for (const point of eur.points) {
    if (point.total !== null) close(point.total, point.members.reduce((n, m) => n + m.contribution, 0), 'EUR sum equals normalized total')
    for (const member of point.members) {
      assert.ok(member.chartAt <= point.chartAt)
      if (member.status === 'active') close(member.contribution, member.score / 4 * member.weight / 100 * member.retention, 'EUR missing components counted once')
      else assert.equal(member.contribution, 0)
    }
    assert.ok(point.members.reduce((n, m) => n + m.weight, 0) <= 100 + 1e-9, 'Overlapping country proxies cannot expand EUR budget')
    assert.ok(point.usableCoverage >= 0 && point.usableCoverage <= 1 + 1e-9)
  }
  let decompositions = 0
  for (const point of usd.relationships.fresh) for (const member of point.members) {
    assert.ok(member.chartAt <= point.chartAt)
    close(member.replacementChange, member.scoreChange + member.calibrationChange + member.memoryRenewal + member.availabilityChange,
      'Fresh support, calibration, renewal and availability sum to replacement')
    if (!member.comparable) assert.equal(member.change, 0)
    decompositions++
  }
  for (const roof of usd.relationships.episodes) {
    assert.ok(roof.sources.length >= 2 && roof.sources.every(s => s.chartAt <= roof.chartAt))
    if (roof.kind === 'fresh-news') assert.ok(roof.sources.filter(s => s.change !== 0).every(s => s.comparable))
  }
  const ribbonUsd = buildRibbonTimeline(usd, eur, false, 'EURUSD'), ribbonPair = buildRibbonTimeline(usd, eur, true, 'EURUSD')
  for (const p of ribbonUsd) assert.equal(p.label, contextResultLabel('EURUSD', contextAt(usd, p.at)?.result))
  for (const p of ribbonPair) {
    const relative = relativeContext(eurContextAt(eur, p.at), contextAt(usd, p.at))
    assert.equal(p.label, relative.label); assert.equal(p.evidence, relative.strength)
  }
  // Rebuild only known observations. Scores, calibration and Roof membership must stay identical.
  for (const date of ['2018-08-01T12:00:00Z', '2026-01-19T12:00:00Z', '2026-09-17T20:00:00Z']) {
    const at = Date.parse(date)
    const truncate = full => { const events = full.events.filter(e => e.chart_time_seconds !== null && e.chart_time_seconds * 1000 <= at)
      return { ...full, events, asOf: Math.max(...events.map(e => e.release_at ?? 0)) } }
    const u = buildContextTimeline(truncate(input.inputUSD)), e = buildEurContextTimeline(truncate(input.inputEUR))
    assert.deepEqual(contextAt(u, at), contextAt(usd, at), 'Future removal preserves USD facts and interpretation')
    assert.deepEqual(eurContextAt(e, at), eurContextAt(eur, at), 'Future removal preserves EUR facts and interpretation')
    assert.deepEqual(u.relationships.episodes.filter(p => p.chartAt <= at), usd.relationships.episodes.filter(p => p.chartAt <= at))
    samples.push({ at: date, usd: contextResultLabel('EURUSD', contextAt(usd, at)?.result),
      relative: relativeContext(eurContextAt(eur, at), contextAt(usd, at)).label })
  }
  // A manual calibration changes interpretation points, never stored/derived numeric facts.
  const manual = buildContextTimeline({ ...input.inputUSD, settings: { ...input.inputUSD.settings,
    cpi: { fresh: [.001, .002, .003] } } })
  let manualFeatures = 0, changedManualScores = 0
  for (const point of manual.points) for (const member of point.result.members.filter(m => m.chartAt === point.chartAt && m.family === 'cpi')) {
    const original = assessments.get(member.sourceId)
    assert.deepEqual(member.components.map(c => [c.id, c.value]), original.components.map(c => [c.id, c.value]))
    manualFeatures++; changedManualScores += member.total !== original.total
  }
  assert.ok(manualFeatures > 24 && changedManualScores > 0)
  const forecast = buildContextTimeline({ ...input.inputUSD, events: input.inputUSD.events.map(e => ({ ...e, forecast: -999999 })) })
  assert.deepEqual(forecast, usd, 'Forecast fields cannot influence release/change interpretation')
  const report = { source: input.source, revision: input.revision, asOf: input.asOf, settings: input.inputUSD.settings,
    settingsProvenance: 'Explicit automatic snapshot settings; not a claim to read browser-local user preferences',
    versions: { usd: usd.version, relative: 'eurusd-relative-context-v3', relationships: 3,
      cpi: currentScorerLabels.cpi, nfp: currentScorerLabels.nfp, eur: 'v1.1' },
    rows: { USD: input.inputUSD.events.length, EUR: input.inputEUR.events.length },
    range: { first: new Date(usd.points[0].chartAt).toISOString(), lastPublication: new Date(Math.max(...[...assessments.values()].map(a => a.chartAt))).toISOString() },
    points: { USD: usd.points.length, EUR: eur.points.length }, excludedTiming: { USD: usd.excludedTiming, EUR: eur.excludedTiming },
    families: counts, usdDecisions: count(usd.points, p => p.result.decision.state),
    relativeDecisions: count(ribbonPair, p => p.direction), roofs: count(usd.relationships.episodes, p => p.kind),
    commonCalibrationDecompositions: decompositions, ribbonParityChecks: ribbonUsd.length + ribbonPair.length,
    cutoffSamples: samples, manualFeatures, changedManualScores,
    outliers: outliers.sort((a, b) => b.ratio - a.ratio).slice(0, 15),
    limitation: 'Current stored vintage; no original-publication vintage certification, price-prediction evaluation or causal attribution.' }
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ points: report.points, roofs: report.roofs, ribbonParityChecks: report.ribbonParityChecks,
    decompositions, manualFeatures, changedManualScores, cutoffChecks: samples.length * 3 }))
} finally { await server.close() }
