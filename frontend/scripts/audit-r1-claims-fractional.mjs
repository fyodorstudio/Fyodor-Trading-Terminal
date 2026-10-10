import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {Worker} from 'node:worker_threads'
import {createServer} from 'vite'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),repo=path.resolve(root,'..')
const at=Date.UTC(2026,9,8,12,30)
const capture=JSON.parse(execFileSync(path.join(repo,'bridge/.venv/Scripts/python.exe'),['-m','storage.r1_audit_snapshot','--database','storage/data/calendar.sqlite3','--as-of',String(Date.UTC(2026,9,10,12))],{cwd:repo,encoding:'utf8',maxBuffer:128*1024*1024}))
const server=await createServer({root,server:{middlewareMode:true,hmr:false}})
try{
  const {calculateR1History}=await server.ssrLoadModule('./src/scoring-system/r1/history.ts')
  const {calculateR1}=await server.ssrLoadModule('./src/scoring-system/r1/analysis.ts')
  const {createR1History}=await server.ssrLoadModule('./src/scoring-system/r1/features.ts')
  const {balance,magnitude,magnitudePoints,precise}=await server.ssrLoadModule('./src/scoring-system/r1/arithmetic.ts')
  const {r1ScatterModel}=await server.ssrLoadModule('./src/scatter-plot/inspection/r1-scatter-model.ts')
  const input={family:'claims',events:capture.events,at,calibration:{mode:'automatic',limits:{}},savedBands:{}}
  const history=calculateR1History(input),releases=new Map(createR1History(capture.events).releases.map(r=>[r.id,r]))
  const old=a=>balance(a.readings.map(r=>({value:r.points===null?null:r.weight*(r.delta===0?0:r.polarity*Math.sign(r.delta)*magnitude(r.delta,r.limits))/4,budget:r.weight})))
  const score=(a,weight,factors=[1,1])=>a.readings.reduce((s,r,i)=>s+(i?100-weight:weight)*r.polarity*Math.sign(r.delta)*magnitudePoints('claims',r.delta,r.limits,factors[i]),0)
  const sign=x=>Math.abs(x)<1e-9?0:Math.sign(x)
  const complete=history.filter(a=>a.coverage===1),conflicts=complete.filter(a=>a.readings[0].points*a.readings[1].points<0)
  const changed=complete.filter(a=>old(a).direction!==a.direction)
  const partialChanged=history.filter(a=>a.coverage<1&&old(a).direction!==a.direction)
  const target=history.find(a=>a.publishedAt===at)
  assert.ok(target);assert.equal(target.direction,'weakening');assert.equal(target.strength,'slight')
  assert.ok(Math.abs(target.net*4+5.61538462)<1e-8)
  for(const a of history){
    assert.equal(a.version,'USD-CLAIMS-R1.1')
    assert.ok(Math.abs(a.supportive+a.negative-a.net)<1e-8&&Math.abs(a.net)<=100)
    assert.ok(a.readings.every(r=>r.points===null||Math.abs(r.points)<=4))
    assert.ok(a.readings.every(r=>r.points===null||r.delta===0||Math.sign(r.points)===-Math.sign(r.delta)))
    const baseline=old(a)
    if(a.coverage===1&&a.readings.every(r=>r.points>=0))assert.equal(a.direction,baseline.direction)
    if(a.coverage===1&&a.readings.every(r=>r.points<=0))assert.equal(a.direction,baseline.direction)
  }
  // Replay every changed complete case without later inventory, not just the exemplar.
  for(const a of [...changed,target]){
    const result=calculateR1({release:releases.get(a.releaseId),events:capture.events.filter(e=>e.release_at<=a.publishedAt),settings:{version:1,selected:['claims'],calibration:input.calibration},savedBands:{}})
    assert.deepEqual(result.assessment,a)
  }
  for(const component of ['initial','continuing']){
    const model=r1ScatterModel(history,component,target.releaseId)
    for(const point of model.points){
      const r=history.find(a=>a.releaseId===point.releaseId).readings.find(r=>r.id===component)
      assert.equal(point.signal.points,r.points)
      assert.equal(point.signal.size,r.magnitude===null?null:['Unchanged','Small','Medium','Large','Extreme'][r.magnitude])
    }
    const preview=r1ScatterModel(history,component,target.releaseId,[10,20,40])
    assert.equal(preview.inspection.signal.points,Math.sign(preview.inspection.delta)*magnitudePoints('claims',preview.inspection.delta,[10,20,40]))
  }
  const sums=[60,70].map(weight=>({weight,positive:complete.filter(a=>sign(score(a,weight))>0).length,negative:complete.filter(a=>sign(score(a,weight))<0).length,flat:complete.filter(a=>sign(score(a,weight))===0).length,weightSensitive:complete.filter(a=>[weight-5,weight+5].some(w=>sign(score(a,w))!==sign(score(a,weight)))).length,boundarySensitive:complete.filter(a=>[.9,1,1.1].some(f=>[.9,1,1.1].some(g=>sign(score(a,weight,[f,g]))!==sign(score(a,weight))))).length,target:score(target,weight)}))
  for(const weight of [55,60,65,70])for(const f of [.9,1,1.1])for(const g of [.9,1,1.1])assert.ok(score(target,weight,[f,g])<0)
  const builtWorker=pattern=>{
    const asset=fs.readdirSync(path.join(root,'dist/assets')).find(name=>pattern.test(name))
    assert.ok(asset,'Build before audit')
    const shim=`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:v=>parentPort.postMessage(v)};await import(${JSON.stringify(pathToFileURL(path.join(root,'dist/assets',asset)).href)});parentPort.on('message',data=>self.onmessage({data}));`
    return new Worker(new URL(`data:text/javascript,${encodeURIComponent(shim)}`),{type:'module'})
  }
  const worker=builtWorker(/^history\.worker-.*\.js$/)
  try{const reply=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({id:1,input})});assert.deepEqual(reply.result,history)}finally{await worker.terminate()}
  const sourceInput={release:releases.get(target.releaseId),events:capture.events,settings:{version:1,selected:['claims'],calibration:input.calibration},savedBands:{}}
  const sourceExpected=calculateR1(sourceInput),sourceWorker=builtWorker(/^r1\.worker-.*\.js$/)
  assert.deepEqual(sourceExpected.assessment,target);assert.equal(sourceExpected.overall.direction,'weakening')
  try{const reply=await new Promise((resolve,reject)=>{sourceWorker.once('message',resolve);sourceWorker.once('error',reject);sourceWorker.postMessage({id:1,input:sourceInput})});assert.deepEqual(reply.result,sourceExpected)}finally{await sourceWorker.terminate()}
  const fmt=n=>Number(n).toFixed(2),day=n=>new Date(n).toISOString().slice(0,10)
  const report=`# Claims R1.1 fractional-magnitude review\n\nRead-only ${capture.source} inventory captured through 10 October 2026; publications through ${new Date(at).toISOString()}. Automatic earlier-history bands; browser overrides were not read or changed. Earlier R1 and V3 audits remain historical evidence.\n\n## Accepted rule\n\nClaims retain initial/continuing weights 70/30, native-unit conversion, revised-prior comparisons and per-series boundaries. Interpolate magnitude through (0,0), (Small,1), (Medium,2), (Large,4), then cap at 4. Band names describe the original intervals independently of fractional points. Equal automatic thresholds skip zero-width spans and retain lower-band equality; continuity is asserted for strictly increasing boundaries. Keep fractional points unrounded until weighting; round contributions and balances at the existing calculation precision. Other R1 families and legacy Claims v3 keep their existing magnitude policies. Relationships consume the refined Claims leaves once, retaining their existing budgets and freshness.\n\nThe [DOL technical notes](https://www.dol.gov/sites/dolgov/files/OPA/newsreleases/ui-claims/20222224b.pdf) support the separate initial/continuing roles and priority for emerging conditions. Exact weights and interpolation are design policies, not published currency-impact coefficients.\n\n## Replay\n\n${history.length} publications; ${complete.length} complete and ${history.length-complete.length} with unavailable evidence. Of ${conflicts.length} complete opposing-input cases, ${conflicts.filter(a=>a.readings.every(r=>r.magnitude===1)).length} placed both inputs in Small. Fractional scoring changes ${changed.length} complete directions and ${partialChanged.length} partial directions versus R1 integer magnitude at the same weights/bands. Every changed complete case has opposing input signs; available same-direction inputs preserve direction. Missing component budgets remain intact.\n\n| Initial / continuing | USD-positive | USD-negative | Balanced | Direction sensitive to ±5 weight points | Direction sensitive to independent ±10% boundaries | Oct 8 raw net |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: |\n${sums.map(s=>`| ${s.weight}/${100-s.weight} | ${s.positive} | ${s.negative} | ${s.flat} | ${s.weightSensitive} | ${s.boundarySensitive} | ${fmt(s.target)} |`).join('\n')}\n\nWeight/boundary sensitivities count changes including exact cancellation. They measure policy dependence, not accuracy against prices. October 8 remains USD-negative at all weights 55/60/65/70 and all independent boundary factors 0.9/1/1.1 tested.\n\n| October 8 input | A-P (k) | Limits (k) | Band | Signed points | Raw evidence |\n| --- | ---: | --- | --- | ---: | ---: |\n${target.readings.map(r=>`| ${r.label} | ${r.delta} | ${r.limits.join(' / ')} | ${['Unchanged','Small','Medium','Large','Extreme'][r.magnitude]} | ${fmt(r.points)} | ${fmt(r.contribution)} |`).join('\n')}\n\nResult: USD Weakening, slight evidence; supportive ${fmt(target.supportive*4)}, negative ${fmt(target.negative*4)}, net ${fmt(target.net*4)}.\n\n## Changed complete cases\n\nEach case was reviewed using unchanged weights/bands, opposing input signs and reconciled fractional contributions. This list records both directions of change rather than selecting only favorable examples. All cases reproduce after removing later publications.\n\n| Publication UTC | Initial delta (k) | Continuing delta (k) | Old raw net | New initial evidence | New continuing evidence | New raw net | 60/40 challenger net |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n${changed.map(a=>`| ${day(a.publishedAt)} | ${a.readings[0].delta} | ${a.readings[1].delta} | ${fmt(old(a).net*4)} | ${fmt(a.readings[0].contribution)} | ${fmt(a.readings[1].contribution)} | ${fmt(a.net*4)} | ${fmt(score(a,60))} |`).join('\n')}\n\n## Verification and limits\n\nAll ${history.length} assessments reconcile signed leaves and respect the cap. Every plotted component matches the assessor and magnitude labels; preview endpoints use shared fractional arithmetic. The production-built history worker matches the complete replay; the source worker matches the original release and Claims-only relationship snapshot. Changed cases and October 8 match after future-inventory removal. Unit and mounted integration tests cover zero, continuity, extreme values, tied limits, missing inputs, unchanged other families and display-clock stability.\n\nStored vintages are not proof of original publication availability. No market prices, forecasts, speeches or four-week trend vote entered this review. This supports preserving relative size and bounded arithmetic; it does not establish uniquely optimal weights or price prediction. Browser appearance/performance remains for manual review.\n\nReproduce after building: node frontend/scripts/audit-r1-claims-fractional.mjs.\n`
  fs.writeFileSync(path.join(repo,'reports/Claims-R1-fractional-audit.md'),report)
  console.log({publications:history.length,complete:complete.length,changed:changed.length,partialChanged:partialChanged.length,targetNet:precise(target.net*4),weights:sums,workerParity:true})
}finally{await server.close()}
