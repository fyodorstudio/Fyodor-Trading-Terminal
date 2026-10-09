import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const [mode, snapshot, baseline] = process.argv.slice(2)
if (!['capture', 'compare'].includes(mode) || !snapshot || !baseline) {
  throw new Error('Usage: node scripts/pair-context/check-refactor-parity.mjs capture|compare <EUR snapshot> <baseline>')
}
const data = JSON.parse(fs.readFileSync(path.resolve(snapshot), 'utf8'))
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const server = await createServer({ root, server: { middlewareMode: true, hmr: false } })
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
try {
  const load = p => server.ssrLoadModule('./src/' + p + '.ts')
  const { eurPolicies } = await load('scoring-system/PAIR/EURUSD/EUR/policy/eur-policies')
  const { buildEurContextTimeline } = await load('scoring-system/context/relative/eur-context-timeline')
  const { assessEurScore } = await load('scoring-system/PAIR/EURUSD/EUR/assessment/eur-score')
  const { groupInspectorReleases } = await load('inspector/inspector-data')
  const { scoringSignalBinding, prepareScoringSignalHistory, scoringSignalModel } = await load('scatter-plot/inspection/scoring-signal-model')
  const asOf = Date.UTC(2026, 9, 7)
  const timeline = buildEurContextTimeline({ events: data.events, families: eurPolicies.map(p => p.family), settings: {}, asOf })
  const releases = groupInspectorReleases(data.events).filter(r => r.releaseAt <= asOf)
  const assessments = releases.map(r => assessEurScore(r, data.events)).filter(Boolean)
  const plots = eurPolicies.flatMap(policy => {
    const binding = scoringSignalBinding(policy.family)
    const history = prepareScoringSignalHistory(data.events, asOf, binding)
    return policy.signals.map(signal => scoringSignalModel(history, binding, signal.id, null))
  })
  const result = { source: data.source_id, revision: data.revision, asOf, points: timeline.points.length,
    assessments: assessments.length, plots: plots.length, timelineHash: hash(timeline),
    assessmentHash: hash(assessments), scatterHash: hash(plots) }
  if (mode === 'capture') fs.writeFileSync(path.resolve(baseline), JSON.stringify(result, null, 2) + '\n')
  else assert.deepEqual(result, JSON.parse(fs.readFileSync(path.resolve(baseline), 'utf8')), 'Refactor changed stored-data outputs')
  console.log(mode + ': ' + JSON.stringify(result))
} finally { await server.close() }
