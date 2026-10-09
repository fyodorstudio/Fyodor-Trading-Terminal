import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import { createServer } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const inputPath = path.resolve(process.argv[2] ?? path.join(root, '../storage/data/claims-oct08-live-review-input.json'))
const output = path.resolve(process.argv[3] ?? path.join(root, '../reports/Claims-standalone-v3-audit.md'))
const captured = JSON.parse(fs.readFileSync(inputPath, 'utf8').replace(/^\uFEFF/, ''))
const events = captured.inputUSD?.events ?? captured.events, asOf = captured.asOf ?? Date.UTC(2026, 9, 8, 12, 30)
assert.ok(Array.isArray(events), 'Supply a captured USD input or calendar events array')
const server = await createServer({ root, server: { middlewareMode: true, hmr: false } })
const load = p => server.ssrLoadModule('./src/' + p)
const jobs = [], results = {}, targetAt = Date.UTC(2026, 9, 8, 12, 30)
try {
  const { assessClaimsStandalone } = await load('scoring-system/PAIR/EURUSD/USD/CLAIMS/assessment/claims-standalone-score.ts')
  const { assessClaimsScore } = await load('scoring-system/PAIR/EURUSD/USD/CLAIMS/assessment/claims-score.ts')
  const { calculateSignalHistory } = await load('scatter-plot/runtime/signal-history-calculation.ts')
  const { scoringSignalBinding, prepareScoringSignalHistory, scoringSignalModel } = await load('scatter-plot/inspection/scoring-signal-model.ts')
  const { magnitudeEvidence } = await load('scoring-system/shared/core/magnitude-evidence.ts')
  for (const horizon of ['release', 'trend']) {
    const binding = scoringSignalBinding('claims', horizon), history = prepareScoringSignalHistory(events, asOf, binding)
    const plotted = Object.fromEntries(binding.signals.map(s => [s.id, new Map(scoringSignalModel(history, binding, s.id, null).points.map(p => [p.releaseId, p.signal]))]))
    const rows = history.map(({ release }) => {
      const assessment = assessClaimsStandalone(release, events, horizon)
      assert.deepEqual(assessClaimsStandalone(release, events.filter(e => e.release_at < release.releaseAt), horizon), assessment, 'Removing later inventory preserves historical assessment')
      for (const r of assessment.readings) {
        const chart = plotted[r.id].get(release.id)
        if (r.value === null) assert.equal(chart, undefined)
        else for (const key of ['value', 'points', 'size', 'limits', 'sampleCount', 'reason', 'inputs']) assert.deepEqual(chart[key], r[key], `${release.id}/${r.id}/${key}`)
        assert.ok(r.points === null || Math.abs(r.points) <= 4)
        assert.ok(r.observations.every(o => o.publishedAt <= release.releaseAt))
      }
      return { release, assessment }
    })
    const target = rows.find(r => r.release.releaseAt === targetAt)
    assert.ok(target, 'The October 8 example must exist')
    const variants = [50, 55, 60, 65, 70].map(weight => {
      let directionChanges = 0, strengthChanges = 0
      const counts = { short: 0, long: 0, flat: 0, unavailable: 0 }
      for (const { assessment: a } of rows) {
        const readings = a.readings.map((r, i) => ({ ...r, weight: i === 0 ? weight : 100 - weight }))
        const total = readings.every(r => r.points === null) ? null : Math.round(readings.reduce((n, r) => n + (r.points ?? 0) * r.weight / 100, 0) * 1e12) / 1e12
        const direction = total === null || total === 0 ? 'uncomputed' : total > 0 ? 'short' : 'long'
        counts[total === null ? 'unavailable' : total === 0 ? 'flat' : direction]++
        directionChanges += direction !== a.direction ? 1 : 0
        strengthChanges += magnitudeEvidence(readings, direction, false).strength !== a.strength ? 1 : 0
      }
      const example = assessClaimsStandalone(target.release, events, horizon, {}, weight)
      return { weight, ...counts, directionChanges, strengthChanges, example: `${example.label} (${example.total})` }
    })
    const conflicts = rows.filter(r => r.assessment.readings.some(x => x.points > 0) && r.assessment.readings.some(x => x.points < 0))
    const reversals = rows.filter((r, i) => i && ['short', 'long'].includes(r.assessment.direction) && ['short', 'long'].includes(rows[i - 1].assessment.direction) && r.assessment.direction !== rows[i - 1].assessment.direction)
    results[horizon] = { rows: rows.length, target: target.assessment, variants, conflicts: conflicts.length, reversals: reversals.length,
      examples: conflicts.slice(-5).map(r => ({ date: new Date(r.release.releaseAt).toISOString().slice(0, 10), a: r.assessment })) }
    jobs.push({ horizon, input: { release: target.release, events, settings: {}, horizon, initialWeight: 60 }, expected: target.assessment })
    const signalInput = { familyId: 'claims', horizon, events, at: asOf, enabled: true }
    jobs.push({ horizon, signal: true, input: signalInput, expected: calculateSignalHistory(signalInput) })
    const legacy = assessClaimsScore(target.release, events)
    assert.equal(legacy.total, 2.25, 'Claims v2 October 8 baseline remains unchanged')
  }
} finally { await server.close() }

const assets = path.join(root, 'dist/assets')
const wrapper = `const{parentPort,workerData}=require('node:worker_threads');globalThis.self=globalThis;self.postMessage=result=>parentPort.postMessage(result);import(workerData.bundle).then(()=>parentPort.on('message',data=>self.onmessage({data})));`
for (const job of jobs) {
  const pattern = job.signal ? /^signal-history\.worker-.*\.js$/ : /^claims-standalone\.worker-.*\.js$/
  const bundle = fs.readdirSync(assets).find(name => pattern.test(name))
  assert.ok(bundle, 'Run pnpm --dir frontend build first')
  const worker = new Worker(wrapper, { eval: true, workerData: { bundle: pathToFileURL(path.join(assets, bundle)).href } })
  try {
    const reply = await new Promise((resolve, reject) => {
      worker.once('message', resolve); worker.once('error', reject); worker.postMessage({ id: 1, input: job.input })
    })
    assert.equal(reply.error, undefined); assert.deepEqual(reply.result, job.expected, 'Production worker matches shared engine')
  } finally { await worker.terminate() }
}

const lines = ['# Claims standalone v3 audit', '', `Captured source: ${captured.source ?? captured.source_id}; revision ${captured.revision}. Example: October 8, 2026, 19:30 Asia/Jakarta.`, '',
  'The weekly and four-week models are independent. Roofs, Raycaster and Candy retain Claims v2 (+2.25 for this example). Forecasts and market prices do not enter the new models.', '',
  '## October 8 comparisons', '', '| View | Component | Current (k) | Comparison (k) | USD feature (k) | Boundaries (k) | Earlier samples | Points | Weight | Contribution |', '| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: |']
for (const [horizon, r] of Object.entries(results)) for (const row of r.target.readings) lines.push(`| ${horizon === 'release' ? 'This release' : 'Four-week trend'} | ${row.label} | ${row.inputs?.actual ?? '—'} | ${row.inputs?.baseline ?? '—'} | ${row.value} | ${row.limits?.join(' / ')} | ${row.sampleCount} | ${row.points} | ${row.weight}% | ${row.contribution} |`)
for (const [horizon, r] of Object.entries(results)) lines.push('', `**${horizon}: ${r.target.usdLabel} · ${r.target.label} · ${r.target.strength} evidence · ${r.target.total} points.**`, '')
lines.push('## Replay and sensitivity', '', 'Each view was replayed over all stored eligible publications. Scorer/Scatter values, grades, limits, sample counts and baselines matched; removing same-time/later inventory preserved every assessment. Every input provenance clock was at or before its publication. Both production scoring and Scatter workers matched their pure entry points.', '',
  '| View | Initial/continuing | Short | Long | No net bias | Unavailable | Direction changes vs 60/40 | Strength changes vs 60/40 | October 8 |', '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |')
for (const [horizon, r] of Object.entries(results)) for (const v of r.variants) lines.push(`| ${horizon} (${r.rows} publications) | ${v.weight}/${100 - v.weight} | ${v.short} | ${v.long} | ${v.flat} | ${v.unavailable} | ${v.directionChanges} | ${v.strengthChanges} | ${v.example} |`)
for (const [horizon, r] of Object.entries(results)) {
  lines.push('', `${horizon}: ${r.conflicts} opposing-input publications; ${r.reversals} consecutive directional reversals.`, '', '| Recent conflict | Initial points | Continuing points | USD total | Bias | Evidence |', '| --- | ---: | ---: | ---: | --- | --- |')
  for (const { date, a } of r.examples) lines.push(`| ${date} | ${a.readings[0].points} | ${a.readings[1].points} | ${a.total} | ${a.label} | ${a.strength} |`)
}
lines.push('', '## Default and limits', '',
  '60/40 is an explicit starting policy: initial claims describe new benefit filings more directly; continuing claims describe continued receipt and can also change with eligibility or exhaustion. This supports giving initial claims greater weight, but does not uniquely prove 60%. The replay reports sensitivity instead of tuning the policy to one desired release. Review standalone results before extending it to relationships or NFP.', '',
  'Revisions published on later stored releases now update every affected week in the selected four-week window. A malformed latest revision is unavailable rather than silently replaced. Missing/ambiguous weeks are not imputed. Exact cancellation and all-zero observations have no net bias; missing inputs retain their nominal weights and weaken evidence. Extreme scores are capped at four points.', '',
  'The captured feed can contain provider corrections to existing stored records without original vintage timestamps. The audit proves the stored publication cutoff and supplied-revision handling, not reconstruction of unavailable first-publication vintages. Headless integration tests cover Inspector, settings preview/apply/reset, portability, worker reuse, stale replies and cleanup. Visual layout and browser performance remain for the user to review.', '',
  'Reproduce after building: `node frontend/scripts/audit-claims-standalone.mjs`.', '')
fs.writeFileSync(output, lines.join('\n'))
console.log(JSON.stringify({ output, views: Object.fromEntries(Object.entries(results).map(([k, r]) => [k, { publications: r.rows, example: r.target.label, score: r.target.total, sensitivity: r.variants }])), workerParity: true }, null, 2))
