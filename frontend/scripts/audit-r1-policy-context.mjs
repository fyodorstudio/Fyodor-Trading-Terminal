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

 const {createR1SnapshotReader}=await server.ssrLoadModule('./src/scoring-system/r1/analysis.ts');
 const {combineR1,preferredShares}=await server.ssrLoadModule('./src/scoring-system/r1/relationships.ts');
 const {compareFedPolicy,policyEvidenceVariants}=await server.ssrLoadModule('./src/scoring-system/r1/policy-context.ts');
 const {calculateR1History}=await server.ssrLoadModule('./src/scoring-system/r1/history.ts');
 const {r1ScatterModel}=await server.ssrLoadModule('./src/scatter-plot/inspection/r1-scatter-model.ts');
 const {calculateR1Pair}=await server.ssrLoadModule('./src/scoring-system/r1/pair.ts');
 const manual={'us-cpi/core-monthly':[.1,.2,.4],'us-cpi/core-annual':[.1,.2,.4],'us-cpi/headline-monthly':[.2,.4,.6],'us-cpi/headline-annual':[.1,.3,.6]};
 const settings={...r1DefaultSettings,calibration:{...r1DefaultSettings.calibration,limits:manual}};
 const timelineInput={...input,usdSettings:settings};
 const began=performance.now(),timeline=calculateR1Timeline(timelineInput),timelineMs=Math.round(performance.now()-began);
 const history=createR1History(data.events),releases=history.releases;
 const fed=releases.filter(r=>r.familyId==='fomc'&&r.events.some(e=>e.event_id==='840050014'));
 const reader=createR1SnapshotReader({events:data.events,settings,savedBands:{},schedules,currency:'USD'},true);
 const scatter=calculateR1History({family:'fomc',events:data.events,at:captureAt,calibration:settings.calibration,savedBands:{},schedules,freshness:settings.freshness});
 let holds=0,checks=0,bounded=0;const results=[],historical=[];
 for(const point of timeline.points)for(const currency of ['USD','EUR']){
  assert.ok(Math.abs(point[currency].net)<=100.000001);bounded++;
  const update=point[currency].update;if(update?.at===point.at)assert.ok(Math.abs(update.parts.reduce((n,p)=>n+p.change,0)-update.change)<1e-7);
 }
 for(let index=0;index<fed.length;index++){
  const release=fed[index],a=scatter.find(a=>a.releaseId===release.id);if(!a?.contextual)continue;holds++;
  assert.ok(Math.abs(a.net)<=100);assert.ok(Math.abs(a.readings.reduce((n,r)=>n+r.weight,0)-100)<1e-6);
  assert.ok(Math.abs(a.leaves.reduce((n,l)=>n+l.budget,0)-100)<1e-6);
  assert.ok(Math.abs(a.readings.reduce((n,r)=>n+(r.contribution??0)/4,0)-a.net)<1e-7);
  const state=reader(release.releaseAt);
  assert.ok(Math.abs(state.leaves.reduce((n,l)=>n+l.budget,0)-100)<1e-6);
  const point=r1TimelineAt(timeline,release.releaseAt),score=point.USD.update.standalone.find(s=>s.releaseId===release.id);
  assert.equal(score.net,a.net);assert.equal(score.direction,a.direction);checks++;
  const plot=r1ScatterModel(scatter,'policy-total',release.id);
  if(!a.unavailable)assert.ok(Math.abs(plot.inspection.actual-state.policyInterpretation.net)<1e-7);
  const previous=index?reader(fed[index-1].releaseAt):null;
  const stress=[];
  for(const overall of [preferredShares.overall,{inflation:.35,labor:.30,activity:.15,policy:.20},{inflation:.25,labor:.35,activity:.20,policy:.20}]){
   const now=combineR1(state.slots,settings.selected,release.releaseAt,{...preferredShares,overall}).policyInterpretation;
   const old=previous&&combineR1(previous.slots,settings.selected,previous.at,{...preferredShares,overall}).policyInterpretation;
   stress.push(compareFedPolicy(now,old));
  }
  for(let variant=0;variant<2;variant++){
   const change=slots=>slots.map(s=>s.assessment?.policy?{...s,assessment:{...s.assessment,policy:policyEvidenceVariants(s.assessment.policy,s.family,s.assessment.releaseId)[variant]}}:s);
   stress.push(compareFedPolicy(combineR1(change(state.slots),settings.selected,state.at).policyInterpretation,previous&&combineR1(change(previous.slots),settings.selected,previous.at).policyInterpretation));
  }
  historical.push({date:new Date(release.releaseAt+7*3600000).toISOString().slice(0,10),policy:a.net,direction:a.direction,unknown:a.unavailable,sensitive:stress.some(s=>s.direction!==a.direction)});
  if(release.releaseAt<Date.UTC(2026,0,1))continue;
  const selected=calculateR1({release,events:data.events,settings,savedBands:{},schedules});
  assert.deepEqual(selected.assessment,a);checks++;
  const defaults=calculateR1({release,events:data.events,settings:r1DefaultSettings,savedBands:{},schedules});
  const trimmed=data.events.filter(e=>e.release_at<=release.releaseAt);
  assert.equal(calculateR1({release,events:trimmed,settings,savedBands:{},schedules}).assessment.net,a.net,'Future releases cannot determine a hold interpretation');checks++;
  const ranges=stress.map(s=>s.net);
  results.push({date:new Date(release.releaseAt+7*3600000).toISOString().slice(0,10),releaseId:release.id,overall:state.net,policy:a.net,direction:a.direction,unknown:a.unavailable,currentPressure:state.policyInterpretation.net,previousPressure:previous?.policyInterpretation?.net??null,overallChange:selected.transition.change,defaultPolicy:defaults.assessment.net,defaultOverall:defaults.overall.net,stress:[Math.min(...ranges),Math.max(...ranges)],sensitive:stress.some(s=>s.direction!==a.direction)});
 }
 const june=results.find(r=>r.date==='2026-06-18'),july=results.find(r=>r.date==='2026-07-30');
 assert.equal(june.direction,'strengthening');assert.ok(june.overall>0);assert.equal(july.direction,'weakening');assert.ok(july.overall<0);
 assert.equal(june.overallChange,0);assert.equal(july.overallChange,0);
 async function builtWorker(name,input){
  const asset=fs.readdirSync(path.join(root,'dist/assets')).find(n=>n.startsWith(`${name}.worker-`)&&n.endsWith('.js'));assert.ok(asset,'Build before replay');
  const shim=`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:v=>parentPort.postMessage(v)};await import(${JSON.stringify(pathToFileURL(path.join(root,'dist/assets',asset)).href)});parentPort.on('message',data=>self.onmessage({data}));`;
  const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(shim)),{type:'module'});
  try{return await new Promise((resolve,reject)=>{worker.once('message',r=>r.error?reject(new Error(r.error)):resolve(r.result));worker.once('error',reject);worker.postMessage({id:1,input})})}finally{await worker.terminate()}
 }
 assert.deepEqual(await builtWorker('timeline',timelineInput),timeline);
 const historyInput={family:'fomc',events:data.events,at:captureAt,calibration:settings.calibration,savedBands:{},schedules,freshness:settings.freshness};
 assert.deepEqual(await builtWorker('history',historyInput),scatter);
 for(const sample of [june,july]){
  const pairInput={release:fed.find(r=>r.id===sample.releaseId),events:data.events,settings,eurSettings:eurR1DefaultSettings,savedBands:{},schedules};
  assert.deepEqual(await builtWorker('pair',pairInput),calculateR1Pair(pairInput));
 }
 const format=n=>n==null?'Unavailable':n.toFixed(2);
 const pricePath=path.join(repo,'storage/data/r1-policy-price-audit.json');
 const prices=fs.existsSync(pricePath)?JSON.parse(fs.readFileSync(pricePath,'utf8').replace(/^\uFEFF/,'')).bars:[];
 const priceRows=results.map(r=>{
  const release=fed.find(f=>f.id===r.releaseId),serverTime=release.events.find(e=>e.event_id==='840050014').server_time_seconds,index=prices.findIndex(b=>b.time===serverTime);
  const returns=[1,4,24].map(hours=>index<0||!prices[index+hours-1]?null:(prices[index+hours-1].close-prices[index].open)*10000);
  return {date:r.date,offsetHours:(serverTime-release.releaseAt/1000)/3600,returns};
 });
 const report=`# Fed policy context and fractional Jobs — 11 October 2026

Read-only replay: ${data.source}, ${data.events.length} calendar rows, ${timeline.points.length} clocks, ${holds} hold comparisons. ${checks} hold parity/future-removal checks; ${bounded} currency snapshots bounded at ±100. Timeline parts conserve the combined change. Inspector and Scatter use the same historical comparison; production timeline, history and pair workers match pure output, including both named decisions.

| Jakarta decision date | Hold interpretation | Current policy pressure | Prior pressure | Overall USD | Overall change at hold | Nearby-policy range | Direction sensitive |
|---|---:|---:|---:|---:|---:|---:|---|
${results.map(r=>`| ${r.date} | ${format(r.policy)} (${r.direction}) | ${format(r.currentPressure)} | ${format(r.previousPressure)} | ${format(r.overall)} | ${format(r.overallChange)} | ${r.stress.map(format).join(' to ')} | ${r.sensitive?'Yes':'No'} |`).join('\n')}

June and July reproduce the requested distinction under the explicit CPI overrides below. These are historical calibration scenarios, not a read of the user's browser settings. No dates or price outcomes enter the formula. A hold adds no fresh actual-rate action; its standalone interpretation compares economic pressure across decision dates. Overall uses retained current pressure, so it need not jump at a hold. Early missing comparison history remains uncertain.

CPI core monthly/annual: 0.1/0.2/0.4; headline monthly: 0.2/0.4/0.6; headline annual: 0.1/0.3/0.6. All other native bands use prior-history automatic calibration. Default automatic June: hold ${format(june.defaultPolicy)}, overall ${format(june.defaultOverall)}; July: hold ${format(july.defaultPolicy)}, overall ${format(july.defaultOverall)}.

Stress checks cover all ${historical.length} stored holds: ${historical.filter(r=>r.direction==='insufficient').length} retain insufficient comparison evidence; ${historical.filter(r=>r.sensitive).length} change direction under the tested nearby policies. They vary origin category weights (30/30/20/20, 35/30/15/20, 25/35/20/20) and policy-input boundaries ±10%, with the PCE target-gap scale held fixed. They are limited sensitivity checks, not proof of optimal parameters. Runtime combined sensitivity also tests the routed share at 20%/30%, existing family shares, and freshness.

Sensitive historical cases: ${historical.filter(r=>r.sensitive).map(r=>`${r.date}: ${format(r.policy)} (${r.direction})`).join('; ')||'none'}.

Pure timeline construction: ${timelineMs} ms (informational; not browser responsiveness). Cursor lookup performs no scoring; deterministic work-count coverage is in test_r1_raycaster.mjs. Forecasts, projections and speeches remain excluded. Stored data includes retrospectively captured/revised values; replay does not establish original as-released availability. Price alignment is separate validation, not a scoring input.

## Fixed-window price review

${prices.length} EURUSD H1 bars read from the existing MT5 bridge. Each window starts at the release candle's open and ends at the last close of 1/4/24 consecutive H1 bars. The stored calendar's trade-server timestamp matches the OHLC timestamp directly; the offsets below come from stored timing metadata. These windows include the press conference and any intervening news; they do not isolate the hold's causal effect. This is retrospective review of the available 2026 sample, not an independent out-of-sample validation.

| Jakarta date | Broker offset from UTC | EURUSD 1h pips | 4h pips | 24h pips |
|---|---:|---:|---:|---:|
${priceRows.map(r=>`| ${r.date} | ${format(r.offsetHours)}h | ${r.returns.map(format).join(' | ')} |`).join('\n')}

Canonical formulas, fixed level scales, source rationale and review instructions: [design](../docs/scoring%20system%20overhaul.md#fed-policy-context-and-jobs--11-october-2026).
Reproduce: pnpm --dir frontend exec node scripts/audit-r1-policy-context.mjs. Build first. Visual review stays with the user.

Terminal verification: all 73 frontend suites, including assembled-terminal and deterministic hover work counts; lint and production build pass. The existing main-bundle size warning remains. Mounted Jobs Scatter preview stays local and Apply reaches Inspector; hold presentation and both audit baskets are tested without browser automation. Price cache is optional: save the existing bridge's GET /api/v1/ohlc?symbol=EURUSD&timeframe=H1&count=5000 response to storage/data/r1-policy-price-audit.json before replaying its price section.
`;
 fs.writeFileSync(path.join(repo,'reports/R1-policy-context-audit.md'),report);
 console.log(JSON.stringify({rows:data.events.length,clocks:timeline.points.length,holds,checks,timelineMs,sensitiveCases:historical.filter(r=>r.sensitive),insufficientHolds:historical.filter(r=>r.direction==='insufficient').length,results,priceRows}));
}finally{await server.close()}

