import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import { createServer } from 'vite'

const [snapshot, baselinePath, prefix] = process.argv.slice(2)
if (!snapshot || !baselinePath || !prefix) throw new Error('Usage: after building, node scripts/usd-context/audit-memory-v6.mjs <calendar.json> <v5-baseline.json> <output-prefix>')
const data = JSON.parse(fs.readFileSync(path.resolve(snapshot), 'utf8'))
const baseline = JSON.parse(fs.readFileSync(path.resolve(baselinePath), 'utf8'))
assert.equal(baseline.timeline.version, 'usd-context-memory-v5', 'Capture v5 before changing policy')
assert.equal(data.source_id, baseline.source); assert.equal(data.revision, baseline.revision)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const server = await createServer({ root, server: { middlewareMode: true, hmr: false } })
let input, timeline, report
try {
  const load = p => server.ssrLoadModule('./src/usd-context/core/' + p + '.ts')
  const { buildContextTimeline } = await load('build-context-timeline')
  const { contextAt } = await load('context-lookup')
  const { contextPriority, contextSourceFamilies } = await load('policy')
  input = { events: data.events, asOf: baseline.asOf, families: contextSourceFamilies(contextPriority),
    settings: { cpi: {}, nfp: {}, services: {}, manufacturing: {}, retail: {}, claims: {}, pce: {}, ppi: {}, gdp: {} } }
  timeline = buildContextTimeline(input)
  const publications = timeline.points.filter(p => p.latest?.chartAt === p.chartAt)
  const rows = publications.map(p => {
    const prior = contextAt(baseline.timeline, p.chartAt)
    assert.ok(prior)
    for (const m of p.result.members) {
      const before = prior.result.members.find(b => b.family === m.family)
      for (const key of ['sourceId','releaseAt','chartAt','total','usdDirection','strength','reduced','tie','coverage'])
        assert.deepEqual(m[key], before[key], m.sourceId + '/' + key + ' standalone parity')
      assert.ok(Number.isFinite(m.contribution))
      if (m.status === 'active') assert.ok(m.memory.effectiveWeight <= p.result.policy.weights[m.family])
    }
    return { date: new Date(p.latest.releaseAt).toISOString().slice(0,10), chartAt: p.chartAt,
      family: p.latest.family, before: prior.result.direction, after: p.result.direction,
      total: p.result.total, strength: p.result.strength, mode: p.result.policy.mode,
      changed: prior.result.direction !== p.result.direction, result: p.result }
  })
  const summary = items => ({ publications: items.length, directionChanges: items.filter(r=>r.changed).length,
    weeklyPriority: items.filter(r=>r.mode==='weekly-labor-priority').length,
    laborInflationPriority: items.filter(r=>r.mode==='labor-priority').length })
  // Disclose sensitivity of fixed cadence defaults; never select by FX returns.
  const sensitivity = [.75,1,1.25].map(scale => {
    let changes = 0
    for (const row of rows) {
      const active = row.result.members.filter(m=>m.status==='active')
      const total = active.length ? active.reduce((sum,m)=>sum+m.total*row.result.policy.weights[m.family]/100*
        2**(-m.memory.ageDays/(m.memory.halfLifeDays*scale))*m.memory.coverage,0) : null
      const direction = total === null ? 'uncomputed' : Math.abs(total) < 1e-12 ?
        contextPriority.map(f=>active.find(m=>m.family===f)).find(Boolean)?.usdDirection ?? 'uncomputed' : total>0?'stronger':'weaker'
      changes += direction !== row.after ? 1 : 0
    }
    return { halfLifeScale: scale, directionChangesVersusDefault: changes }
  })
  const dates = ['2017-09-14','2020-04-09','2022-10-27','2025-08-12','2025-09-11','2025-12-31','2026-06-17','2026-08-12']
  const checks = []
  for (const date of dates) {
    const point = publications.find(p=>new Date(p.latest.releaseAt).toISOString().slice(0,10)===date)
    if (!point) continue
    const cutoff=point.latest.releaseAt
    const replay=buildContextTimeline({...input,asOf:cutoff,events:input.events.filter(e=>e.release_at<=cutoff)})
    assert.deepEqual(contextAt(replay,point.chartAt),point,date+' publication future removal')
    const day=Math.floor(point.chartAt/86400000)*86400000+86400000
    const aged=contextAt(timeline,day), beforeNext=publications.find(p=>p.chartAt>point.chartAt)
    if (beforeNext?.chartAt>day) assert.deepEqual(contextAt(replay,day),aged,date+' aging future removal')
    checks.push(date)
  }
  const cutoffs=['2025-12-23T23:59:59Z','2025-12-31T23:59:59Z','2026-01-08T23:59:59Z','2026-01-09T23:59:59Z',
    '2026-01-28T03:00:00Z','2026-06-17T23:59:59Z','2026-06-18T03:00:00Z',
    '2025-08-12T23:59:59Z','2025-09-11T23:59:59Z','2026-08-12T23:59:59Z']
  const cases=cutoffs.map(cutoff=>{
    const at=Date.parse(cutoff),before=contextAt(baseline.timeline,at),after=contextAt(timeline,at)
    return {cutoff,before:before.result.direction,beforeTotal:before.result.total,
      after:after.result.direction,total:after.result.total,strength:after.result.strength,
      policy:after.result.policy.mode,members:after.result.members}
  })
  report={version:timeline.version,source:baseline.source,revision:baseline.revision,
    scope:baseline.scope,sourceParity:true,summary:summary(rows),periods:{'2015–2024':summary(rows.filter(r=>r.date<'2025')),
      '2025–2026':summary(rows.filter(r=>r.date>='2025'))},timelinePoints:timeline.points.length,
    sensitivity,replayChecks:checks,cases}
} finally { await server.close() }

const bundle=fs.readdirSync(path.join(root,'dist/assets')).find(name=>/^context-timeline\.worker-.*\.js$/.test(name))
assert.ok(bundle,'Build before audit')
const wrapper=`const {parentPort,workerData}=require('node:worker_threads');globalThis.self=globalThis;self.postMessage=r=>parentPort.postMessage(r);import(workerData.bundle).then(()=>parentPort.on('message',data=>self.onmessage({data})));`
const worker=new Worker(wrapper,{eval:true,workerData:{bundle:pathToFileURL(path.join(root,'dist/assets',bundle)).href}})
let pulses=0;const interval=setInterval(()=>pulses++,1),started=performance.now()
try {
  const reply=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({id:1,input})})
  assert.equal(reply.error,undefined);assert.deepEqual(reply.result,timeline);assert.ok(pulses>0)
  report.runtime={workerParity:true,roundtripMs:Math.round(performance.now()-started),mainThreadPulses:pulses,
    serializedTimelineBytes:Buffer.byteLength(JSON.stringify(timeline))}
} finally {clearInterval(interval);await worker.terminate()}
fs.writeFileSync(path.resolve(prefix+'.json'),JSON.stringify(report,null,2)+'\n')
const bias=d=>d==='stronger'?'Short':d==='weaker'?'Long':'Uncomputed'
const lines=['# Context memory v6 replay','','These are interpretation and implementation checks, not price-accuracy estimates. All sources enabled with automatic magnitudes; later stored provider revisions remain a limitation.','',
 '| Period | Publications | Changed versus v5 | Weekly priority | Labor–inflation priority |','| --- | ---: | ---: | ---: | ---: |',
 ...Object.entries(report.periods).map(([p,r])=>`| ${p} | ${r.publications} | ${r.directionChanges} | ${r.weeklyPriority} | ${r.laborInflationPriority} |`),'',
 '| Broker cutoff | v5 EURUSD | v6 EURUSD | v6 USD total | Evidence | Policy |','| --- | --- | --- | ---: | --- | --- |',
 ...report.cases.map(r=>`| ${r.cutoff} | ${bias(r.before)} | ${bias(r.after)} | ${r.total} | ${r.strength} | ${r.policy} |`),'',
 `Sensitivity: ${JSON.stringify(report.sensitivity)}. Defaults use release cadence; these variants were not optimized against FX prices.`,
 `Source parity passed at every publication. Replay checks: ${report.replayChecks.join(', ')}.`,
 `Worker/runtime: ${JSON.stringify(report.runtime)}. Timeline points: ${report.timelinePoints}.`,'']
fs.writeFileSync(path.resolve(prefix+'.md'),lines.join('\n'))
console.log(JSON.stringify({...report,cases:report.cases.map(({members: _members,...r})=>r)},null,2))
