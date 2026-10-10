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
  const {balance,magnitude,magnitudePoints,precise}=await server.ssrLoadModule('./src/scoring-system/r1/arithmetic.ts')
  const {r1ScatterModel}=await server.ssrLoadModule('./src/scatter-plot/inspection/r1-scatter-model.ts')
  const {combineR1}=await server.ssrLoadModule('./src/scoring-system/r1/relationships.ts')
  const {r1DefaultSettings}=await server.ssrLoadModule('./src/scoring-system/r1/settings.ts')
  const {r1Families,r1Profiles}=await server.ssrLoadModule('./src/scoring-system/r1/profiles.ts')
  const schedules=capture.schedules.flatMap(s=>{
    const family=s.seriesId==='840040001'?'ism-manufacturing':r1Families.find(f=>r1Profiles[f].components.some(c=>c.seriesId===s.seriesId))
    return family?[{...s,family}]:[]
  })
  const input={family,events:capture.events,at,calibration:{mode:'automatic',limits:{}},savedBands:{}}
  const history=calculateR1History(input),releases=new Map(createR1History(capture.events).releases.map(r=>[r.id,r]))
  const target=history.find(a=>new Date(a.publishedAt).toISOString().startsWith('2026-10-01'))
  assert.ok(target,'October 1 exemplar must exist');assert.equal(target.readings[0].actual,55.3);assert.equal(target.readings[0].previous,53.7)
  const integerReading=a=>{const r=a.readings[0];return r.points===null?null:Math.sign(r.delta)*(r.delta===0?0:magnitude(r.delta,r.limits))}
  const old=a=>balance([{value:integerReading(a)===null?null:integerReading(a)*60/4,budget:60},{value:null,budget:40}])
  const integerOrders=a=>balance([{value:integerReading(a)===null?null:integerReading(a)*100/4,budget:100}])
  for(const a of history){
    assert.equal(a.version,'USD-ISM-MANUFACTURING-ORDERS-R1.1');assert.equal(a.readings.length,1)
    assert.equal(a.readings[0].weight,100);assert.equal(a.leaves.length,1)
    assert.ok(Math.abs(a.net)<=100);assert.equal(precise(a.supportive+a.negative),a.net)
    assert.ok(a.readings.every(r=>r.points===null||Math.abs(r.points)<=4))
    if(a.coverage===1){assert.equal(a.direction,integerOrders(a).direction);assert.equal(Math.sign(a.net),Math.sign(a.readings[0].delta))}
    else assert.equal(a.unavailable,100,'unusable orders retain their full nominal budget')
    const snapshot=calculateR1({release:releases.get(a.releaseId),events:capture.events.filter(e=>e.release_at<=a.publishedAt),settings:{version:1,selected:[family],calibration:input.calibration},savedBands:{}})
    assert.deepEqual(snapshot.assessment,a,'all publications reproduce after removing future inventory')
  }
  const complete=history.filter(a=>a.coverage===1),changed=history.filter(a=>old(a).direction!==a.direction)
  const differentStrength=complete.filter(a=>a.strength!==integerOrders(a).strength)
  const boundarySensitive=complete.filter(a=>[.9,1,1.1].some(f=>{
    const r=a.readings[0],net=precise(Math.sign(r.delta)*(r.delta===0?0:magnitudePoints(family,r.delta,r.limits,f))*100/4)
    return Math.sign(net)!==Math.sign(a.net)
  }))
  const model=r1ScatterModel(history,'orders',target.releaseId)
  for(const point of model.points){const r=history.find(a=>a.releaseId===point.releaseId).readings[0];assert.equal(point.signal.points,r.points);assert.equal(point.signal.size,r.magnitude===null?null:['Unchanged','Small','Medium','Large','Extreme'][r.magnitude])}
  const preview=r1ScatterModel(history,'orders',target.releaseId,[2,4,6])
  assert.equal(preview.inspection.signal.points,.8);assert.equal(model.inspection.signal.points,target.readings[0].points,'preview leaves the saved assessment intact')
  const sourceInput={release:releases.get(target.releaseId),events:capture.events,settings:{version:1,selected:[family],calibration:input.calibration},savedBands:{},schedules}
  const sourceExpected=calculateR1(sourceInput);assert.deepEqual(sourceExpected.assessment,target);assert.equal(sourceExpected.overall.net,target.net)
  const zeroSlot=f=>({family:f,status:'current',assessment:{family:f,reference:target.reference,publishedAt:target.publishedAt,leaves:[{id:f,family:f,label:f,value:0,budget:100}],...balance([{value:0,budget:100}])}})
  const activity=combineR1(['gdp','retail','ism-services'].map(zeroSlot).concat({family,status:'current',assessment:target}),['gdp','retail','ism-services',family],target.publishedAt)
  assert.equal(activity.net,precise(target.leaves[0].value*.1));assert.equal(activity.leaves.filter(l=>l.family===family).length,1)
  const snapshots=history.slice(-3).map(a=>{
    const result=calculateR1({...sourceInput,release:releases.get(a.releaseId),settings:r1DefaultSettings}).overall
    const oldSlots=result.slots.map(s=>s.family!==family||!s.assessment?s:{...s,assessment:{...s.assessment,...old(s.assessment),leaves:[{id:'old/orders',family,label:'New orders',value:integerReading(s.assessment)===null?null:integerReading(s.assessment)*60/4,budget:60},{id:'old/production',family,label:'Production',value:null,budget:40}]}})
    const previous=combineR1(oldSlots,result.selected,result.at)
    assert.equal(result.slots.filter(s=>s.family===family).length,1)
    return {at:a.publishedAt,old:previous,new:result}
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
  const report=`# Manufacturing New Orders R1.1 review

Read-only ${capture.source} inventory captured through ${new Date(at).toISOString()}; browser settings were not read or changed. This supersedes the implemented incomplete manufacturing demand model, not historical reports.

## Source decision and scope

The stored MT5 inventory and [provider catalog](https://www.mql5.com/en/economic-calendar/united-states) contain Manufacturing PMI, Prices Paid, Employment and New Orders, but no ISM Production series. [ISM's September 2026 report](https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/pmi/september/) does publish Production 56.7 versus 58.3 alongside New Orders 55.3 versus 53.7. Verification of one official report is not a connected, versioned Production history. No external live feed, scraping, reconstructed proxy or database rewrite was introduced.

The user authorized the explicit feed-compatible alternative: **USD-ISM-MANUFACTURING-ORDERS-R1.1**, New Orders 100%, labeled Manufacturing new orders. This is a narrower economic question, not automatic renormalization of missing data. Coverage means completeness of this one-input model, not the full ISM report. Missing/invalid Orders or unavailable nonzero calibration still retain a 100% unknown budget. The 60/40, 50/50 and 70/30 Orders/Production candidates remain unvalidated without eligible Production history; none are represented as tested or disproved.

[ISM methodology](https://www.ismworld.org/supply-management-news-and-reports/reports/seasonal-adjustment-factors/) supports diffusion-index interpretation and confirms headline overlap with components. [ISM's March 2020 explanation](https://www.ismworld.org/supply-management-news-and-reports/news-publications/inside-supply-management-magazine/blog/2020-04/rob-roundup-march-pmi/) documents supply delays cushioning the headline during deteriorating activity. These support the selected economic question; neither source prescribes currency coefficients or fractional magnitude.

## Arithmetic and interpretation

Interpolate magnitude through (0,0), (Small,1), (Medium,2), (Large,4), capped at four, using unchanged per-series boundary precedence and earlier-history calibration. Keep band labels independent of fractional points and round only after weighting. Positive A−P supports USD; negative A−P weakens it; zero is unchanged. Above/below 50 describes expansion/contraction separately and never flips A−P direction. Crossing 50 receives concise context, not an extra vote.

Relationships receive one normalized Orders leaf at the existing manufacturing allocation: 10% of the full activity category, itself 15% of full overall USD evidence. Freshness and user-selected category normalization remain unchanged. PMI supplies publication/reference/schedule metadata only: a newer report with missing Orders replaces the old slot with unavailable evidence. PMI, Employment, Prices Paid and Fed Manufacturing Production do not enter this score. Legacy scorers and ISM Services are unchanged. Existing Orders settings and unrelated overrides survive; retired Production overrides remain portable and inert. Retired Scatter input selections resolve to Orders.

## Stored replay

${history.length} publications; ${complete.length} usable and ${history.length-complete.length} unavailable under automatic earlier-history calibration (minimum 60 earlier usable observations). Counts use original release snapshots, not proof of original publication-time availability.

| Model | Strengthening | Weakening | Balanced | Insufficient |
| --- | ---: | ---: | ---: | ---: |
| Prior incomplete 60/40 integer model | ${counts(history.map(old)).join(' | ')} |
| Orders-only integer comparator | ${counts(history.map(integerOrders)).join(' | ')} |
| Orders-only fractional R1.1 | ${counts(history).join(' | ')} |

${changed.length} directions change versus the incomplete model; ${differentStrength.length} usable evidence-strength labels differ versus Orders-only integer scoring. Fractional magnitude never flips a usable single-input direction. ${boundarySensitive.length} usable directions change under ±10% boundary sensitivity; magnitude/strength can still change. No relative-weight sensitivity is claimed for a one-input model. The gain in coverage is the explicitly narrowed scope, not recovered Production data.

| October 1 input | Actual | Previous | A−P | Limits | Band | Signed points | Raw evidence |
| --- | ---: | ---: | ---: | --- | --- | ---: | ---: |
${target.readings.map(r=>`| ${r.label} | ${r.actual} | ${r.previous} | ${r.delta} | ${r.limits?.join(' / ')} | ${['Unchanged','Small','Medium','Large','Extreme'][r.magnitude]} | ${fmt(r.points)} | ${fmt(r.contribution)} |`).join('\n')}

Result: ${target.direction}, ${target.strength} evidence. ${target.explanation} Automatic replay bands are not the user's browser overrides. The opposing Production reading remains outside this explicitly Orders-only result.

## Aggregate snapshots with all families selected

| Publication UTC | Prior overall net | Refined overall net | Prior known coverage | Refined known coverage | Refined overall direction |
| --- | ---: | ---: | ---: | ---: | --- |
${snapshots.map(s=>`| ${day(s.at)} | ${fmt(s.old.net)} | ${fmt(s.new.net)} | ${fmt(s.old.coverage*100)}% | ${fmt(s.new.coverage*100)}% | ${s.new.direction} |`).join('\n')}

## Verification and remaining checks

All ${history.length} publications reconcile contributions, retain the cap and reproduce after future-inventory removal. Both production-built workers match the shared engine. Scatter points and preview match Inspector; activity consumes exactly one normalized manufacturing vote. Unit/mounted tests cover level-versus-change cases, revised baselines, missing data, unrelated input exclusion, dormant settings portability, retired selections, preview/Apply/Reset and display-clock stability. Frontend suites, lint and build are recorded in the active objective after completion. Browser appearance/performance and comparison with price remain user review; no price fitting, forecasts or extra contextual votes entered the score.

Reproduce after building: node frontend/scripts/audit-r1-manufacturing-orders.mjs.
`
  fs.writeFileSync(path.join(repo,'reports/Manufacturing-orders-R1-audit.md'),report)
  console.log(JSON.stringify({publications:history.length,usable:complete.length,changed:changed.length,strengthChanged:differentStrength.length,boundarySensitive:boundarySensitive.length,target:{direction:target.direction,strength:target.strength,net:precise(target.net*4),limits:target.readings[0].limits},workerParity:true,scatterParity:true},null,2))
}finally{await server.close()}
