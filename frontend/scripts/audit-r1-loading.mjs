import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {Worker} from 'node:worker_threads'
import {createServer} from 'vite'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),repo=path.resolve(root,'..')
const at=Date.UTC(2026,6,30,12,30),captureAt=Date.UTC(2026,9,10,12)
const server=await createServer({root,server:{middlewareMode:true,hmr:false,ws:false}})
try{
 const {allR1SeriesIds}=await server.ssrLoadModule('./src/scoring-system/r1/profiles.ts')
 const {r1DefaultSettings,eurR1DefaultSettings}=await server.ssrLoadModule('./src/scoring-system/r1/settings.ts')
 const {createR1History}=await server.ssrLoadModule('./src/scoring-system/r1/features.ts')
 const {calculateR1Pair}=await server.ssrLoadModule('./src/scoring-system/r1/pair.ts')
 const {calculateR1History}=await server.ssrLoadModule('./src/scoring-system/r1/history.ts')
 const py=`import json,sys,time\nfrom pathlib import Path\nfrom storage.calendar_store import CalendarStore,HISTORY_START\nstore=CalendarStore(Path('storage/data/calendar.sqlite3'),readonly=True)\ntry:\n source=store.db.execute('SELECT source_id,count(*) n FROM events GROUP BY source_id ORDER BY n DESC').fetchone()[0]\n ids=json.loads(sys.argv[1]);at=int(sys.argv[2]);rows=[];cursor={};pages=0;start=time.perf_counter()\n while True:\n  page=store.query(source,HISTORY_START,at//1000+172800,event_ids=ids,time_basis='chart',r1_as_of=at,limit=5000,**cursor);rows.extend(page['events']);pages+=1\n  if not page['next_cursor']:break\n  cursor=page['next_cursor']\n print(json.dumps({'events':rows,'source':source,'pages':pages,'queryMs':(time.perf_counter()-start)*1000}))\nfinally:store.close()`
 const data=JSON.parse(execFileSync(path.join(repo,'bridge/.venv/Scripts/python.exe'),['-c',py,JSON.stringify(allR1SeriesIds),String(captureAt)],{cwd:repo,encoding:'utf8',maxBuffer:192*1024*1024}))
 const releases=createR1History(data.events).releases,release=releases.find(r=>r.familyId==='gdp'&&r.releaseAt===at)
 assert.ok(release)
 const input={release,events:data.events,settings:r1DefaultSettings,eurSettings:eurR1DefaultSettings,savedBands:{}}
 const result=calculateR1Pair(input),reading=result.assessment.readings[0]
 assert.equal(reading.actual,1.5);assert.equal(reading.previous,2.1);assert.equal(reading.delta,-.6)
 assert.equal(reading.samples,45);assert.equal(reading.calibration,'r1-automatic');assert.equal(result.assessment.coverage,1)
 const noFuture={...input,events:data.events.filter(e=>e.release_at<=at)}
 assert.deepEqual(calculateR1Pair(noFuture),result,'Reused broad history must preserve both currencies at the selected clock')
 const timeline=calculateR1History({family:'gdp',events:data.events,at:captureAt,calibration:input.settings.calibration,savedBands:{}})
 assert.deepEqual(timeline.find(a=>a.releaseId===release.id),result.assessment,'GDP Inspector/Scatter parity')
 const asset=fs.readdirSync(path.join(root,'dist/assets')).find(n=>/^pair\.worker-.*\.js$/.test(n))
 assert.ok(asset,'Build before replay')
 const shim=`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:v=>parentPort.postMessage(v)};await import(${JSON.stringify(pathToFileURL(path.join(root,'dist/assets',asset)).href)});parentPort.on('message',data=>self.onmessage({data}));`
 const worker=new Worker(new URL(`data:text/javascript,${encodeURIComponent(shim)}`),{type:'module'})
 const run=(id,input)=>new Promise((resolve,reject)=>{const start=performance.now();worker.once('message',reply=>{if(reply.error)reject(new Error(reply.error));else resolve({result:reply.result,ms:performance.now()-start})});worker.once('error',reject);worker.postMessage({id,input})})
 let first,second,third
 try{
  first=await run(1,input);second=await run(2,input)
  assert.deepEqual(first.result,result);assert.deepEqual(second.result,result)
  const changed=data.events.map(e=>e.event_id==='840010007'&&e.release_at===at?{...e,actual:3,actual_raw_scaled_1e6:undefined,r1_vintages:undefined}:e)
  const corrected={...input,events:changed}
  third=await run(3,corrected);assert.deepEqual(third.result,calculateR1Pair(corrected))
  assert.equal(third.result.assessment.readings[0].actual,3,'Worker history reuse cannot hide a genuine data change')
 }finally{await worker.terminate()}
 const report=`# R1 scope, quarterly GDP and loading refinement

Read-only ${data.source} inventory through ${new Date(captureAt).toISOString()}. No collection, database writes, browser automation or price fitting.

- Inspector visibility filters no longer select relationship inputs. USD/EUR model settings retain their own explicit scopes.
- Inspector shows the other currency's combined evidence directly, not a EURUSD pair balance or pair interval. Both currencies keep the same selected clock.
- USD-GDP-R1.1 keeps GDP q/q as its only voting input. Quarterly momentum/revision comparisons remain separate; automatic magnitude now requires 24 earlier comparisons of the matching stage, consistent with the EUR quarterly minimum. This minimum is a design policy, not a proven market coefficient. Existing manual and compatible raw bands retain priority.
- July 30 GDP: Actual ${reading.actual}, comparison ${reading.previous}, delta ${reading.delta} pp; ${reading.samples} prior momentum samples; boundaries ${reading.limits.join(' / ')} pp; raw evidence ${result.assessment.net*4}; direction ${result.assessment.direction}. Inspector/Scatter parity and removal of future inventory pass.
- Loaded versioned history uses a stable quarter horizon; vintages, calibration and schedules still admit information at the selected publication clock. Reopening reuses snapshots only after exact source revision/coverage validation. Snapshots are bounded to four queries; weak history/feature caches disappear when their source arrays are released.
- Deterministic mounted tests verify zero history requests when moving between loaded publications or reopening unchanged data, zero scoring jobs from visibility filters, applied manual bands and genuine correction propagation. Source-read checks prove history/feature reuse avoids repeated extraction. The built worker passes cold/warm equality and correction invalidation.

## Terminal timing sample

${data.events.length} rows across ${data.pages} storage pages. Storage queries: ${Math.round(data.queryMs)} ms. Built worker round trips including startup/serialization: cold ${Math.round(first.ms)} ms; reused history ${Math.round(second.ms)} ms; changed data ${Math.round(third.ms)} ms. These are informational samples, not browser latency guarantees. Initial history fetch remains necessary; visual/browser review stays with the user.

The GDP calibration fix can change historical overall evidence wherever quarterly momentum was previously unknown. Earlier reports retain their dated outputs. Other USD magnitude algorithms, family weights, manual settings and legacy models are unchanged.
`
 fs.writeFileSync(path.join(repo,'reports/R1-scope-GDP-loading-audit.md'),report)
 console.log(`PASS: GDP ${reading.delta} pp, ${reading.samples} samples, ${result.assessment.net*4} raw points; ${timeline.length} GDP publications; built worker cold ${Math.round(first.ms)} ms / warm ${Math.round(second.ms)} ms / corrected ${Math.round(third.ms)} ms`)
}finally{await server.close()}
