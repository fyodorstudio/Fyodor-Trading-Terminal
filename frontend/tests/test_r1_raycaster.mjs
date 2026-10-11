import assert from 'node:assert/strict'
import React from 'react'
import {createServer} from 'vite'
import {Window} from 'happy-dom'
const work={periods:0,assessments:0,freshness:0,combinations:0}
const server=await createServer({server:{middlewareMode:true,hmr:false},plugins:[{name:'r1-selection-work',transform(code,id){
 if(id.endsWith('/r1/analysis.ts'))return code.replace('const declared=Math.max(', 'globalThis.__r1Work.periods++;const declared=Math.max(')
 if(id.endsWith('/r1/freshness.ts'))return code.replace('  const fallbackDays=', '  globalThis.__r1Work.freshness++;const fallbackDays=')
 if(id.endsWith('/r1/relationships.ts'))return code.replace('  const chosen=', '  globalThis.__r1Work.combinations++;const chosen=')
 if(id.endsWith('/r1/assessment.ts'))return code.replace('  const current=r1Features(', '  globalThis.__r1Work.assessments++;const current=r1Features(')
}}]})
const dom=new Window({url:'http://localhost:5173'})
const globals={window:dom,document:dom.document,HTMLElement:dom.HTMLElement,Node:dom.Node,navigator:dom.navigator,localStorage:dom.localStorage,ResizeObserver:dom.ResizeObserver,IS_REACT_ACT_ENVIRONMENT:true}
const previous=new Map([...Object.keys(globals),'Worker','fetch','__r1Work'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v})
globalThis.__r1Work=work
let root
try {
 const {calculateR1Timeline,r1TimelineAt,r1CandleUpdates}=await server.ssrLoadModule('./src/scoring-system/r1/timeline.ts')
 const {r1DisplayParts,r1EvidenceComparison,r1EvidencePoints,r1TankGeometry,r1UpdateRows}=await server.ssrLoadModule('./src/raycaster/core/r1-evidence-presentation.ts')
 const {createR1SnapshotReader}=await server.ssrLoadModule('./src/scoring-system/r1/analysis.ts')
 const {calculateR1Pair}=await server.ssrLoadModule('./src/scoring-system/r1/pair.ts')
 const {groupInspectorReleases}=await server.ssrLoadModule('./src/inspector/inspector-data.ts')
 const {r1Profiles,allR1SeriesIds}=await server.ssrLoadModule('./src/scoring-system/r1/profiles.ts')
 const {saveR1Settings}=await server.ssrLoadModule('./src/scoring-system/r1/settings.ts')
 const {saveSequencePreferences,readSequencePreferences}=await server.ssrLoadModule('./src/usd-context/sequences/storage/sequence-preferences.ts')
 const at=Date.UTC(2026,2,19,12,30),day=86400000,jan=Date.UTC(2026,0,1)/1000,feb=Date.UTC(2026,1,1)/1000
 let id=0
 const row=(series,actual,prior,time=at,period=feb,extra={})=>({value_id:String(++id),event_id:series,release_at:time,chart_time_seconds:time/1000,server_time_seconds:time/1000,period_seconds:period,revision:0,currency:'USD',country_code:'US',country_name:'US',name:'Test',event_code:'',importance:'high',unit:1,multiplier:0,digits:1,time_mode:0,impact:'none',actual,previous:prior,forecast:999,revised_previous:null,availability:'observed',...extra})
 const usdSettings={version:1,selected:['claims','ppi','fomc','gdp'],calibration:{mode:'undefined',limits:Object.fromEntries(['claims','ppi','gdp'].flatMap(f=>r1Profiles[f].components.map(c=>[`${f}/${c.id}`,f==='claims'?[10,20,40]:[.1,.2,.4]])))}}
 const eurSettings={version:1,selected:['euro-inflation'],calibration:{mode:'undefined',limits:{'euro-inflation/core-annual':[.1,.2,.4],'euro-inflation/headline-annual':[.1,.2,.4]}}}
 const oldEuro=['999030012','999030013'].map(s=>row(s,2.5,999,at-28*day,jan,{currency:'EUR',country_code:'EU'}))
 const euro=['999030012','999030013'].map(s=>row(s,2.6,999,at+20*60000,feb,{currency:'EUR',country_code:'EU'}))
 const ppi=r1Profiles.ppi.components.map(c=>row(c.seriesId,1.1,1,at-day,jan))
 const claims=r1Profiles.claims.components.map(c=>row(c.seriesId,c.id==='initial'?200:2,c.id==='initial'?210:2.01,at,(at-7*day)/1000,{unit:c.units[0],multiplier:c.multiplier}))
 const concurrentPpi=ppi.map(r=>({...r,value_id:String(++id),actual:1.2,release_at:at,chart_time_seconds:at/1000,period_seconds:feb}))
 // This publication shares a candle with, but follows, the simultaneous USD batch.
 const events=[...oldEuro,...euro,...ppi,...concurrentPpi,...claims,row('840050014',3.75,3.75,at-11.5*3600000,0)]
 const original=claims[0],corrected={...original,actual:220,revision:1}
 events[events.indexOf(original)]={...corrected,r1_vintages:JSON.stringify([{knownAt:at,event:original,source:'test'},{knownAt:at+day,event:corrected,source:'test'}])}
 // An older-quarter revision after the newest-quarter publication must still
 // refresh the current GDP comparison; the selected release id is unchanged.
 const q0=Date.UTC(2025,6,1)/1000,q1=Date.UTC(2025,9,1)/1000
 events.push(row('840010007',2,1,at-10*day,q0),row('840010007',3,2,at-5*day,q1),row('840010007',4,2,at+2*day,q0))
 const schedules=[{family:'claims',dueAt:at+7*day,knownAt:at+day/2,source:'test'}]
 const input={events,usdSettings,eurSettings,savedBands:{},schedules,end:at+50*day}
 const reader=createR1SnapshotReader({...input,currency:'USD',settings:usdSettings},true)
 for(const key of Object.keys(work))work[key]=0;reader(at)
 assert.ok(work.periods<=events.length,'Each historical period is evaluated once, not repeatedly inside sort comparators')
 const counts={...work}
 for(let i=1;i<=200;i++)reader(at+i)
 assert.deepEqual(work,counts,'Repeated snapshots within an unchanged source epoch do zero period scans, assessments, freshness scans or combinations')
 const timeline=calculateR1Timeline(input),release=groupInspectorReleases(events).find(r=>r.familyId==='claims')
 for(const clock of [at-1,at,at+20*60000,at+day,at+2*day,at+8*day,at+8*day+1,at+45*day+1]) {
   const expected=calculateR1Pair({release,events,settings:usdSettings,eurSettings,savedBands:{},schedules,asOf:clock})
   const point=r1TimelineAt(timeline,clock)
   for(const[currency,a]of [['USD',expected.overall],['EUR',expected.otherCurrency.overall]])for(const key of ['net','supportive','negative','unavailable','direction','strength','interval'])assert.deepEqual(point[currency][key],a[key],`${currency} Inspector parity at ${clock}: ${key}`)
 }
 assert.equal(r1TimelineAt(timeline,at).USD.update.releases.length,2,'Simultaneous releases share one combined delta')
 for(const point of timeline.points)for(const currency of ['EUR','USD']){
   const update=point[currency].update
   if(update?.at!==point.at)continue
   assert.ok(Math.abs(update.parts.reduce((sum,p)=>sum+p.change,0)-update.change)<1e-8,'Family contributions conserve raw combined change')
   assert.equal(r1DisplayParts(update).reduce((sum,p)=>sum+Math.round(p.change*100),0),Math.round(update.change*100),'Displayed family contributions add up to displayed total')
 }
 const simultaneous=r1TimelineAt(timeline,at).USD.update
 for(const standalone of simultaneous.standalone){
   const publication=groupInspectorReleases(events).find(r=>r.id===standalone.releaseId)
   const a=calculateR1Pair({release:publication,events,settings:usdSettings,eurSettings,savedBands:{},schedules}).assessment
   assert.equal(standalone.net,a.net);assert.equal(standalone.direction,a.direction)
 }
 const revisionUpdate=r1TimelineAt(timeline,at+2*day).USD.update
 const revisionRelease=groupInspectorReleases(events).find(r=>r.releaseAt===at+2*day)
 assert.equal(revisionUpdate.standalone[0].net,calculateR1Pair({release:revisionRelease,events,settings:usdSettings,eurSettings,savedBands:{},schedules}).assessment.net,'Quarterly standalone revision is distinct from relationship momentum')
 assert.deepEqual(new Set(simultaneous.parts.filter(p=>p.family).map(p=>p.family)),new Set(['claims','ppi']))
 assert.equal(simultaneous.parts.find(p=>p.family==='claims').label,'Jobless claims')
 // New PCE evidence replaces the CPI anchor; the removed CPI vote is an
 // explicit relationship adjustment, not assigned to PCE as an extra vote.
 const inflationEvents=['us-cpi','pce'].flatMap((family,i)=>r1Profiles[family].components.flatMap(c=>[row(c.seriesId,2,2,at-28*day+i*day,jan),row(c.seriesId,i?2:2.2,2,at+i*day,feb)]))
 const inflationSettings={version:1,selected:['us-cpi','pce'],calibration:{mode:'undefined',limits:Object.fromEntries(['us-cpi','pce'].flatMap(f=>r1Profiles[f].components.map(c=>[`${f}/${c.id}`,[.1,.2,.4]])))}}
 const inflation=calculateR1Timeline({...input,events:inflationEvents,usdSettings:inflationSettings,schedules:[],end:at+day})
 const replaced=r1TimelineAt(inflation,at+day).USD.update
 assert.ok(replaced.parts.some(p=>p.label==='Relationship adjustment'&&p.change<0))
 assert.equal(replaced.parts.find(p=>p.family==='pce').change,0,'PCE is unchanged; removing CPI explains the aggregate change')
 const comparisonState=(net,interval=[net,net],direction=net>0?'strengthening':net<0?'weakening':'balanced')=>({net,interval,direction})
 assert.equal(r1EvidenceComparison(comparisonState(8.76),comparisonState(23.81)).gap,15.05)
 assert.equal(r1EvidenceComparison(comparisonState(-20),comparisonState(-10)).leader,'USD')
 assert.equal(r1EvidenceComparison(comparisonState(20),comparisonState(10)).leader,'EUR')
 assert.equal(r1EvidenceComparison(comparisonState(10),comparisonState(10)).leader,null)
 assert.equal(r1EvidenceComparison(comparisonState(8.76,[-1,18],'insufficient'),comparisonState(23.81,[20,30])).uncertain,false)
 assert.equal(r1EvidenceComparison(comparisonState(8.76,[-30,50],'insufficient'),comparisonState(23.81)).uncertain,true)
 assert.equal(r1EvidenceComparison(comparisonState(0,[-100,100],'empty'),comparisonState(23.81)).unavailable,true)
 for(const [net,before,top,height,previousTop] of [[20,40,40,10,30],[-20,-40,50,10,70],[20,-20,40,10,60],[-20,20,50,10,40],[0,0,50,0,50],[100,100,0,50,0],[-100,-100,50,50,100]]){
   const shape=r1TankGeometry({net,interval:[net-12,net+12],update:{before}})
   assert.equal(shape.fillTop,top);assert.equal(shape.fillHeight,height);assert.equal(shape.previousTop,previousTop)
   assert.ok(shape.rangeTop>=0&&shape.rangeTop+shape.rangeHeight<=100,'Uncertainty hatching remains inside the fixed ±100 scale')
 }
 assert.equal(r1TankGeometry({net:4.68,interval:[-7.32,16.68],update:null}).rangeHeight,12,'Missing PMI keeps its uncertainty rather than becoming water/zero evidence')
 for(const update of [simultaneous,replaced,revisionUpdate])assert.equal(r1UpdateRows(update).reduce((s,r)=>s+Math.round((r.change??0)*100),0),Math.round(update.change*100),'Compact rows conserve the combined change, including relationship adjustments')
 for(const changes of [[.014,.014,-.011],[-.014,-.014,.011],[.001,-.001],[2.675]]){
   const update={parts:changes.map((change,i)=>({label:String(i),change})),change:changes.reduce((a,b)=>a+b,0)}
   assert.equal(r1DisplayParts(update).reduce((sum,p)=>sum+Math.round(p.change*100),0),Math.round(update.change*100))
 }
 assert.equal(r1EvidencePoints(-.001),'0.00')
 assert.equal(r1EvidencePoints(2.675),'+2.68')

 assert.equal(r1CandleUpdates(timeline,at-30*60000,at+30*60000,'EUR').length,1)
 assert.equal(r1CandleUpdates(timeline,at-30*60000,at+30*60000,'USD').length,1)
 assert.equal(r1TimelineAt(timeline,at+day).USD.update.kind,'correction')
 assert.equal(r1TimelineAt(timeline,at+8*day+1).USD.update.kind,'expiry')
 assert.equal(r1TimelineAt(timeline,at+3*day).USD.update.at,at+2*day,'No-release candles retain the latest update date')
 const past=calculateR1Timeline({...input,events:events.filter(r=>r.release_at<=at),end:at})
 assert.deepEqual(r1TimelineAt(past,at),r1TimelineAt(timeline,at),'Future publications cannot change an earlier cursor state')
 assert.equal(r1TimelineAt(timeline,at+2*day).USD.net,calculateR1Pair({release,events,settings:usdSettings,eurSettings,savedBands:{},schedules,asOf:at+2*day}).overall.net,'Previous-quarter revisions invalidate comparisons')
 // Mounted controller reproducer: hover bursts coalesce; no jobs or requests
 // follow cursor/pan, Inspector display filters, or local clock ticks.
 saveR1Settings(usdSettings);saveR1Settings(eurSettings,'EUR')
 saveSequencePreferences({...readSequencePreferences(),roofs:false,ribbon:false})
 const frames=new Map();let frameId=0,handler,unsub=0,requests=0
 dom.requestAnimationFrame=fn=>{frames.set(++frameId,fn);return frameId};dom.cancelAnimationFrame=id=>frames.delete(id)
 const timers=new Map();let timerId=0
 dom.setTimeout=fn=>{timers.set(++timerId,fn);return timerId};dom.clearTimeout=id=>timers.delete(id)
 const workers=[]
 globalThis.Worker=class{jobs=[];constructor(){workers.push(this)}postMessage(job){this.jobs.push(job)}terminate(){this.closed=true}}
 let storageEvents=events,revision=1
 globalThis.fetch=async url=>{requests++;return{ok:true,json:async()=>url.endsWith('/health')?{revision,sources:[{id:'test',server_now:1}],collector_error:null}:{source_id:'test',revision,timestamp_convention:'trade_server_time',time_basis:'chart',event_ids:allR1SeriesIds,events:storageEvents,coverage:{},next_cursor:null,r1_source_version:1,r1_schedules:schedules.map(({family,...s})=>({...s,seriesId:r1Profiles[family].components[0].seriesId}))}}}
 const {Raycaster}=await server.ssrLoadModule('./src/raycaster/Raycaster.tsx')
 const {createRoot}=await import('react-dom/client')
 const div=document.createElement('div');document.body.append(div);root=createRoot(div)
 const chart={subscribeCrosshairMove:fn=>{handler=fn},unsubscribeCrosshairMove:()=>{unsub++},timeScale:()=>({getVisibleRange:()=>null})},series={}
 const props={chartApi:chart,seriesApi:series,symbol:'EURUSD',timeframe:'H1',brokerId:'test',brokerOffsetSeconds:0,clockOffsetMs:at+3*day-Date.now(),timeDisplay:{mode:'utc',utcOffsetMinutes:0},view:'r1',onClose(){}}
 const render=next=>React.act(async()=>{root.render(React.createElement(Raycaster,next));await new Promise(r=>setImmediate(r))})
 await render(props)
 assert.equal(workers.length,1,'R1 view does not start retired scoring workers when their overlays are off')
 const job=workers[0].jobs[0];assert.ok(job)
 await React.act(async()=>workers[0].onmessage({data:{id:job.id,result:calculateR1Timeline(job.input)}}))
 assert.match(div.textContent,/Move across the chart/)
 const baselineRequests=requests,hoverWork={...work}
 await React.act(async()=>{for(let i=0;i<100;i++)handler({point:{x:i,y:1},time:Math.floor(at/3600000)*3600,seriesData:new Map([[series,{}]])});assert.equal(frames.size,1);for(const[id,fn]of frames){frames.delete(id);fn()}})
 assert.match(div.querySelector('[aria-label="EUR R1 evidence"]').textContent,/EUR Strengthening/)
 assert.match(div.querySelector('[aria-label="R1 evidence updates"]').textContent,/Euro-area HICP.*EUR overall score change.*Jobless claims.*PPI.*USD overall score change/s)
 assert.equal(div.querySelectorAll('[aria-label="R1 evidence updates"] .r1-ray-update').length,2)
 const anchors=[...div.querySelectorAll('.r1-ray-points, .r1-ray-strength, .r1-ray-change, .r1-ray-comparison, .r1-ray-update-group, .r1-evidence-tank')]
 assert.deepEqual([...div.querySelectorAll('.r1-ray-update-group')].map(e=>e.getAttribute('aria-label')),['EUR evidence updates','USD evidence updates'])
 for(const currency of ['EUR','USD']){
   const update=r1TimelineAt(timeline,at+30*60000)[currency].update
   const table=div.querySelector(`[aria-label="${currency} release points and overall changes"]`)
   for(const part of r1DisplayParts(update))assert.ok(table.textContent.includes(part.label)&&table.textContent.includes(r1EvidencePoints(part.change)))
   for(const a of update.standalone)assert.ok(table.textContent.includes(a.label)&&table.textContent.includes(r1EvidencePoints(a.net)))
   assert.ok(table.tFoot.textContent.includes(r1EvidencePoints(update.change)))
   const meter=div.querySelector(`[aria-label="${currency} overall evidence tank"]`)
   assert.equal(Number(meter.getAttribute('aria-valuenow')),r1TimelineAt(timeline,at+30*60000)[currency].net)
   assert.equal(meter.getAttribute('aria-valuemin'),'-100');assert.equal(meter.getAttribute('aria-valuemax'),'100')
 }
 assert.ok(div.querySelector('[aria-label="EUR and USD comparison"] strong').textContent.includes('leads'))
 for(const b of div.querySelectorAll('.r1-ray-points b'))assert.match(b.textContent,/^[+-]?\d+\.\d{2} → [+-]?\d+\.\d{2}$/)

 assert.match(div.querySelector('[aria-label="Raycaster view"]').textContent,/Context \(Retired\).*Selected combo \(Retired\)/)
 assert.doesNotMatch(div.querySelector('[aria-label="R1 evidence updates"]').textContent,/Asia\/Jakarta|Long|Short/)
 await render({...props,symbols:{claims:'star'},clockOffsetMs:props.clockOffsetMs+1000})
 assert.deepEqual(work,hoverWork,'Hover and display clocks perform zero scoring work')
 assert.equal(workers[0].jobs.length,1);assert.equal(requests,baselineRequests,'Clock/display updates do not reload or rescore history')
 await React.act(async()=>{handler({point:{x:1,y:1},time:(at+3*day)/1000,seriesData:new Map([[series,{}]])});for(const[id,fn]of frames){frames.delete(id);fn()}})
 assert.equal(workers[0].jobs.length,1,'No-release candles only look up history')
 assert.deepEqual([...div.querySelectorAll('.r1-ray-points, .r1-ray-strength, .r1-ray-change, .r1-ray-comparison, .r1-ray-update-group, .r1-evidence-tank')],anchors,'Hover updates reuse the same fixed summary slots, tanks and currency groups')
 assert.deepEqual([...div.querySelectorAll('.r1-ray-update-group')].map(e=>e.getAttribute('aria-label')),['EUR evidence updates','USD evidence updates'],'Latest update timestamps never reorder currency groups')

 assert.match(div.querySelector('[aria-label="R1 evidence updates"]').textContent,/GDP/)
 await React.act(async()=>saveR1Settings({...usdSettings,selected:['claims']}))
 await render(props)
 assert.equal(workers[0].jobs.length,2,'A genuine model scope change rebuilds the timeline')
 const unchangedJobs=workers[0].jobs.length
 const poll=[...timers].find(([,fn])=>fn.name==='poll');assert.ok(poll)
 await React.act(async()=>{timers.delete(poll[0]);await poll[1]()})
 assert.equal(workers[0].jobs.length,unchangedJobs,'Unchanged polling preserves timeline input identities')
 revision++;storageEvents=events.map(r=>r.value_id===original.value_id?{...r,actual:225,r1_vintages:undefined}:r)
 const changedPoll=[...timers].find(([,fn])=>fn.name==='poll');assert.ok(changedPoll)
 await React.act(async()=>{timers.delete(changedPoll[0]);await changedPoll[1]()})
 assert.equal(workers[0].jobs.length,unchangedJobs,'Latest-job client queues new data behind the active settings job')
 const settingsJob=workers[0].jobs.at(-1)
 await React.act(async()=>workers[0].onmessage({data:{id:settingsJob.id,result:calculateR1Timeline(settingsJob.input)}}))
 assert.equal(workers[0].jobs.length,unchangedJobs+1,'A genuine stored correction starts the pending timeline job')
 const changedJob=workers[0].jobs.at(-1)
 assert.equal(changedJob.input.events.find(r=>r.value_id===original.value_id).actual,225)
 await React.act(async()=>workers[0].onmessage({data:{id:changedJob.id,result:calculateR1Timeline(changedJob.input)}}))
 await React.act(async()=>saveR1Settings({...eurSettings,selected:['euro-inflation','euro-pmi']},'EUR'))
 const missingJob=workers[0].jobs.at(-1)
 assert.notEqual(missingJob.id,changedJob.id)
 await React.act(async()=>workers[0].onmessage({data:{id:missingJob.id,result:calculateR1Timeline(missingJob.input)}}))
 assert.match(div.querySelector('[aria-label="EUR R1 evidence"]').textContent,/Available evidence favors strength.*Incomplete — PMI unavailable/s)
 assert.ok(div.querySelector('[aria-label="EUR overall evidence tank"] .r1-tank-unknown'),'Missing evidence is hatched rather than rendered as a measured zero')
 const missingHoverWork={...work},missingJobs=workers[0].jobs.length,missingRequests=requests
 await React.act(async()=>{for(let i=0;i<100;i++)handler({point:{x:i,y:1},time:(at+2*day)/1000,seriesData:new Map([[series,{}]])});for(const[id,fn]of frames){frames.delete(id);fn()}})
 assert.deepEqual(work,missingHoverWork);assert.equal(workers[0].jobs.length,missingJobs);assert.equal(requests,missingRequests,'Tank/partial summaries still do zero calculation or network work on hover')
 await render({...props,boxVisible:false})
 assert.ok(workers[0].closed);assert.ok(unsub>0);assert.equal(timers.size,0,'Hidden R1 cancels storage polling');assert.equal(frames.size,0,'Hidden R1 stops workers, timers and hover listeners')
 console.log('R1 Raycaster: Inspector parity, simultaneous publications, corrections, older-period revisions, schedules/expiry, future exclusion, and deterministic hover work counts pass')
}finally{
 if(root)await React.act(async()=>root.unmount())
 for(const[key,descriptor]of previous)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]
 await server.close();dom.happyDOM.abort()
}
