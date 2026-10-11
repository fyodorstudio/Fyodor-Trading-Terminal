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
 const {r1DisplayParts,r1EvidenceComparison}=await server.ssrLoadModule('./src/raycaster/core/r1-evidence-presentation.ts')
 const {calculateR1}=await server.ssrLoadModule('./src/scoring-system/r1/analysis.ts')
 const {createR1History}=await server.ssrLoadModule('./src/scoring-system/r1/features.ts')
 const py=`import json,sys,time\nfrom pathlib import Path\nfrom storage.calendar_store import CalendarStore,HISTORY_START\nstore=CalendarStore(Path('storage/data/calendar.sqlite3'),readonly=True)\ntry:\n source=store.db.execute('SELECT source_id,count(*) n FROM events GROUP BY source_id ORDER BY n DESC').fetchone()[0]\n ids=json.loads(sys.argv[1]);at=int(sys.argv[2]);rows=[];schedules=[];cursor={};pages=0;start=time.perf_counter()\n while True:\n  page=store.query(source,HISTORY_START,at//1000+172800,event_ids=ids,time_basis='chart',r1_as_of=at,limit=5000,**cursor);rows.extend(page['events']);pages+=1\n  if pages==1:schedules=page.get('r1_schedules',[])\n  if not page['next_cursor']:break\n  cursor=page['next_cursor']\n print(json.dumps({'events':rows,'schedules':schedules,'source':source,'pages':pages,'queryMs':(time.perf_counter()-start)*1000}))\nfinally:store.close()`
 const data=JSON.parse(execFileSync(path.join(repo,'bridge/.venv/Scripts/python.exe'),['-c',py,JSON.stringify(allR1SeriesIds),String(captureAt)],{cwd:repo,encoding:'utf8',maxBuffer:192*1024*1024}))
 const schedules=data.schedules.flatMap(s=>{const family=allR1Families.find(f=>r1Profiles[f].components.some(c=>c.seriesId===s.seriesId));return family?[{...s,family}]:[]})
 const input={events:data.events,usdSettings:r1DefaultSettings,eurSettings:eurR1DefaultSettings,savedBands:{},schedules,end:captureAt}
 let start=performance.now();const timeline=calculateR1Timeline(input),pureMs=performance.now()-start
 for(const point of timeline.points)for(const currency of ['USD','EUR']){
  const update=point[currency].update
  if(update?.at!==point.at)continue
  assert.ok(Math.abs(update.parts.reduce((sum,p)=>sum+p.change,0)-update.change)<1e-8)
  assert.equal(r1DisplayParts(update).reduce((sum,p)=>sum+Math.round(p.change*100),0),Math.round(update.change*100))
 }
 const september=r1TimelineAt(timeline,Date.UTC(2026,8,30,14,59))
 const comparison=r1EvidenceComparison(september.EUR,september.USD)
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
 const reportPath=path.join(repo,'reports/R1-Raycaster-audit.md')
 const baseline=fs.readFileSync(reportPath,'utf8').split('\n## Raycaster presentation refinement')[0].trimEnd()
 const report=`${baseline}

## Raycaster presentation refinement — 10 October 2026

Summary slots keep score pairs on one line and retain EUR-first update order.
Each update shows changes in combined points by family plus a total. Changes to
nonpublishing families appear as a relationship adjustment. Display cents add up
to the total without changing raw scoring. The direct currency point gap retains
missing-evidence uncertainty.

Read-only ${data.source} replay: ${data.events.length} rows, ${timeline.points.length}
clocks, ${samples.length*2} Inspector comparisons; pure and built-worker outputs match.
Every update conserves raw family changes and reconciled display cents.

September 30 at 21:59 Jakarta: ${JSON.stringify(september.USD.update?.parts)};
combined change ${september.USD.update?.change}; USD−EUR gap ${comparison.gap}.

Informational terminal timings: query ${Math.round(data.queryMs)} ms, pure timeline
${Math.round(pureMs)} ms, built worker cold ${Math.round(cold.ms)} ms / warm ${Math.round(warm.ms)} ms.
These do not measure browser hover latency.

Regression additions cover contribution conservation, CPI-to-PCE replacement,
comparison gaps and unavailable evidence, fixed mounted summary slots and currency
order. Hover still starts zero scoring work or requests. All 72 frontend suites,
lint and build pass; the existing bundle-size warning remains. Visual review is
left to the user.
`
 fs.writeFileSync(reportPath,report)
 console.log(`PASS: ${timeline.points.length} clocks; ${samples.length*2} Inspector comparisons; built timeline worker cold ${Math.round(cold.ms)} ms / warm ${Math.round(warm.ms)} ms; ${data.events.length} stored rows`)
}finally{await server.close()}
