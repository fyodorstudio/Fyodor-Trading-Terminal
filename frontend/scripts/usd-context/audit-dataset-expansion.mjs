import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
const [usdPath,eurPath,outputPath]=process.argv.slice(2)
if(!outputPath)throw new Error('Usage: node audit-dataset-expansion.mjs usd.json eur.json output.json')
const usd=JSON.parse(fs.readFileSync(usdPath,'utf8')),eur=JSON.parse(fs.readFileSync(eurPath,'utf8'))
const server=await createServer({root:path.resolve('frontend'),server:{middlewareMode:true,hmr:false}})
try{
 const load=p=>server.ssrLoadModule('./src/'+p+'.ts')
 const {groupInspectorReleases}=await load('inspector/inspector-data')
 const {assessClaimsScore}=await load('scoring-system/PAIR/EURUSD/USD/CLAIMS/assessment/claims-score')
 const {assessNfpScoreV2}=await load('scoring-system/PAIR/EURUSD/USD/NFP/assessment/nfp-score-v2')
 const {buildContextTimeline}=await load('scoring-system/context/usd/build-context-timeline')
 const {contextSeriesIds}=await load('scoring-system/context/usd/score-publication')
 const {contextPriority,contextSourceFamilies}=await load('scoring-system/context/usd/policy')
 const {assessEurScore}=await load('scoring-system/PAIR/EURUSD/EUR/assessment/eur-score')
 const {buildEurContextTimeline}=await load('scoring-system/context/relative/eur-context-timeline')
 const {eurPolicies}=await load('scoring-system/PAIR/EURUSD/EUR/policy/eur-policies')
 const {eurContextAt}=await load('scoring-system/context/relative/relative-context')
 const asOf=Date.parse('2026-10-06T00:00:00Z'),rows=usd.events.filter(e=>contextSeriesIds.includes(e.event_id) && e.release_at<=asOf)
 const releases=groupInspectorReleases(rows),report={scope:'Stored numerical calendar only; automatic magnitudes, all inputs on. No prices or forecast comparisons.',sources:{usd:usd.source_id,eur:eur.source_id},claims:{count:0,revisionDifferences:0},nfp:{count:0,unavailableRevision:0},eur:{},futureChecks:0}
 const legacy=[...rows,...rows]
 for(const r of releases.filter(r=>['jobs','claims'].includes(r.familyId))){
  const assess=r.familyId==='jobs'?assessNfpScoreV2:assessClaimsScore,a=assess(r,rows),b=assess(r,legacy)
  assert.deepEqual(a,b,r.id+' prepared/reference path parity')
  const target=r.familyId==='jobs'?report.nfp:report.claims;target.count++
  if(r.familyId==='jobs')target.unavailableRevision+=a.readings.find(s=>s.id==='revision').points===null?1:0
  else target.revisionDifferences+=a.revisions.length?1:0
 }
 console.log('Claims / NFP complete-history cache parity passed',report.claims.count,report.nfp.count)
 const input={events:rows,families:contextSourceFamilies(contextPriority),settings:{cpi:{},nfp:{},services:{},manufacturing:{},claims:{},retail:{},pce:{},ppi:{},gdp:{}},asOf}
 let at=performance.now();const optimized=buildContextTimeline(input);report.optimizedMs=performance.now()-at
 at=performance.now();const reference=buildContextTimeline({...input,events:legacy});report.referenceMs=performance.now()-at
 assert.deepEqual(optimized,reference,'Complete USD timeline prepared/reference parity');report.usdPoints=optimized.points.length
 const eurReleases=groupInspectorReleases(eur.events.filter(e=>e.release_at<=asOf))
 for(const policy of eurPolicies){const selected=eurReleases.filter(r=>r.familyId===policy.family), summary={count:0,directional:0,uncomputed:0,partial:0}
  for(const r of selected){const a=assessEurScore(r,eur.events);summary.count++;summary[a.direction==='uncomputed'?'uncomputed':'directional']++;summary.partial+=a.reduced?1:0}
  const last=selected.findLast(r=>assessEurScore(r,eur.events)?.direction!=='uncomputed')
  if(last){assert.deepEqual(assessEurScore(last,eur.events),assessEurScore(last,eur.events.filter(e=>e.release_at<last.releaseAt)),'EUR standalone future removal '+policy.family);report.futureChecks++}
  report.eur[policy.family]=summary
 }
 const eurInput={events:eur.events,families:eurPolicies.map(p=>p.family),settings:{},asOf}
 at=performance.now();const timeline=buildEurContextTimeline(eurInput);report.eurMs=performance.now()-at;report.eurPoints=timeline.points.length
 for(const date of ['2025-08-12','2025-12-23','2026-06-17']){
  const cut=Date.parse(date+'T23:59:59Z'),current=buildEurContextTimeline({...eurInput,asOf:cut,events:eur.events.filter(e=>e.release_at<=cut)})
  const last=current.points.findLast(p=>p.chartAt<=cut)
  if(last){assert.deepEqual(last,eurContextAt(timeline,last.chartAt),'EUR combined future removal '+date);report.futureChecks++}
 }
 fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2))
}finally{await server.close()}
