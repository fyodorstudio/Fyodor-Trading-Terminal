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

 const started=performance.now(),timeline=calculateR1Timeline(input),pureMs=performance.now()-started;
 const releases=createR1History(data.events).releases,byId=new Map(releases.map(r=>[r.id,r]));let checks=0;
 for(const point of timeline.points)for(const currency of ['EUR','USD']){
  const update=point[currency].update;if(update?.at!==point.at)continue;
  assert.ok(Math.abs(update.parts.reduce((n,p)=>n+p.change,0)-update.change)<1e-8);
  for(const score of update.standalone){
   assert.ok(Math.abs(score.net)<=100);if(point.at<Date.UTC(2026,0,1))continue;
   const a=calculateR1({release:byId.get(score.releaseId),events:data.events,settings:currency==='EUR'?input.eurSettings:input.usdSettings,savedBands:{},schedules});
   const standalone=a.assessments?.find(a=>a.family===score.family)??a.assessment;
   assert.equal(score.net,standalone.net);assert.equal(score.direction,standalone.direction);checks++;
  }
 }
 const dates=[Date.UTC(2026,8,23,8),Date.UTC(2026,9,1,8),Date.UTC(2026,9,5,8)];
 const missing=dates.map(at=>{
  const r=releases.find(r=>r.familyId==='euro-pmi'&&r.releaseAt===at);
  const a=calculateR1({release:r,events:data.events,settings:eurR1DefaultSettings,savedBands:{},schedules}).assessment;
  assert.equal(a.explanation,'MT5 Actual is unavailable.');
  return {date:new Date(at).toISOString(),family:a.family,previous:a.readings[0].previous,samples:a.readings[0].samples,direction:a.direction,actual:a.readings[0].actual,reason:a.explanation};
 });
 const august=r1TimelineAt(timeline,Date.UTC(2026,7,19,9)),inflation=august.EUR.update.standalone.find(a=>a.family==='euro-inflation');
 assert.equal(inflation.net,12.5);
 const asset=fs.readdirSync(path.join(root,'dist/assets')).find(n=>/^timeline\.worker-.*\.js$/.test(n));assert.ok(asset,'Build before replay');
 const shim=`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:v=>parentPort.postMessage(v)};await import(${JSON.stringify(pathToFileURL(path.join(root,'dist/assets',asset)).href)});parentPort.on('message',data=>self.onmessage({data}));`;
 const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(shim)),{type:'module'}),began=performance.now();
 try{
  const result=await new Promise((resolve,reject)=>{worker.once('message',reply=>reply.error?reject(new Error(reply.error)):resolve(reply.result));worker.once('error',reject);worker.postMessage({id:1,input})});
  assert.deepEqual(result,timeline);
 }finally{await worker.terminate()}
 const workerMs=Math.round(performance.now()-began);
 const report=`# R1 standardized standalone points and PMI — 11 October 2026

All R1 standalone presentation uses normalized ±100 points. Combined arithmetic,
weights and boundaries are preserved. Raycaster publication summaries use the
shared assessor; quarterly revision scores remain distinct from retained momentum.
Only the background timeline builds these summaries. Cursor lookup does no scoring.

Read-only stored replay: ${data.source}, ${data.events.length} rows,
${timeline.points.length} clocks. Every timeline standalone is bounded at ±100;
${checks} assessments from 2026 match Inspector net/direction, including sector
and national PMI assessments and quarterly revisions. Combined change parts
conserve the total. The built production timeline worker matches the pure output.
Informational timings: pure ${Math.round(pureMs)} ms, worker ${workerMs} ms;
these do not measure browser responsiveness.

August 19 Euro-area inflation: standalone +12.50, combined
${august.EUR.update.before} → ${august.EUR.net}, overall change
${august.EUR.update.change}. This separates a supportive new release from
replacement of a stronger existing contribution; it does not resolve the earlier
stored-value discrepancy or explain the exchange-rate rally.

## PMI diagnosis

The named dates lack MT5 Actual and its raw field. The app now identifies that
specific reason and retains independently dated prior-month values/calibration.
It does not substitute official values, forecasts, or old monthly Actual.

${missing.map(r=>`- ${r.date}: ${r.family}; previous ${r.previous}; ${r.samples} prior comparisons; ${r.reason}`).join('\n')}

PMI state at 50 is explained separately from A−P direction. Same-month flash
metadata no longer invalidates a comparison retrieved independently from dated
prior-month history. Composite/sector/national overlap rules remain unchanged.

Primary-source rationale is in the [canonical design](../docs/scoring%20system%20overhaul.md#standalone-point-standardization-and-pmi--11-october-2026).
Reproduce with: pnpm --dir frontend exec node scripts/audit-r1-standardized-pmi.mjs.
Visual review and comparison against price remain with the user.
`;
 fs.writeFileSync(path.join(repo,'reports/R1-standardized-points-PMI-audit.md'),report);
 console.log(JSON.stringify({source:data.source,rows:data.events.length,clocks:timeline.points.length,checks,pureMs:Math.round(pureMs),workerMs,missing,august:{standalone:inflation.net,before:august.EUR.update.before,after:august.EUR.net,overallChange:august.EUR.update.change}}));
}finally{await server.close()}
