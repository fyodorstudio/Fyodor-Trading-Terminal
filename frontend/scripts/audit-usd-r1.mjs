import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {Worker} from 'node:worker_threads'
import {execFileSync} from 'node:child_process'
import {createServer} from 'vite'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const stored=process.argv[2]==='--stored'
const capture=JSON.parse(stored?execFileSync(path.join(root,'../bridge/.venv/Scripts/python.exe'),['-m','storage.r1_audit_snapshot','--database','storage/data/calendar.sqlite3','--as-of',String(Date.UTC(2026,9,8,12,30))],{cwd:path.join(root,'..'),encoding:'utf8',maxBuffer:128*1024*1024}):fs.readFileSync(process.argv[2]??path.join(root,'../storage/data/claims-oct08-live-review-input.json'),'utf8').replace(/^\uFEFF/,''))
const events=capture.inputUSD?.events??capture.events,at=capture.asOf??Date.UTC(2026,9,8,12,30)
assert.ok(Array.isArray(events))
const server=await createServer({root,server:{middlewareMode:true,hmr:false}})
try{
  const {r1Families,r1Profiles}=await server.ssrLoadModule('./src/scoring-system/r1/profiles.ts')
  const {calculateR1History}=await server.ssrLoadModule('./src/scoring-system/r1/history.ts')
  const {calculateR1}=await server.ssrLoadModule('./src/scoring-system/r1/analysis.ts')
  const {createR1History}=await server.ssrLoadModule('./src/scoring-system/r1/features.ts')
  const {r1ScatterModel}=await server.ssrLoadModule('./src/scatter-plot/inspection/r1-scatter-model.ts')
  const histories=[],summaries=[],calibration={mode:'automatic',limits:{}},savedBands={}
  for(const family of r1Families){
    const input={family,events,at,calibration,savedBands},started=performance.now(),history=calculateR1History(input)
    const counts={strengthening:0,weakening:0,balanced:0,insufficient:0},sensitive=history.filter(a=>a.sensitive).length
    const releases=new Map(createR1History(events).releases.map(r=>[r.id,r]))
    for(const a of history){
      counts[a.direction]++
      assert.ok(Math.abs(a.supportive+a.negative-a.net)<1e-8)
      assert.ok(Math.abs(a.net)<=100&&a.unavailable<=100)
      for(const r of a.readings)assert.ok(r.points===null||Math.abs(r.points)<=4)
      const release=releases.get(a.releaseId)
      // Remove every later publication: genuine as-of calibration, not viewport calibration.
      if(a===history.at(-1)||a===history[0]){
        const snapshot=calculateR1({release,events:events.filter(e=>e.release_at<=a.publishedAt),settings:{version:1,calibration,selected:[family]},savedBands})
        assert.deepEqual(snapshot.assessment,a)
      }
    }
    for(const component of r1Profiles[family].components){
      const model=r1ScatterModel(history,component.id,null)
      for(const point of model.points){const reading=history.find(a=>a.releaseId===point.releaseId).readings.find(r=>r.id===component.id);assert.equal(point.signal.points,reading.points);assert.deepEqual(point.signal.limits,reading.limits)}
    }
    const latest=history.at(-1)
    summaries.push({family,n:history.length,...counts,sensitive,latest:latest?`${latest.direction}: ${latest.net*4}; coverage ${Math.round(latest.coverage*100)}%`:'No captured rows',ms:Math.round(performance.now()-started)})
    histories.push({input,history})
  }
  // Execute the production-built history worker using Node's worker port shim.
  const asset=fs.readdirSync(path.join(root,'dist/assets')).find(name=>/^history\.worker-.*\.js$/.test(name))
  assert.ok(asset,'Build before audit: missing R1 history worker')
  const shim=`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:v=>parentPort.postMessage(v)};await import(${JSON.stringify(pathToFileURL(path.join(root,'dist/assets',asset)).href)});parentPort.on('message',data=>self.onmessage({data}));`
  const worker=new Worker(new URL(`data:text/javascript,${encodeURIComponent(shim)}`),{type:'module'})
  try{for(const {input,history}of histories){const reply=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({id:1,input})});assert.deepEqual(reply.result,history)}}finally{await worker.terminate()}
  const schedules=(capture.schedules??[]).flatMap(s=>{const family=r1Families.find(f=>r1Profiles[f].components.some(c=>c.seriesId===s.seriesId));return family?[{...s,family}]:[]})
  const releases=createR1History(events).releases.filter(r=>r1Families.includes(r.familyId)&&r.releaseAt<=at)
  const selected=releases.at(-1)
  const snapshots=[at-7*86400000,at-86400000,at].map(asOf=>{
    const release=releases.filter(r=>r.releaseAt<=asOf).at(-1),input={release,events,asOf,schedules,settings:{version:1,calibration,selected:r1Families},savedBands}
    const analysis=calculateR1(input)
    assert.ok(Math.abs(analysis.overall.supportive+analysis.overall.negative-analysis.overall.net)<1e-8)
    for(const slot of analysis.overall.slots)assert.ok(!slot.assessment||slot.assessment.publishedAt<=asOf)
    const withoutFuture=calculateR1({...input,events:events.filter(e=>e.release_at<=asOf),schedules:schedules.filter(s=>s.knownAt<=asOf)})
    assert.deepEqual(withoutFuture,analysis,'aggregate future-removal parity')
    return{input,analysis}
  })
  const sourceAsset=fs.readdirSync(path.join(root,'dist/assets')).find(name=>/^r1\.worker-.*\.js$/.test(name))
  const sourceShim=`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:v=>parentPort.postMessage(v)};await import(${JSON.stringify(pathToFileURL(path.join(root,'dist/assets',sourceAsset)).href)});parentPort.on('message',data=>self.onmessage({data}));`
  const sourceWorker=new Worker(new URL(`data:text/javascript,${encodeURIComponent(sourceShim)}`),{type:'module'})
  try{for(const {input,analysis}of snapshots){const reply=await new Promise((resolve,reject)=>{sourceWorker.once('message',resolve);sourceWorker.once('error',reject);sourceWorker.postMessage({id:1,input})});assert.deepEqual(reply.result,analysis)}}finally{await sourceWorker.terminate()}
  const aggregateAudit=`\n## Source and aggregate replay\n\n${stored?'Read-only local SQLite adapter, including captured observation versions and planned schedules.':'Legacy captured input; original observation versions are absent.'} ${schedules.length} mapped planned observations. Earliest recoverable snapshots remain explicitly retrospective when captured after publication. Corrections are available at capture time, not an inferred publisher timestamp.\n\n| As of (UTC) | Direction | Supportive | Negative | Net | Coverage | Current slots |\n| --- | --- | ---: | ---: | ---: | ---: | ---: |\n${snapshots.map(({analysis:a})=>`| ${new Date(a.overall.at).toISOString()} | ${a.overall.direction} | ${a.overall.supportive} | ${a.overall.negative} | ${a.overall.net} | ${Math.round(a.overall.coverage*100)}% | ${a.overall.slots.filter(s=>s.status==='current').length} |`).join('\n')}\n\nAll three aggregate snapshots match after removing later publications and later schedule announcements, and match production R1-worker replies. Unknown historical schedules retain uncertainty; no current slot is fabricated from an actual release date. Last captured eligible publication: ${selected?.id}.\n`
  const report=`# USD R1 stored-history replay\n\nRun: 10 October 2026. Input: local captured USD inventory through ${new Date(at).toISOString()}. R1 automatic fallback, no manual overrides or invented raw bands. Saved user bands remain separate and are never overwritten.\n\n| Family | Publications | Strengthening | Weakening | Balanced | Insufficient | Sensitive | Latest raw net / coverage | Runtime ms |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |\n${summaries.map(s=>`| ${s.family} | ${s.n} | ${s.strengthening} | ${s.weakening} | ${s.balanced} | ${s.insufficient} | ${s.sensitive} | ${s.latest} | ${s.ms} |`).join('\n')}\n\nEvery replay reconciles positive + negative = net, enforces score and magnitude bounds, and checks every plotted component against the same assessment. Earliest/latest assessments match after removing later publications. Production-built history-worker replies match every family exactly. Sensitivity counts use the documented weight/boundary registry; they are not probabilities.\n\nThis capture is stored inventory, not proof of original publication vintages. Later corrections or retrospectively supplied priors can be present. No price-response, profitability or uniquely optimal weighting claim is made. Publication schedule provenance is tested independently; historical dates without a previously observed planned release remain unavailable in relationships.\n\nFeed gap: preferred manufacturing Production is not mapped; its 40% uncertainty is preserved. This replay does not silently replace it with the headline or employment index.\n`
  fs.writeFileSync(path.join(root,'../reports/USD-R1-stored-history-audit.md'),report+aggregateAudit)
  console.log(summaries)
  console.log('R1 production history worker and Scatter parity passed; report saved.')
}finally{await server.close()}
