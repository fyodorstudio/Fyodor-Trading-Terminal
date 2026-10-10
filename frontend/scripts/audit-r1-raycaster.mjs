import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {Worker} from 'node:worker_threads'
import {createServer} from 'vite'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),repo=path.resolve(root,'..'),captureAt=Date.UTC(2026,9,10,12)
const server=await createServer({root,server:{middlewareMode:true,hmr:false,ws:false}})
try {
 const {allR1SeriesIds,allR1Families,r1Profiles}=await server.ssrLoadModule('./src/scoring-system/r1/profiles.ts')
 const {r1DefaultSettings,eurR1DefaultSettings}=await server.ssrLoadModule('./src/scoring-system/r1/settings.ts')
 const {calculateR1Timeline,r1TimelineAt}=await server.ssrLoadModule('./src/scoring-system/r1/timeline.ts')
 const {calculateR1}=await server.ssrLoadModule('./src/scoring-system/r1/analysis.ts')
 const {createR1History}=await server.ssrLoadModule('./src/scoring-system/r1/features.ts')
 const py=`import json,sys,time\nfrom pathlib import Path\nfrom storage.calendar_store import CalendarStore,HISTORY_START\nstore=CalendarStore(Path('storage/data/calendar.sqlite3'),readonly=True)\ntry:\n source=store.db.execute('SELECT source_id,count(*) n FROM events GROUP BY source_id ORDER BY n DESC').fetchone()[0]\n ids=json.loads(sys.argv[1]);at=int(sys.argv[2]);rows=[];schedules=[];cursor={};pages=0;start=time.perf_counter()\n while True:\n  page=store.query(source,HISTORY_START,at//1000+172800,event_ids=ids,time_basis='chart',r1_as_of=at,limit=5000,**cursor);rows.extend(page['events']);pages+=1\n  if pages==1:schedules=page.get('r1_schedules',[])\n  if not page['next_cursor']:break\n  cursor=page['next_cursor']\n print(json.dumps({'events':rows,'schedules':schedules,'source':source,'pages':pages,'queryMs':(time.perf_counter()-start)*1000}))\nfinally:store.close()`
 const data=JSON.parse(execFileSync(path.join(repo,'bridge/.venv/Scripts/python.exe'),['-c',py,JSON.stringify(allR1SeriesIds),String(captureAt)],{cwd:repo,encoding:'utf8',maxBuffer:192*1024*1024}))
 const schedules=data.schedules.flatMap(s=>{const family=allR1Families.find(f=>r1Profiles[f].components.some(c=>c.seriesId===s.seriesId));return family?[{...s,family}]:[]})
 const input={events:data.events,usdSettings:r1DefaultSettings,eurSettings:eurR1DefaultSettings,savedBands:{},schedules,end:captureAt}
 let start=performance.now();const timeline=calculateR1Timeline(input),pureMs=performance.now()-start
 const releases=createR1History(data.events).releases,primary={USD:releases.find(r=>r.currency==='USD'),EUR:releases.find(r=>r.currency==='EUR')}
 const samples=[Date.UTC(2026,2,19,12,30),Date.UTC(2026,8,11,12,30),captureAt,...Array.from({length:9},(_,i)=>timeline.points[Math.floor((timeline.points.length-1)*(i+1)/10)].at)]
 for(const at of samples)for(const currency of ['USD','EUR']){
  const overall=calculateR1({release:primary[currency],events:data.events,settings:currency==='USD'?input.usdSettings:input.eurSettings,savedBands:{},schedules,asOf:at}).overall
  const point=r1TimelineAt(timeline,at)[currency]
  for(const key of ['net','supportive','negative','interval','direction','strength','coverage'])assert.deepEqual(point[key],overall[key],`${currency} parity at ${new Date(at).toISOString()} ${key}`)
 }
 const asset=fs.readdirSync(path.join(root,'dist/assets')).find(n=>/^timeline\.worker-.*\.js$/.test(n));assert.ok(asset,'Build before replay')
 const shim=`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:v=>parentPort.postMessage(v)};await import(${JSON.stringify(pathToFileURL(path.join(root,'dist/assets',asset)).href)});parentPort.on('message',data=>self.onmessage({data}));`
 const worker=new Worker(new URL(`data:text/javascript,${encodeURIComponent(shim)}`),{type:'module'})
 const run=(id,input)=>new Promise((resolve,reject)=>{const start=performance.now();worker.once('message',reply=>reply.error?reject(new Error(reply.error)):resolve({result:reply.result,ms:performance.now()-start}));worker.once('error',reject);worker.postMessage({id,input})})
 let cold,warm
 try{cold=await run(1,input);warm=await run(2,input);assert.deepEqual(cold.result,timeline);assert.deepEqual(warm.result,timeline)}finally{await worker.terminate()}
 const march=r1TimelineAt(timeline,Date.UTC(2026,2,19,12,30)),update=march.USD.update
 const report=`# R1 Raycaster audit — 10 October 2026

Raycaster adds R1 Scoring System. Context, Context-detailed and Selected combo remain available as Retired; Roofs/Candy retain their own engines. The terminal initially opens the R1 view. No scoring weights or magnitude policies changed.

R1 shows separate EUR/USD combined evidence, before/after points and a signed color-coded change. Publication rows use configured icons and display-clock dates without timezone suffixes. Simultaneous publications share one combined delta. Each candle lists its updates; candles without a publication retain the latest dated update. Corrections, schedule changes and expiry are identified separately. Inspector filters do not select R1 inputs.

Verified: all 72 frontend suites, clean lint and production build (existing bundle-size warning).

A background worker builds change-clock snapshots from the shared Inspector snapshot reader. It caches family selection and assessments within publication/observation epochs, including earlier-quarter revisions that change a current comparison. Period metadata is scanned once per relevant captured version; unchanged freshness slots and nominal aggregates are reused. Hover performs a binary lookup, never scoring or history loading. Sensitivity sweeps remain in Inspector's audit and are omitted from this nominal timeline; the displayed direction, strength and missing-evidence interval use the same base formula.

Read-only ${data.source} replay through ${new Date(captureAt).toISOString()}: ${data.events.length} rows, ${data.pages} storage pages, ${schedules.length} known schedules, ${timeline.points.length} timeline clocks. ${samples.length*2} USD/EUR Inspector comparisons pass, including March Claims and September CPI. Cold and warm built-worker output exactly match the pure timeline.

March 19 Claims: USD ${update?.before} → ${march.USD.net}; change ${update?.change}. The point is combined currency evidence, not the standalone Claims vote.

Informational terminal timings: query ${Math.round(data.queryMs)} ms; pure timeline ${Math.round(pureMs)} ms; built worker cold ${Math.round(cold.ms)} ms, warm ${Math.round(warm.ms)} ms. Initial history preparation is still needed. These samples do not measure browser hover latency.

Regression coverage: simultaneous same-currency publications, different-time publications on one candle, correction clocks, prior-quarter revisions, schedule-known-at admission, expiry, future exclusion, retained update dates, 200 cached snapshots perform zero period, assessment, freshness or combination work; 100 hovers coalesced into one frame, zero hover/display-clock jobs or requests, unchanged-poll identity, actual source correction and settings invalidation, hidden worker/poll/RAF cleanup. Assembled terminal remains included in the frontend suite. Visual verification remains with the user.
`
 fs.writeFileSync(path.join(repo,'reports/R1-Raycaster-audit.md'),report)
 console.log(`PASS: ${timeline.points.length} clocks; ${samples.length*2} Inspector comparisons; built timeline worker cold ${Math.round(cold.ms)} ms / warm ${Math.round(warm.ms)} ms; ${data.events.length} stored rows`)
}finally{await server.close()}
