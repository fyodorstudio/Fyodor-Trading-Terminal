import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import { createServer } from 'vite'
const [snapshot, prefix] = process.argv.slice(2)
if (!snapshot || !prefix) throw new Error('Usage: after pnpm build, node scripts/audit-usd-menu-v5.mjs <calendar.json> <output-prefix>')
const data = JSON.parse(fs.readFileSync(path.resolve(snapshot),'utf8'))
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const server = await createServer({root,server:{middlewareMode:true,hmr:false}})
let report, timelineInput, expectedTimeline, latestJobs = []
try {
  const load = p => server.ssrLoadModule('./src/'+p)
  const { assessGdpScore } = await load('inspector/scoring/PAIR/EURUSD/USD/GDP/assessment/gdp-score.ts')
  const { assessPpiScore } = await load('inspector/scoring/PAIR/EURUSD/USD/PPI/assessment/ppi-score.ts')
  const { assessFedScore, fedSeriesIds } = await load('inspector/scoring/PAIR/EURUSD/USD/FED/assessment/fed-score.ts')
  const { groupInspectorReleases } = await load('inspector/inspector-data.ts')
  const { scoringSignalBinding,prepareScoringSignalHistory,scoringSignalModel } = await load('scatter-plot/inspection/scoring-signal-model.ts')
  const { buildContextTimeline } = await load('usd-context/core/build-context-timeline.ts')
  const { contextAt } = await load('usd-context/core/context-lookup.ts')
  const { contextPriority,contextSourceFamilies,contextWeights } = await load('usd-context/core/policy.ts')
  const { contextSeriesIds } = await load('usd-context/core/score-publication.ts')
  const asOf = Date.UTC(2026,9,7), events = data.events.filter(e=>[...contextSeriesIds,...fedSeriesIds].includes(e.event_id) && e.release_at<=asOf)
  const families = {}
  for(const [family, assess] of [['gdp',assessGdpScore],['ppi',assessPpiScore]]) {
    const binding = scoringSignalBinding(family), history = prepareScoringSignalHistory(events,asOf,binding)
    const plotted = Object.fromEntries(binding.signals.map(s=>[s.id,new Map(scoringSignalModel(history,binding,s.id,null).points.map(p=>[p.releaseId,p.signal]))]))
    const rows = history.map(({release})=>{
      const assessment = assess(release,events)
      assert.deepEqual(assess(release,events.filter(e=>e.release_at<release.releaseAt)),assessment, release.id+' future removal')
      for(const r of assessment.readings){const chart=plotted[r.id].get(release.id)
        if(r.value===null)assert.equal(chart,undefined)
        else for(const key of ['value','points','limits','sampleCount','inputs','reason'])assert.deepEqual(chart[key],r[key],release.id+'/'+r.id+'/'+key)
      }
      return {date:new Date(release.releaseAt).toISOString().slice(0,10),releaseAt:release.releaseAt,assessment}
    })
    families[family] = {releases:rows.length,long:rows.filter(r=>r.assessment.direction==='long').length,short:rows.filter(r=>r.assessment.direction==='short').length,uncomputed:rows.filter(r=>r.assessment.direction==='uncomputed').length,rows}
    latestJobs.push({release:history.at(-1).release,events,settings:{}})
  }
  const policyRows = groupInspectorReleases(events).filter(r=>['fomc','fed-chair'].includes(r.familyId)).map(r=>({date:new Date(r.releaseAt).toISOString().slice(0,10),family:r.familyId,assessment:assessFedScore(r)}))
  timelineInput = {events,families:contextSourceFamilies(contextPriority),settings:{cpi:{},nfp:{},services:{},manufacturing:{},claims:{},retail:{},pce:{},ppi:{},gdp:{}},asOf}
  expectedTimeline = buildContextTimeline(timelineInput)
  const replayDates = ['2017-09-14','2020-04-09','2022-10-27','2025-08-12','2025-09-11','2026-08-12','2026-09-30']
  const replays = []
  for(const date of replayDates){
    const releases = groupInspectorReleases(events).filter(r=>r.releaseAt!==null && new Date(r.releaseAt).toISOString().slice(0,10)===date && contextSourceFamilies(contextPriority).includes(r.familyId))
    for(const release of releases){const replay=buildContextTimeline({...timelineInput,events:events.filter(e=>e.release_at<=release.releaseAt),asOf:release.releaseAt})
      const point=contextAt(expectedTimeline,release.chartTime*1000)
      assert.deepEqual(contextAt(replay,release.chartTime*1000),point,release.id+' replay')
      replays.push({date,family:release.familyId,direction:point.result.direction,strength:point.result.strength,total:point.result.total,policy:point.result.policy.mode})
    }
  }
  report={source:data.source_id,revision:data.revision,version:expectedTimeline.version,weights:contextWeights,families,policyCoverage:{releases:policyRows.length,actions:policyRows.filter(r=>r.assessment.direction!=='uncomputed').length,holds:policyRows.filter(r=>r.assessment.action==='Rate hold').length,speechTextAvailable:false,rows:policyRows},timelinePoints:expectedTimeline.points.length,replays,chartParity:true,futureRemovalParity:true}
}finally{await server.close()}
const assets=path.join(root,'dist/assets')
const wrapper=`const {parentPort,workerData}=require('node:worker_threads');globalThis.self=globalThis;self.postMessage=r=>parentPort.postMessage(r);import(workerData.bundle).then(()=>parentPort.on('message',data=>self.onmessage({data})));`
async function checkWorker(pattern,input,expected){
  const bundle=fs.readdirSync(assets).find(name=>pattern.test(name));assert.ok(bundle,'Build first')
  const worker=new Worker(wrapper,{eval:true,workerData:{bundle:pathToFileURL(path.join(assets,bundle)).href}})
  let pulses=0;const pulse=setInterval(()=>pulses++,1),started=performance.now()
  try{const reply=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({id:1,input})})
    assert.equal(reply.error,undefined);assert.deepEqual(reply.result,expected);assert.ok(pulses>0)
    return {parity:true,roundtripMs:Math.round(performance.now()-started),mainThreadPulses:pulses}
  }finally{clearInterval(pulse);await worker.terminate()}
}
report.runtime={context:await checkWorker(/^context-timeline\.worker-.*\.js$/,timelineInput,expectedTimeline)}
for(const job of latestJobs){const family=job.release.familyId,expected=report.families[family].rows.at(-1).assessment
 report.runtime[family]=await checkWorker(/^expanded-release\.worker-.*\.js$/,job,expected)
}
fs.writeFileSync(path.resolve(prefix+'.json'),JSON.stringify(report,null,2)+'\n')
const lines=['# USD menu v5 implementation audit','','This verifies implementation and stored-data chronology, not market-reaction accuracy. No forecasts or FX prices enter. Later provider revisions may remain in the stored readings.','',`Source: ${report.source} · revision ${report.revision} · ${report.version}`,'','| Family | Publications | Long | Short | Uncomputed |','| --- | ---: | ---: | ---: | ---: |',...Object.entries(report.families).map(([f,r])=>`| ${f.toUpperCase()} | ${r.releases} | ${r.long} | ${r.short} | ${r.uncomputed} |`),'',`Fed coverage: ${report.policyCoverage.releases} events; ${report.policyCoverage.actions} directional rate actions; ${report.policyCoverage.holds} holds. Statement/speech text unavailable; no guidance vote is fabricated.`,`Timeline: ${report.timelinePoints} points. All GDP/PPI scorer–Scatter values, calibration counts, boundaries and reasons match. Every GDP/PPI release passed later-data removal. ${report.replays.length} full-context publication replays passed.`,'',`Built worker checks: ${JSON.stringify(report.runtime)}`,'','| Replay date | Family | USD direction | Evidence | Total | Priority |','| --- | --- | --- | --- | ---: | --- |',...report.replays.map(r=>`| ${r.date} | ${r.family} | ${r.direction} | ${r.strength} | ${r.total} | ${r.policy} |`),'']
fs.writeFileSync(path.resolve(prefix+'.md'),lines.join('\n'))
console.log(JSON.stringify({...report,families:Object.fromEntries(Object.entries(report.families).map(([f,r])=>[f,{...r,rows:undefined}])),policyCoverage:{...report.policyCoverage,rows:undefined}},null,2))
