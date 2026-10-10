import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {Worker} from 'node:worker_threads'
import {createServer} from 'vite'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),repo=path.resolve(root,'..'),at=Date.UTC(2026,9,10,12)
const capture=clock=>JSON.parse(execFileSync(path.join(repo,'bridge/.venv/Scripts/python.exe'),['-m','storage.r1_audit_snapshot','--database','storage/data/calendar.sqlite3','--as-of',String(clock),'--currency','all'],{cwd:repo,encoding:'utf8',maxBuffer:192*1024*1024}))
const current=capture(at),server=await createServer({root,server:{middlewareMode:true,hmr:false,ws:false}})
try{
 const {calculateR1}=await server.ssrLoadModule('./src/scoring-system/r1/analysis.ts')
 const {calculateR1Pair}=await server.ssrLoadModule('./src/scoring-system/r1/pair.ts')
 const {calculateR1History}=await server.ssrLoadModule('./src/scoring-system/r1/history.ts')
 const {createR1History}=await server.ssrLoadModule('./src/scoring-system/r1/features.ts')
 const {r1ScatterModel}=await server.ssrLoadModule('./src/scatter-plot/inspection/r1-scatter-model.ts')
 const {r1Profiles,eurR1Families,allR1Families}=await server.ssrLoadModule('./src/scoring-system/r1/profiles.ts')
 const {r1DefaultSettings,eurR1DefaultSettings}=await server.ssrLoadModule('./src/scoring-system/r1/settings.ts')
 const calibration={mode:'automatic',limits:{}},inventories=[],histories=new Map()
 let comparisons=0
 for(const family of eurR1Families){
  const p=r1Profiles[family],events=current.events.filter(e=>e.currency==='EUR'&&e.country_code===p.country&&p.components.some(c=>c.seriesId===e.event_id))
  const input={family,events,at,calibration,savedBands:{}},history=calculateR1History(input),releases=new Map(createR1History(events).releases.map(r=>[r.id,r]))
  for(const a of history){
   assert.ok(Math.abs(a.net)<=100&&a.readings.every(r=>r.points===null||Math.abs(r.points)<=4))
   const result=calculateR1({release:releases.get(a.releaseId),events:events.filter(e=>e.release_at<=a.publishedAt),settings:{version:1,selected:[family],calibration},savedBands:{}})
   assert.deepEqual(result.assessment,a,`${family}: Inspector/Scatter and future-removal parity`)
   comparisons++
   for(const c of p.components){const point=r1ScatterModel(history,c.id,a.releaseId).inspection;assert.equal(point.signal?.points??null,a.readings.find(r=>r.id===c.id).points)}
  }
  histories.set(family,{input,history})
  const complete=history.filter(a=>a.coverage===1),sensitive=complete.filter(a=>a.sensitive)
  inventories.push({family,label:p.label,rows:events.length,publications:history.length,complete:complete.length,sensitive:sensitive.length,minimum:p.calibrationMinimum??60,units:[...new Set(events.map(e=>`${e.unit}/${e.multiplier}`))].join(', '),latest:history.at(-1)})
  console.log(`${family}: ${history.length} publications; ${complete.length} complete; ${sensitive.length} sensitive`)
 }
 const clocks=[['Claims',Date.UTC(2026,2,19,12,30),'claims'],['ECB hold',Date.UTC(2026,2,19,13,15),'ecb'],['Manufacturing',Date.UTC(2026,9,1,14),'ism-manufacturing']],snapshots=[]
 for(const [label,clock,family] of clocks){
  const data=capture(clock),release=createR1History(data.events).releases.find(r=>r.familyId===family&&r.releaseAt===clock)
  assert.ok(release,`${label}: stored publication exists`)
  const schedules=data.schedules.flatMap(s=>allR1Families.filter(f=>r1Profiles[f].components.some(c=>c.seriesId===s.seriesId)).map(f=>({...s,family:f})))
  const input={release,events:data.events,settings:r1DefaultSettings,eurSettings:eurR1DefaultSettings,savedBands:{},schedules},result=calculateR1Pair(input)
  assert.equal(result.pair.eur.at,clock);assert.equal(result.pair.usd.at,clock)
  assert.ok(Math.abs(result.pair.net-(result.pair.eur.net-result.pair.usd.net)/2)<1e-8)
  assert.deepEqual(calculateR1Pair({...input,events:data.events.filter(e=>e.release_at<=clock)}),result,'Pair ignores future events on both sides')
  assert.ok(result.pair.interval[0]<=result.pair.net&&result.pair.interval[1]>=result.pair.net)
  if(label==='Claims'){
   assert.equal(result.transition.before.net.toFixed(2),'-17.82');assert.equal(result.overall.net.toFixed(2),'-17.61');assert.equal(result.transition.change.toFixed(2),'0.22')
  }
  if(label==='ECB hold')assert.equal(result.assessment.net,0)
  snapshots.push({label,input,result})
  console.log(`${label}: ${result.transition.before.net.toFixed(2)} → ${result.overall.net.toFixed(2)}; pair ${result.pair.net.toFixed(2)}`)
 }
 const builtWorker=pattern=>{
  const asset=fs.readdirSync(path.join(root,'dist/assets')).find(name=>pattern.test(name));assert.ok(asset,'Build before replay')
  const shim=`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:v=>parentPort.postMessage(v)};await import(${JSON.stringify(pathToFileURL(path.join(root,'dist/assets',asset)).href)});parentPort.on('message',data=>self.onmessage({data}));`
  return new Worker(new URL(`data:text/javascript,${encodeURIComponent(shim)}`),{type:'module'})
 }
 let workerChecks=0
 for(const [pattern,input,expected] of [
  ...['euro-inflation','euro-manufacturing-pmi','euro-employment'].map(f=>[/^history\.worker-.*\.js$/,histories.get(f).input,histories.get(f).history]),
  ...snapshots.map(s=>[/^pair\.worker-.*\.js$/,s.input,s.result]),
 ]){
  const worker=builtWorker(pattern)
  try{const reply=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({id:1,input})});assert.deepEqual(reply.result,expected);workerChecks++}finally{await worker.terminate()}
 }
 const fmt=n=>n==null?'Unavailable':n.toFixed(2)
 const report=`# Currency evidence R1 expansion audit

Read-only ${current.source} inventory through ${new Date(at).toISOString()}. No collection, database migration, browser settings or price fitting. Source capture uses the existing observation-vintage layer; unrecoverable original vintages remain retrospective.

## EUR coverage and robustness

| Profile | Stored rows | Publications | Fully scorable | Sensitive complete directions | Native unit/multiplier | Prior sample minimum |
| --- | ---: | ---: | ---: | ---: | --- | ---: |
${inventories.map(i=>`| ${i.label} | ${i.rows} | ${i.publications} | ${i.complete} | ${i.sensitive} | ${i.units} | ${i.minimum} |`).join('\n')}

${comparisons} publication assessments passed Inspector/Scatter equality after removing future inventory, including each component's points. ${workerChecks} production-worker checks passed: HICP, manufacturing PMI and employment histories, plus both-currency results at all three clocks below. Unchanged values can score zero before sufficient automatic calibration; nonzero changes without boundaries remain unknown. Exact weights and fallback lifetimes are documented policies, not empirically proven FX coefficients. Sensitivity counts vary weights where the profile defines challengers and boundaries by ±10%.

## Publication comparisons

| Publication (UTC) | Selected release | Overall before | Overall after | Unrounded change, displayed | EUR net | USD net | EURUSD net | Pair possible interval |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${snapshots.map(s=>`| ${new Date(s.result.overall.at).toISOString()} | ${s.label} | ${fmt(s.result.transition.before.net)} | ${fmt(s.result.overall.net)} | ${fmt(s.result.transition.change)} | ${fmt(s.result.pair.eur.net)} | ${fmt(s.result.pair.usd.net)} | ${fmt(s.result.pair.net)} | ${s.result.pair.interval.map(fmt).join(' to ')} |`).join('\n')}

Both currencies use the selected publication clock, with a before snapshot one millisecond earlier. Claims remains USD-negative overall despite its positive standalone contribution. The before/after endpoints round independently; +0.22 is computed from the unrounded values. The ECB hold contributes zero action points while retained macro evidence remains active. These observations assess evidence interpretation and arithmetic; they do not establish which event caused the observed price move.

## Contract checks

Deterministic tests cover distinct-month comparisons, flash/final replacement, quarterly estimate revisions versus retained quarter momentum, composite/sector ownership, national context without duplicate area votes, simultaneous release updates, later corrections, expiry, missing-side intervals, selectable table persistence and settings isolation. Mounted Inspector/Scatter tests verify shared manual limits and local-only previews. The assembled terminal uses the actual pair engine and checks genuine corrections, storage paging, clocks, hidden views, pan work and cleanup. Visual layout and browser performance remain user review.

Canonical policy and sources: [scoring design](../docs/scoring%20system%20overhaul.md#currency-evidence-summary-and-eur-r1).
`
 fs.writeFileSync(path.join(repo,'reports/Currency-evidence-R1-expansion-audit.md'),report)
 console.log(`PASS: ${comparisons} EUR publications, ${snapshots.length} pair clocks and ${workerChecks} built-worker jobs`)
}finally{await server.close()}
