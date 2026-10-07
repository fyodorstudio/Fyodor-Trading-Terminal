// Frozen numerical replay. Relative output is compared with the committed pre-pass renderer.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { createServer } from 'vite'

const [inputFile, outputFile] = process.argv.slice(2)
if (!outputFile || fs.existsSync(outputFile)) throw Error('Provide frozen input and a new output path; previous reports are never overwritten.')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const baselinePath = path.join(root, 'src/raycaster/ribbon/.ribbon-audit-baseline.ts')
if (fs.existsSync(baselinePath)) throw Error('Baseline temporary file already exists; inspect it before retrying.')
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
const baseline = execFileSync('git', ['show', `${commit}:frontend/src/raycaster/ribbon/ribbon-timeline.ts`], { cwd: root, encoding: 'utf8' })
const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'))
fs.writeFileSync(baselinePath, baseline)
const server = await createServer({ root, server: { middlewareMode: true, hmr: false } })
try {
  const load = p => server.ssrLoadModule('./src/' + p + '.ts')
  const { buildContextTimeline } = await load('usd-context/core/build-context-timeline')
  const { buildEurContextTimeline } = await load('pair-context/core/eur-context-timeline')
  const { contextAt } = await load('usd-context/core/context-lookup')
  const { usdContextPresentation: present, usdPresentationVersion } = await load('raycaster/core/usd-context-presentation')
  const { buildRibbonTimeline } = await load('raycaster/ribbon/ribbon-timeline')
  const { buildRibbonTimeline: oldRibbon } = await load('raycaster/ribbon/.ribbon-audit-baseline')
  const { raycasterLabel } = await load('raycaster/ui/raycaster-label')
  const usd = buildContextTimeline(input.inputUSD), eur = buildEurContextTimeline(input.inputEUR)
  const relative = buildRibbonTimeline(usd, eur, true, 'EURUSD')
  assert.deepEqual(relative, oldRibbon(usd, eur, true, 'EURUSD'), 'Every relative field, clock, label, color state, grade and update equals committed behavior')
  const ribbon = buildRibbonTimeline(usd, null, false, 'EURUSD'), states = {}, policies = {}, audits = []
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-10)
  for (const p of ribbon) {
    const r = contextAt(usd, p.at)?.result, shown = present('EURUSD', r, p.at)
    assert.equal(p.presentation, shown); assert.equal(p.label, shown.label); assert.equal(p.evidence, shown.evidence)
    assert.equal(raycasterLabel({ loading: false, message: null, cutoff: p.at, relative: null, result: r, symbol: 'EURUSD' }), shown.label)
    assert.ok(r.members.every(m => m.chartAt <= p.at))
    states[shown.state] = (states[shown.state] ?? 0) + 1
    policies[r.policy.mode] = (policies[r.policy.mode] ?? 0) + 1
    if (shown.state === 'insufficient') { assert.equal(shown.direction, null); assert.equal(shown.evidence, null); continue }
    const usable = r.members.filter(m => m.status === 'active')
    near(shown.long, usable.reduce((n, m) => n + Math.max(0, -m.contribution), 0))
    near(shown.short, usable.reduce((n, m) => n + Math.max(0, m.contribution), 0))
    near(shown.net, -r.total); near(shown.coverage, r.decision.coverage)
    if (shown.narrow || shown.qualified) assert.equal(shown.evidence, shown.direction ? 'weak' : null)
    if (shown.state === 'balanced' || shown.state === 'unchanged') assert.equal(shown.direction, null)
    const inverse = present('USDJPY', r, p.at)
    near(inverse.long, shown.short); near(inverse.short, shown.long); near(inverse.net, -shown.net)
  }
  for (const date of ['2025-12-16T22:00:00Z', '2025-12-23T22:00:00Z', '2026-01-08T22:00:00Z', '2026-01-19T22:00:00Z', '2026-01-28T22:00:00Z', '2026-09-03T22:00:00Z']) {
    const at = Date.parse(date), r = contextAt(usd, at)?.result, p = present('EURUSD', r, at)
    audits.push({ at: date, label: p.label, evidence: p.evidence, long: p.long, short: p.short, net: p.net, separation: p.separation,
      coverage: p.coverage, leaders: p.leaders, policy: r?.policy.mode })
  }
  // Warm immutable lookups: no worker, calibration, price, DOM or preference access.
  const start = performance.now()
  for (let pass = 0; pass < 10; pass++) for (const p of ribbon) present('EURUSD', p.usd.result, p.at)
  const elapsed = performance.now() - start
  const report = { source: input.source, revision: input.revision, versions: { usd: usd.version, presentation: usdPresentationVersion }, committedBaseline: commit,
    rows: { USD: input.inputUSD.events.length, EUR: input.inputEUR.events.length }, usdPoints: ribbon.length, relativeExactParityChecks: relative.length,
    states, policies, narrowLeads: ribbon.filter(p => p.presentation.narrow).length, qualified: ribbon.filter(p => p.presentation.qualified).length,
    cachedLookups: ribbon.length * 10, cachedLookupMs: Math.round(elapsed), samples: audits,
    settingsProvenance: 'Frozen explicit automatic magnitude settings, not browser-local preferences',
    limitation: 'Current stored vintage. Numerical presentation audit only; no price alignment, causal or visual certification.' }
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ usdPoints: report.usdPoints, relativeExactParityChecks: report.relativeExactParityChecks, states, policies, cachedLookups: report.cachedLookups, cachedLookupMs: report.cachedLookupMs }))
} finally { await server.close(); fs.unlinkSync(baselinePath) }
