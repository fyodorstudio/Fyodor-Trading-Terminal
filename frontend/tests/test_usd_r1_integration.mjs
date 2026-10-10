import assert from 'node:assert/strict'
import React from 'react'
import {createServer} from 'vite'
import {Window} from 'happy-dom'
const server=await createServer({server:{middlewareMode:true,hmr:false}}),dom=new Window({url:'http://localhost:5173'})
const globals={window:dom,document:dom.document,HTMLElement:dom.HTMLElement,Node:dom.Node,navigator:dom.navigator,localStorage:dom.localStorage,IS_REACT_ACT_ENVIRONMENT:true}
const previous=new Map([...Object.keys(globals),'Worker','fetch'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v})
const {createRoot}=await import('react-dom/client'),roots=[]
const timers=new Map();let timerId=0
dom.setTimeout=(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId};dom.clearTimeout=id=>timers.delete(id)
const mount=Component=>{const div=document.createElement('div');document.body.append(div);const root=createRoot(div);roots.push(root);return{div,render:props=>React.act(async()=>{root.render(React.createElement(Component,props));await new Promise(resolve=>setImmediate(resolve))})}}
let posts=0,created=0,terminated=0,revision=1
try{
  const {calculateR1}=await server.ssrLoadModule('./src/scoring-system/r1/analysis.ts')
  const {calculateR1History}=await server.ssrLoadModule('./src/scoring-system/r1/history.ts')
  globalThis.Worker=class{constructor(){created++}postMessage({id,input}){posts++;Promise.resolve().then(()=>{if(!this.closed)this.onmessage?.({data:{id,result:input.release?calculateR1(input):calculateR1History(input)}})})}terminate(){this.closed=true;terminated++}}
  const {R1Score}=await server.ssrLoadModule('./src/inspector/scoring/R1Score.tsx')
  const {InspectorPanel}=await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
  const {groupInspectorReleases,defaultInspectorPreferences,inspectorStorageKey}=await server.ssrLoadModule('./src/inspector/inspector-data.ts')
  const {r1Profiles}=await server.ssrLoadModule('./src/scoring-system/r1/profiles.ts')
  const {saveR1Settings,readR1Settings,r1SettingsKey}=await server.ssrLoadModule('./src/scoring-system/r1/settings.ts')
  const {exportWorkspace,restoreWorkspace}=await server.ssrLoadModule('./src/workspace-portability/workspace-snapshot.ts')
  const {r1ScatterModel}=await server.ssrLoadModule('./src/scatter-plot/inspection/r1-scatter-model.ts')
  const {ScatterPlotDock}=await server.ssrLoadModule('./src/scatter-plot/dock/ScatterPlotDock.tsx')
  const at=Date.UTC(2026,2,11,12,30)
  let rows=r1Profiles['us-cpi'].components.map((c,i)=>({value_id:String(i),event_id:c.seriesId,release_at:at,chart_time_seconds:at/1000,server_time_seconds:at/1000,period_seconds:Date.UTC(2026,1,1)/1000,revision:0,currency:'USD',country_code:'US',country_name:'US',name:'CPI',event_code:'',importance:'high',unit:1,multiplier:0,digits:1,time_mode:0,impact:'none',actual:[.2,2.5,.3,2.4][i],previous:[.3,2.5,.2,2.4][i],forecast:null,revised_previous:null,availability:'observed'}))
  const settings={version:1,selected:['us-cpi'],calibration:{mode:'undefined',limits:Object.fromEntries(r1Profiles['us-cpi'].components.map(c=>[`us-cpi/${c.id}`,[.1,.2,.3]]))}}
  saveR1Settings(settings)
  const release=groupInspectorReleases(rows)[0]
  globalThis.fetch=async url=>{const params=new URL('http://localhost'+url).searchParams;return{ok:true,json:async()=>url.endsWith('/health')?{revision,sources:[{id:'test',server_now:1}],collector_error:null}:{source_id:'test',revision,timestamp_convention:'trade_server_time',time_basis:'chart',event_ids:params.get('event_ids')?.split(','),events:rows,coverage:{USD:{missing:[]}},next_cursor:null,r1_source_version:1,r1_schedules:[{seriesId:'840030006',dueAt:at+30*86400000,knownAt:at-86400000,source:'test-publisher'}]}}}
  const app=mount(R1Score);await app.render({release,brokerId:'test',events:[]})
  assert.match(app.div.textContent,/USD Weakening/);assert.match(app.div.textContent,/USD-negative\s*-50/)
  assert.equal(app.div.querySelectorAll('details, summary').length,0,'release and relationship evidence are visible without nested disclosures')
  assert.deepEqual([...app.div.querySelectorAll('[aria-label="Release evidence"] tbody tr')].map(tr=>tr.cells[1].textContent),['50%','20%','15%','15%'])
  assert.ok(app.div.querySelector('[aria-label="Relationship audit"] li'),'relationship sources are rendered without an expand action')
  const posted=posts
  await app.render({release,brokerId:'test',events:[],now:at+1000})
  assert.equal(posts,posted,'display clocks do not recalculate R1 history')
  const poll=async()=>React.act(async()=>{for(const[id,t]of [...timers])if(t.ms===10000){timers.delete(id);t.fn()}await new Promise(resolve=>setImmediate(resolve))})
  revision++;await poll();assert.equal(posts,posted,'identical rows at a new storage revision preserve calculation identity')
  rows=rows.map((r,i)=>i===0?{...r,actual:.4}:r);revision++;await poll()
  assert.ok(posts>posted);assert.match(app.div.textContent,/USD Strengthening/,'genuine corrections propagate despite stale selected-release prop')
  const analysis=calculateR1({release:groupInspectorReleases(rows)[0],events:rows,settings,savedBands:{}})
  const history=calculateR1History({family:'us-cpi',events:rows,at,calibration:settings.calibration,savedBands:{}})
  assert.deepEqual(history[0],analysis.assessment,'history worker and Inspector share the exact assessment')
  const model=r1ScatterModel(history,'core-monthly',release.id)
  assert.equal(model.inspection.signal.points,analysis.assessment.readings[0].points)
  assert.deepEqual(model.inspection.signal.limits,analysis.assessment.readings[0].limits)
  localStorage.setItem(inspectorStorageKey,JSON.stringify({...defaultInspectorPreferences(),detailView:'r1'}))
  const exported=exportWorkspace();await React.act(async()=>{saveR1Settings({...settings,selected:[]});restoreWorkspace(exported)})
  assert.deepEqual(readR1Settings(),settings);assert.ok(exported.entries[r1SettingsKey])
  const panel=mount(InspectorPanel),view={supported:true,selectedRelease:groupInspectorReleases(rows)[0],preferences:{...defaultInspectorPreferences(),detailView:'r1'},allReleases:groupInspectorReleases(rows),releases:groupInspectorReleases(rows),now:at,brokerId:null,brokerTime:false,range:{from:at-1,to:at+1},storage:{coverage:{},loading:false,error:null},rangeDates:{from:'2026-03-01',to:'2026-03-31'},magnitudeHistory:{rows:{}},applyPreferences(){},selectRelease(){}}
  await panel.render({view,symbol:'EURUSD',source:null,error:null,timeDisplay:{mode:'utc',utcOffsetMinutes:0}})
  assert.equal(panel.div.querySelector('[aria-label="Inspector view"]').value,'r1');assert.ok(panel.div.querySelector('[aria-label="USD R1 scoring"]'))
  const settingsButton=panel.div.querySelector('.inspector-header [aria-label="Scoring explanation & settings"]')
  assert.equal(settingsButton.nextElementSibling,panel.div.querySelector('[aria-label="Inspector view"]'),'settings sits immediately before the view selector')
  let navigation
  const onSettings=e=>{navigation=e.detail}
  window.addEventListener('fyodor:fundamental-settings',onSettings)
  const beforeSettings=posts
  await React.act(async()=>settingsButton.click())
  window.removeEventListener('fyodor:fundamental-settings',onSettings)
  assert.deepEqual(navigation,{family:'us-cpi',model:'r1'},'the moved button opens the R1 settings model')
  assert.equal(posts,beforeSettings,'opening settings does not relaunch scoring')
  const jobs=posts
  await panel.render({view:{...view,preferences:{...view.preferences,detailView:'table'}},symbol:'EURUSD',source:null,error:null,timeDisplay:{mode:'utc',utcOffsetMinutes:0}})
  assert.equal(panel.div.querySelector('[aria-label="USD R1 scoring"]'),null);assert.equal(posts,jobs,'hidden R1 does not launch work')
  const dock=mount(ScatterPlotDock)
  await dock.render({brokerId:'test',clockOffsetMs:at+86400000-Date.now(),target:{brokerId:'test',familyId:'us-cpi',releaseId:release.id,at}})
  const dropdown=dock.div.querySelector('[aria-label="Scatter Plot Calculation"]')
  await React.act(async()=>{dropdown.value='r1';dropdown.dispatchEvent(new dom.Event('change',{bubbles:true}));await new Promise(resolve=>setImmediate(resolve))})
  assert.equal(dock.div.querySelector('[aria-label="Scatter Plot Calculation"]').value,'r1')
  assert.match(dock.div.textContent,/R1 evidence: 50/,'mounted Scatter shows the same corrected contribution as Inspector')
  const historyJobs=posts
  await React.act(async()=>[...dock.div.querySelectorAll('button')].find(b=>b.textContent==='Latest release').click())
  assert.equal(posts,historyJobs,'chart selection reuses history rather than recalculating')
  const inputSelect=dock.div.querySelector('[aria-label="R1 Scatter input"]')
  await React.act(async()=>{inputSelect.value='core-annual';inputSelect.dispatchEvent(new dom.Event('change',{bubbles:true}));[...dock.div.querySelectorAll('button')].find(b=>b.textContent==='All history').click()})
  const axis=dock.div.querySelector('[data-scale-axis="x"]')
  await React.act(async()=>axis.dispatchEvent(new dom.KeyboardEvent('keydown',{key:'+',bubbles:true})))
  const rangeBefore=dock.div.querySelector('svg').getAttribute('data-date-from')
  const switchCalculation=async value=>React.act(async()=>{const select=dock.div.querySelector('[aria-label="Scatter Plot Calculation"]');select.value=value;select.dispatchEvent(new dom.Event('change',{bubbles:true}));await new Promise(resolve=>setImmediate(resolve))})
  await switchCalculation('ap');await switchCalculation('r1')
  assert.equal(dock.div.querySelector('[aria-label="R1 Scatter input"]').value,'core-annual','calculation switches retain input selection')
  assert.ok([...dock.div.querySelectorAll('button')].some(b=>b.textContent==='Recent releases'),'calculation switches retain history mode')
  assert.equal(dock.div.querySelector('svg').getAttribute('data-date-from'),rangeBefore,'calculation switches retain axis viewport')
  const latestOriginal={...rows[0],actual:.2,revision:0},laterCorrection={...rows[0],revision:1}
  rows=rows.map((r,i)=>i===0?{...r,r1_vintages:JSON.stringify([{knownAt:at+1000,event:latestOriginal,source:'fixture'},{knownAt:at+3600000,event:laterCorrection,source:'fixture'}])}:r)
  revision++;await poll()
  assert.match(app.div.textContent,/USD Weakening/,'original Inspector snapshot is recovered despite latest corrected table value')
  assert.match(app.div.textContent,/retrospective/,'audit identifies unverified late capture')
  const withVintages=posts;revision++;await poll()
  assert.equal(posts,withVintages,'identical version metadata at a new revision does not rescore')
  console.log('✓ Mounted R1 Inspector, publication corrections, stable polling/clocks, hidden-view cleanup, Scatter assessment parity and workspace portability')
}finally{
  await React.act(async()=>roots.forEach(root=>root.unmount()))
  assert.equal(terminated,created,'all R1 workers terminate on unmount')
  await server.close();dom.happyDOM.abort()
  for(const[k,descriptor]of previous)if(descriptor)Object.defineProperty(globalThis,k,descriptor);else delete globalThis[k]
}
