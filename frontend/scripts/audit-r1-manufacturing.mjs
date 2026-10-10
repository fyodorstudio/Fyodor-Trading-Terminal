import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {Worker} from 'node:worker_threads'
import {createServer} from 'vite'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),repo=path.resolve(root,'..')
const at=Date.UTC(2026,9,10,12),family='ism-manufacturing'
const capture=JSON.parse(execFileSync(path.join(repo,'bridge/.venv/Scripts/python.exe'),['-m','storage.r1_audit_snapshot','--database','storage/data/calendar.sqlite3','--as-of',String(at)],{cwd:repo,encoding:'utf8',maxBuffer:128*1024*1024}))
const server=await createServer({root,server:{middlewareMode:true,hmr:false}})
try{
  const {calculateR1History}=await server.ssrLoadModule('./src/scoring-system/r1/history.ts')
  const {calculateR1}=await server.ssrLoadModule('./src/scoring-system/r1/analysis.ts')
  const {createR1History}=await server.ssrLoadModule('./src/scoring-system/r1/features.ts')
  const {balance,precise}=await server.ssrLoadModule('./src/scoring-system/r1/arithmetic.ts')
  const {r1ScatterModel}=await server.ssrLoadModule('./src/scatter-plot/inspection/r1-scatter-model.ts')
  const {combineR1}=await server.ssrLoadModule('./src/scoring-system/r1/relationships.ts')
  const {r1DefaultSettings}=await server.ssrLoadModule('./src/scoring-system/r1/settings.ts')
  const {r1Families,r1Profiles}=await server.ssrLoadModule('./src/scoring-system/r1/profiles.ts')
  const profile=r1Profiles[family],input={family,events:capture.events,at,calibration:{mode:'automatic',limits:{}},savedBands:{}}
  const history=calculateR1History(input),releases=new Map(createR1History(capture.events).releases.map(r=>[r.id,r]))
  const target=history.find(a=>new Date(a.publishedAt).toISOString().startsWith('2026-10-01'))
  assert.ok(target);assert.equal(target.readings[0].actual,55.3);assert.equal(target.readings[0].previous,53.7)
  const atWeights=(a,weights)=>balance(a.readings.map((r,i)=>({value:r.points===null?null:precise(r.points*weights[i])/4,budget:weights[i]})))
  const ordersOnly=a=>{const r=a.readings[0],leaves=[{id:`${a.releaseId}/orders`,family,label:'New orders',value:r.points===null?null:precise(r.points*100)/4,budget:100}];return {...a,...balance(leaves),leaves}}
  for(const a of history){
    assert.equal(a.version,'USD-ISM-MANUFACTURING-R1.2');assert.equal(a.readings.length,4)
    assert.deepEqual(a.readings.map(r=>r.weight),[45,30,15,10])
    assert.deepEqual(a.leaves.map(l=>l.category),['activity','activity','labor','inflation'])
    assert.ok(a.readings.every(r=>r.points===null||Math.abs(r.points)<=4));assert.ok(Math.abs(a.net)<=100)
    assert.ok(Math.abs(a.supportive+a.negative-a.net)<1e-8)
    assert.equal(a.unavailable,a.readings.reduce((s,r)=>s+(r.points===null?r.weight:0),0))
    const snapshot=calculateR1({release:releases.get(a.releaseId),events:capture.events.filter(e=>e.release_at<=a.publishedAt),settings:{version:1,selected:[family],calibration:input.calibration},savedBands:{}})
    assert.deepEqual(snapshot.assessment,a,'all publications reproduce after removing future inventory')
    assert.equal(snapshot.overall.net,a.net,'single-family routing preserves its standalone net exactly')
    assert.ok(Math.abs(snapshot.overall.leaves.reduce((s,l)=>s+l.budget,0)-100)<1e-8)
    assert.equal(snapshot.overall.leaves.length,4,'each input is counted once')
    for(const c of snapshot.overall.categories)assert.ok(Math.abs(c.net*c.share-snapshot.overall.leaves.filter(l=>l.category===c.category).reduce((s,l)=>s+(l.value??0),0))<1e-8)
  }
  const complete=history.filter(a=>a.coverage===1),opposed=complete.filter(a=>a.supportive>0&&a.negative<0)
  const weightSensitive=complete.filter(a=>profile.alternatives.slice(1).some(w=>atWeights(a,w).direction!==a.direction))
  const boundarySensitive=complete.filter(a=>a.sensitive)
  for(const component of profile.components){
    const model=r1ScatterModel(history,component.id,target.releaseId)
    for(const point of model.points){const r=history.find(a=>a.releaseId===point.releaseId).readings.find(r=>r.id===component.id);assert.equal(point.signal.points,r.points);assert.equal(point.signal.size,r.magnitude===null?null:['Unchanged','Small','Medium','Large','Extreme'][r.magnitude])}
    const original=target.readings.find(r=>r.id===component.id).points
    r1ScatterModel(history,component.id,target.releaseId,[2,4,6])
    assert.equal(target.readings.find(r=>r.id===component.id).points,original,'preview cannot mutate Inspector/history evidence')
  }
  const schedules=capture.schedules.flatMap(s=>{const f=r1Families.find(f=>r1Profiles[f].components.some(c=>c.seriesId===s.seriesId));return f?[{...s,family:f}]:[]})
  const sourceInput={release:releases.get(target.releaseId),events:capture.events,settings:r1DefaultSettings,savedBands:{},schedules},sourceExpected=calculateR1(sourceInput)
  assert.deepEqual(sourceExpected.assessment,target)
  assert.ok(Math.abs(sourceExpected.overall.leaves.filter(l=>l.family===family).reduce((s,l)=>s+l.budget,0)-1.5)<1e-8)
  const snapshots=history.slice(-3).map(a=>{
    const result=calculateR1({...sourceInput,release:releases.get(a.releaseId)}).overall
    const old=combineR1(result.slots.map(s=>s.family!==family||!s.assessment?s:{...s,assessment:ordersOnly(s.assessment)}),result.selected,result.at)
    assert.ok(Math.abs(result.leaves.filter(l=>l.family===family).reduce((s,l)=>s+l.budget,0)-1.5)<1e-8)
    return {at:a.publishedAt,old,result}
  })
  const builtWorker=pattern=>{
    const asset=fs.readdirSync(path.join(root,'dist/assets')).find(name=>pattern.test(name));assert.ok(asset,'Build before audit')
    const shim=`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:v=>parentPort.postMessage(v)};await import(${JSON.stringify(pathToFileURL(path.join(root,'dist/assets',asset)).href)});parentPort.on('message',data=>self.onmessage({data}));`
    return new Worker(new URL(`data:text/javascript,${encodeURIComponent(shim)}`),{type:'module'})
  }
  for(const [pattern,job,expected]of [[/^history\.worker-.*\.js$/,input,history],[/^r1\.worker-.*\.js$/,sourceInput,sourceExpected]]){
    const worker=builtWorker(pattern)
    try{const reply=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({id:1,input:job})});assert.deepEqual(reply.result,expected)}finally{await worker.terminate()}
  }
  const counts=items=>['strengthening','weakening','balanced','insufficient'].map(d=>items.filter(a=>a.direction===d).length)
  const fmt=n=>n==null?'Unavailable':Number(n).toFixed(2),day=n=>new Date(n).toISOString().slice(0,10)
  const report=`# ISM Manufacturing R1.2 review

Read-only ${capture.source} inventory through ${new Date(at).toISOString()}; browser overrides were not read. This supersedes the Orders-only model. Stored snapshots are not proof of original publication-time availability.

## Accepted policy

MT5 supplies New Orders 45%, PMI 30%, Employment 15%, Prices Paid 10%. Each uses its own Actual minus revised/supplied prior and compatible per-series calibration. Fractional magnitude interpolates through (0,0), (Small,1), (Medium,2), (Large,4), capped at four. No forecasts, standalone Production proxy or external scoring feed. Missing/invalid inputs retain their nominal budgets; a newer partial publication replaces the prior slot. Above/below 50 is state context, never an additional directional vote.

[ISM methodology](https://www.ismworld.org/supply-management-news-and-reports/reports/seasonal-adjustment-factors/) explains the headline's five equal components, including Orders, Employment and Production. This deliberately overlapping model emphasizes demand while retaining the composite. [ISM's March 2020 discussion](https://www.ismworld.org/supply-management-news-and-reports/news-publications/inside-supply-management-magazine/blog/2020-04/rob-roundup-march-pmi/) shows why delivery delays can cushion PMI during deteriorating activity. Prices Paid measures input-price conditions, not a percent consumer-inflation rate or stronger output. Its positive mapping is an explicit inflation-pressure policy; [the Fed](https://www.federalreserve.gov/faqs/economy_14419.htm) targets consumer PCE inflation. These sources justify roles, not uniquely optimal numerical weights.

Relationships allocate the existing manufacturing budget first, then route Orders/PMI to Activity, Employment to Labor and Prices Paid to Inflation. Baseline shares are 75/15/10 within that budget. No aggregate manufacturing vote is added on top. Full-scope manufacturing remains 1.5% overall (former Activity 15% × Manufacturing 10%). Effective category budgets become Inflation 35.15%, Labor 30.225%, Activity 14.625%, Fed 20%. Other families retain their assigned global budgets. Selected-subset normalization occurs before routing; manufacturing alone remains one 100% budget. Unknown/stale inputs retain the same role budgets. Category scores normalize within their routed allowance, and Inspector exposes each actual overall share. Consumer CPI/PCE replacement and matching-month PPI still operate within their original consumer/producer allowance. The signed sum resolves before side rounding; intermediate allocations do not round individual values, preventing a false lead from fractional cancellation.

## Replay and sensitivity

${history.length} publications; ${complete.length} fully scorable and ${history.length-complete.length} partial/unavailable under earlier-history automatic boundaries (minimum 60 prior usable observations). ${opposed.length} complete releases contain both signs.

| Model | Strengthening | Weakening | Balanced | Insufficient |
| --- | ---: | ---: | ---: | ---: |
| Orders-only fractional comparator | ${counts(history.map(ordersOnly)).join(' | ')} |
| Four-input R1.2 | ${counts(history).join(' | ')} |

${weightSensitive.length} complete directions change under the four nearby weight alternatives ${profile.alternatives.slice(1).map(w=>w.join('/')).join(', ')}. ${boundarySensitive.length} change under the joint weight and independent ±10% boundary variants. Sensitive dates (weights): ${weightSensitive.map(a=>day(a.publishedAt)).join(', ')}. ${complete.filter(a=>ordersOnly(a).direction!==a.direction).length} complete directions differ from Orders-only. These tests describe robustness to specified alternatives, not measured currency accuracy. No price fitting was performed.

## October 1 example

| Input | Weight | Actual | Previous | A−P | Automatic limits | Signed points | Raw evidence |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
${target.readings.map(r=>`| ${r.label} | ${r.weight}% | ${r.actual} | ${r.previous} | ${r.delta} | ${r.limits?.join(' / ')} | ${fmt(r.points)} | ${fmt(r.contribution)} |`).join('\n')}

${target.direction}, ${target.strength} evidence: supportive ${fmt(target.supportive*4)}, negative ${fmt(target.negative*4)}, net ${fmt(target.net*4)}. ${target.explanation} Direction stays positive in the tested alternatives. These automatic replay bands can differ from the user's manual bands.

## Full-scope snapshots

| Publication UTC | Orders-only overall net | Four-input overall net | Known coverage | Four-input direction |
| --- | ---: | ---: | ---: | --- |
${snapshots.map(s=>`| ${day(s.at)} | ${fmt(s.old.net)} | ${fmt(s.result.net)} | ${fmt(s.result.coverage*100)}% | ${s.result.direction} |`).join('\n')}

## Verification

All ${history.length} publications reconcile contributions, retain bounded scores and nominal uncertainty, and reproduce after removing future inventory. Each single-family relationship counts exactly four routed leaves with the same net as standalone. Category shares reconcile to overall evidence. Both production-built workers match the shared engine; all four Scatter inputs and previews match their Inspector contributions. Mounted regressions cover per-input controls, Apply/Reset, incoming Prices Paid changes, settings portability, fixed role budgets, clocks and local previews. Frontend suites, lint and build are recorded in the active objective after completion. Browser appearance/performance and comparison against price remain user review.

Reproduce after building: node frontend/scripts/audit-r1-manufacturing.mjs.
`
  fs.writeFileSync(path.join(repo,'reports/Manufacturing-R1-four-input-audit.md'),report)
  console.log(JSON.stringify({publications:history.length,complete:complete.length,opposed:opposed.length,weightSensitive:weightSensitive.length,jointSensitive:boundarySensitive.length,target:{direction:target.direction,strength:target.strength,supportive:precise(target.supportive*4),negative:precise(target.negative*4),net:precise(target.net*4)},workerParity:true,scatterParity:true,budgetPreserved:true},null,2))
}finally{await server.close()}
