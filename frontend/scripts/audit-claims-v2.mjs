import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import { createServer } from 'vite'

const [calendarPath, outputPrefix] = process.argv.slice(2)
if (!calendarPath || !outputPrefix) throw new Error('Usage: after pnpm build, node scripts/audit-claims-v2.mjs <calendar.json> <output-prefix>')
const calendar = JSON.parse(fs.readFileSync(path.resolve(calendarPath), 'utf8').replace(/^\uFEFF/, ''))
if (!Array.isArray(calendar.events)) throw new Error('Calendar snapshot must contain an events array.')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ root, server: { middlewareMode: true, hmr: false } })
let report, latestJob, expected, signalJob, expectedSignals
try {
  const { assessClaimsScore } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/CLAIMS/assessment/claims-score.ts')
  const { claimsScoreVersion } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/CLAIMS/policy/claims-policy.ts')
  const { calculateClaimsAnalysis } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/CLAIMS/runtime/claims-analysis.ts')
  const { prepareScoringSignalHistory, scoringSignalBinding, scoringSignalModel } = await server.ssrLoadModule('./src/scatter-plot/inspection/scoring-signal-model.ts')
  const { calculateSignalHistory } = await server.ssrLoadModule('./src/scatter-plot/runtime/signal-history-calculation.ts')
  const binding = scoringSignalBinding('claims'), asOf = Date.now()
  const history = prepareScoringSignalHistory(calendar.events, asOf, binding)
  assert.ok(history.length, 'Snapshot must contain observed Claims publications.')
  const plotted = Object.fromEntries(binding.signals.map(signal => [signal.id,
    new Map(scoringSignalModel(history, binding, signal.id, null).points.map(point => [point.releaseId, point.signal]))]))
  const started = performance.now()
  const rows = history.map(({ release }) => {
    const assessment = assessClaimsScore(release, calendar.events)
    assert.deepEqual(assessClaimsScore(release, calendar.events.filter(e => e.release_at < release.releaseAt)), assessment, `${release.id}: future removal`)
    for (const row of assessment.readings) {
      const chart = plotted[row.id].get(release.id)
      if (row.value === null) assert.equal(chart, undefined, 'Missing inputs must be gaps, not zeros')
      else for (const key of ['value', 'points', 'size', 'limits', 'sampleCount', 'reason', 'inputs'])
        assert.deepEqual(chart?.[key], row[key], `${release.id}/${row.id}/${key}: scorer-chart parity`)
    }
    return { date: new Date(release.releaseAt).toISOString().slice(0, 10), releaseAt: release.releaseAt, assessment }
  })
  const coverage = [['2015–2019', r => r.date < '2020'], ['2020–2024', r => r.date >= '2020' && r.date < '2025'],
    ['2025 onward', r => r.date >= '2025']].map(([period, filter]) => {
    const selected = rows.filter(filter), count = label => selected.filter(r => r.assessment.label === label).length
    return { period, total: selected.length, long: count('EURUSD Long'), short: count('EURUSD Short'), uncomputed: count('Uncomputed'),
      reduced: selected.filter(r => r.assessment.reduced).length }
  })
  report = { source: calendar.source_id, revision: calendar.revision, asOf, version: claimsScoreVersion,
    auditMs: Math.round(performance.now() - started), coverage, rows, chartParity: true, futureRemovalParity: true }
  latestJob = { release: history.at(-1).release, events: calendar.events, settings: {} }
  expected = calculateClaimsAnalysis(latestJob)
  signalJob = { familyId: 'claims', events: calendar.events, at: asOf, enabled: true }
  expectedSignals = calculateSignalHistory(signalJob)
} finally { await server.close() }

const assets = path.join(root, 'dist/assets')
const wrapper = `const {parentPort,workerData}=require('node:worker_threads');
globalThis.self=globalThis;self.postMessage=result=>parentPort.postMessage(result);
import(workerData.bundle).then(()=>parentPort.on('message',data=>self.onmessage({data})));`
async function checkWorker(pattern, input, expectedResult) {
  const bundle = fs.readdirSync(assets).find(name => pattern.test(name))
  if (!bundle) throw new Error('Build the frontend first to produce worker bundles.')
  const worker = new Worker(wrapper, { eval: true, workerData: { bundle: pathToFileURL(path.join(assets, bundle)).href } })
  let pulses = 0
  const pulse = setInterval(() => pulses++, 1), started = performance.now()
  try {
    const reply = await new Promise((resolve, reject) => {
      worker.once('message', resolve); worker.once('error', reject); worker.postMessage({ id: 1, input })
    })
    assert.equal(reply.error, undefined); assert.deepEqual(reply.result, expectedResult)
    assert.ok(pulses > 0, 'The main event loop must remain active.')
    return { workerParity: true, roundtripMs: Math.round(performance.now() - started), mainThreadPulses: pulses }
  } finally { clearInterval(pulse); await worker.terminate() }
}
report.runtime = { inspector: await checkWorker(/^claims-analysis\.worker-.*\.js$/, latestJob, expected),
  scatter: await checkWorker(/^signal-history\.worker-.*\.js$/, signalJob, expectedSignals) }
const fmt = n => n === null ? '—' : Number(n.toFixed(3))
const lines = ['# USD Jobless Claims v2 implementation audit', '',
  `Source: ${report.source} · revision: ${report.revision} · policy: ${report.version}`, '',
  'This verifies implementation and chronology, not price-prediction accuracy. No forecast, market price or other family enters scoring. No parameter search was performed.', '',
  'Smoothed initial trend 45%, continuing trend 40%, weekly initial 15%. Initial trend compares reported four-week averages four weeks apart; continuing trend compares adjacent nonoverlapping four-week means; weekly initial compares latest with the preceding four-week mean. Supplied Revised Previous replaces the nearest prior reading only where that week is used. Descriptive levels compare with 52 earlier weeks without voting. All counts convert to thousands. Initial and its average share a group; continuing claims is another group. Continuing claims references the preceding week. Missing weights are not redistributed; exact cancellation follows table order with Weak evidence. All-zero/unusable stays Uncomputed.', '',
  'Scorer/Scatter values, points, magnitude, boundaries, N, reasons and inputs match. Removing same-time/later inventory preserves every assessment. Production Inspector/Scatter workers match pure results and keep the main event loop active. Stored vintages may include later provider revisions.', '',
  `Runtime: Inspector ${report.runtime.inspector.roundtripMs} ms (${report.runtime.inspector.mainThreadPulses} main-thread pulses); Scatter ${report.runtime.scatter.roundtripMs} ms (${report.runtime.scatter.mainThreadPulses} pulses).`, '',
  '## Chronological coverage', '', '| Period | Releases | Long | Short | Uncomputed | Reduced data |', '| --- | ---: | ---: | ---: | ---: | ---: |',
  ...report.coverage.map(r => `| ${r.period} | ${r.total} | ${r.long} | ${r.short} | ${r.uncomputed} | ${r.reduced} |`), '',
  '## Recent outputs', '', '| Date | Bias | Evidence | Change size | USD total | Explanation |', '| --- | --- | --- | --- | ---: | --- |',
  ...report.rows.filter(r => r.date >= '2025').map(({ date, assessment: a }) =>
    `| ${date} | ${a.label} | ${a.strength ?? '—'} | ${a.changeSize ?? '—'} | ${fmt(a.total)} | ${a.explanation} |`), '']
fs.writeFileSync(path.resolve(`${outputPrefix}.json`), JSON.stringify(report, null, 2) + '\n')
fs.writeFileSync(path.resolve(`${outputPrefix}.md`), lines.join('\n'))
console.log(JSON.stringify({ releases: report.rows.length, coverage: report.coverage, runtime: report.runtime,
  chartParity: true, futureRemovalParity: true, report: `${outputPrefix}.md` }, null, 2))
