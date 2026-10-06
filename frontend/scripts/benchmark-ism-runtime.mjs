import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import { createServer } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const input = process.argv[2]
if (!input) throw new Error('Usage: pnpm build, then node scripts/benchmark-ism-runtime.mjs <calendar.json>')
const { events } = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'))
const server = await createServer({ root, server: { middlewareMode: true, hmr: false } })
let job, expected, signalJob, expectedSignals, assessmentMs
try {
  const { groupInspectorReleases } = await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const { groupIsmEpisodes } = await server.ssrLoadModule('./src/inspector/episodes/ism-episodes.ts')
  const { assessIsmScoreV2 } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/ISM/assessment/ism-score-v2.ts')
  const { calculateIsmAnalysis } = await server.ssrLoadModule('./src/inspector/scoring/PAIR/EURUSD/USD/ISM/runtime/ism-analysis.ts')
  const { calculateSignalHistory } = await server.ssrLoadModule('./src/scatter-plot/runtime/signal-history-calculation.ts')
  const publications = groupInspectorReleases(events)
  const latest = publications.filter(r => r.familyId === 'ism-services').at(-1)
  const start = performance.now()
  for (let i = 0; i < 3; i++) assessIsmScoreV2(latest, events)
  assessmentMs = performance.now() - start
  job = { release: groupIsmEpisodes(publications).at(-1), events, settings: {}, asOf: latest.releaseAt }
  expected = calculateIsmAnalysis(job)
  signalJob = { familyId: 'ism-services', events, at: latest.releaseAt, enabled: true }
  expectedSignals = calculateSignalHistory(signalJob)
  assert.ok(expectedSignals.length > 0, 'The scatter worker smoke test must exercise real signal history.')
} finally { await server.close() }

// Execute the actual Vite-built production module in a native background thread.
const assets = path.join(root, 'dist/assets')
const wrapper = `const {parentPort,workerData}=require('node:worker_threads');
globalThis.self=globalThis;self.postMessage=result=>parentPort.postMessage(result);
import(workerData.bundle).then(()=>parentPort.on('message',data=>self.onmessage({data})));`
async function checkWorker(pattern, input, expectedResult) {
  const bundle = fs.readdirSync(assets).find(name => pattern.test(name))
  if (!bundle) throw new Error('Build the frontend first to produce the worker bundles.')
  const worker = new Worker(wrapper, { eval: true, workerData: { bundle: pathToFileURL(path.join(assets, bundle)).href } })
  let mainThreadPulses = 0
  const pulse = setInterval(() => mainThreadPulses++, 1)
  const started = performance.now()
  try {
    const reply = await new Promise((resolve, reject) => {
      worker.once('message', resolve); worker.once('error', reject)
      worker.postMessage({ id: 1, input })
    })
    assert.equal(reply.error, undefined)
    assert.deepEqual(reply.result, expectedResult)
    assert.ok(mainThreadPulses > 0, 'The main event loop must keep running during worker calculation.')
    return { roundtripMs: Math.round(performance.now() - started), mainThreadPulses, productionWorkerParity: true }
  } finally { clearInterval(pulse); await worker.terminate() }
}
console.log(JSON.stringify({ readings: events.length, threeAssessmentsMs: Math.round(assessmentMs),
  ism: await checkWorker(/^ism-analysis\.worker-.*\.js$/, job, expected),
  scatter: await checkWorker(/^signal-history\.worker-.*\.js$/, signalJob, expectedSignals) }, null, 2))
