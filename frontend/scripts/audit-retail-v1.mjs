import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import { createServer } from 'vite'

const [calendarPath, outputPrefix] = process.argv.slice(2)
if (!calendarPath || !outputPrefix) throw new Error('Usage: after pnpm build, node scripts/audit-retail-v1.mjs <calendar.json> <output-prefix>')
const calendar = JSON.parse(fs.readFileSync(path.resolve(calendarPath), 'utf8').replace(/^\uFEFF/, ''))
if (!Array.isArray(calendar.events)) throw new Error('Calendar snapshot must contain an events array.')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ root, server: { middlewareMode: true, hmr: false } })
let report, latestJob, expected, signalJob, expectedSignals
try {
  const { assessRetailScore } = await server.ssrLoadModule('./src/scoring-system/PAIR/EURUSD/USD/RETAIL/assessment/retail-score.ts')
  const { retailScoreVersion } = await server.ssrLoadModule('./src/scoring-system/PAIR/EURUSD/USD/RETAIL/policy/retail-policy.ts')
  const { calculateRetailAnalysis } = await server.ssrLoadModule('./src/scoring-system/PAIR/EURUSD/USD/RETAIL/runtime/retail-analysis.ts')
  const { prepareScoringSignalHistory, scoringSignalBinding, scoringSignalModel } = await server.ssrLoadModule('./src/scatter-plot/inspection/scoring-signal-model.ts')
  const { calculateSignalHistory } = await server.ssrLoadModule('./src/scatter-plot/runtime/signal-history-calculation.ts')
  const binding = scoringSignalBinding('retail'), asOf = Date.now()
  const history = prepareScoringSignalHistory(calendar.events, asOf, binding)
  assert.ok(history.length, 'Snapshot must contain observed Retail publications.')
  const plotted = Object.fromEntries(binding.signals.map(signal => [signal.id,
    new Map(scoringSignalModel(history, binding, signal.id, null).points.map(point => [point.releaseId, point.signal]))]))
  const started = performance.now()
  const rows = history.map(({ release }) => {
    const assessment = assessRetailScore(release, calendar.events)
    const earlier = calendar.events.filter(e => e.release_at < release.releaseAt)
    assert.deepEqual(assessRetailScore(release, earlier), assessment, `${release.id}: future removal`)
    for (const row of assessment.readings) {
      const chart = plotted[row.id].get(release.id)
      if (row.value === null) assert.equal(chart, undefined, 'Missing inputs must be gaps, not zeros')
      else for (const key of ['value', 'points', 'size', 'limits', 'sampleCount', 'reason', 'inputs'])
        assert.deepEqual(chart?.[key], row[key], `${release.id}/${row.id}/${key}: scorer-chart parity`)
    }
    return { date: new Date(release.releaseAt).toISOString().slice(0, 10), releaseAt: release.releaseAt, assessment }
  })
  const coverage = [['2015–2019', row => row.date < '2020'], ['2020–2024', row => row.date >= '2020' && row.date < '2025'],
    ['2025 onward', row => row.date >= '2025']].map(([period, filter]) => {
    const selected = rows.filter(filter), count = label => selected.filter(row => row.assessment.label === label).length
    return { period, total: selected.length, long: count('EURUSD Long'), short: count('EURUSD Short'), uncomputed: count('Uncomputed'),
      reduced: selected.filter(row => row.assessment.reduced).length }
  })
  report = { source: calendar.source_id, revision: calendar.revision, asOf, version: retailScoreVersion,
    auditMs: Math.round(performance.now() - started), coverage, rows, chartParity: true, futureRemovalParity: true }
  latestJob = { release: history.at(-1).release, events: calendar.events, settings: {} }
  expected = calculateRetailAnalysis(latestJob)
  signalJob = { familyId: 'retail', events: calendar.events, at: asOf, enabled: true }
  expectedSignals = calculateSignalHistory(signalJob)
} finally { await server.close() }

// Run the actual built browser workers in native threads; smoke-test both paths.
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
      worker.once('message', resolve); worker.once('error', reject)
      worker.postMessage({ id: 1, input })
    })
    assert.equal(reply.error, undefined); assert.deepEqual(reply.result, expectedResult)
    assert.ok(pulses > 0, 'The main event loop must remain active.')
    return { workerParity: true, roundtripMs: Math.round(performance.now() - started), mainThreadPulses: pulses }
  } finally { clearInterval(pulse); await worker.terminate() }
}
report.runtime = { inspector: await checkWorker(/^retail-analysis\.worker-.*\.js$/, latestJob, expected),
  scatter: await checkWorker(/^signal-history\.worker-.*\.js$/, signalJob, expectedSignals) }
const fmt = value => value === null ? '—' : Number(value.toFixed(3))
const lines = ['# USD Retail Sales v1 implementation audit', '',
  `Source: ${report.source} · revision: ${report.revision} · policy: ${report.version}`, '',
  'This verifies implementation, coverage and chronology, not price-prediction accuracy. No forecasts, price data, CPI or Fed decision enter scoring. Prototype weights were set before the audit; no parameter search was performed.', '',
  'Control-group pace receives 60%, ex-autos-and-gas pace 25%, headline pace 15%. Each signal is Actual minus max(0, preceding three-month average), replacing the nearest month with supplied Revised Previous when available. Missing history cannot be filled with Previous. Revision effects enter benchmarks only, not a separate vote.', '',
  'At least one calibrated control-group or ex-autos-and-gas component is required. Exact cancellation follows table order with weak evidence. Missing weights are not redistributed. Control is one evidence group; ex-autos-and-gas and headline share another. Nested sales aggregates are not independent confirmation. Core retail and annual headline provide context only. Sales are nominal, not price adjusted.', '',
  'Every plotted signal value, points, size, boundaries, calibration N, reason and inputs matched its scorer. Removing same-time and later inventory rows preserved every assessment. Production Inspector and Scatter Plot workers match pure results and leave the main event loop running.', '',
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
