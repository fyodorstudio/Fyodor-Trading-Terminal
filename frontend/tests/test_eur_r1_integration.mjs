import assert from 'node:assert/strict'
import React from 'react'
import {createServer} from 'vite'
import {Window} from 'happy-dom'
const server=await createServer({server:{middlewareMode:true,hmr:false}}),dom=new Window({url:'http://localhost:5173'})
const globals={window:dom,document:dom.document,HTMLElement:dom.HTMLElement,Node:dom.Node,navigator:dom.navigator,localStorage:dom.localStorage,IS_REACT_ACT_ENVIRONMENT:true}
const previous=new Map([...Object.keys(globals),'Worker','fetch'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v})
const {createRoot}=await import('react-dom/client'),roots=[]
const mount=Component=>{const div=document.createElement('div');document.body.append(div);const root=createRoot(div);roots.push(root);return{div,render:props=>React.act(async()=>{root.render(React.createElement(Component,props));await new Promise(resolve=>setImmediate(resolve))})}}
let posts=0,created=0,terminated=0
dom.setTimeout=()=>0;dom.clearTimeout=()=>{}
try{
 const {calculateR1Pair}=await server.ssrLoadModule('./src/scoring-system/r1/pair.ts')
 const {calculateR1History}=await server.ssrLoadModule('./src/scoring-system/r1/history.ts')
 globalThis.Worker=class{constructor(){created++}postMessage({id,input}){posts++;Promise.resolve().then(()=>{if(!this.closed)this.onmessage?.({data:{id,result:input.release?calculateR1Pair(input):calculateR1History(input)}})})}terminate(){this.closed=true;terminated++}}
 const {R1Score,r1DetailsKey}=await server.ssrLoadModule('./src/inspector/scoring/R1Score.tsx')
 const {InspectorPanel}=await server.ssrLoadModule('./src/inspector/InspectorPanel.tsx')
 const {groupInspectorReleases,defaultInspectorPreferences}=await server.ssrLoadModule('./src/inspector/inspector-data.ts')
 const {R1ScatterPanel}=await server.ssrLoadModule('./src/scatter-plot/dock/R1ScatterPanel.tsx')
 const {scatterFamilyBindings}=await server.ssrLoadModule('./src/scatter-plot/dock/scatter-family-bindings.ts')
 const {R1ScoringSettings}=await server.ssrLoadModule('./src/fundamental-tools/settings/R1ScoringSettings.tsx')
 const {saveR1Settings,readR1Settings,eurR1SettingsKey}=await server.ssrLoadModule('./src/scoring-system/r1/settings.ts')
 const {exportWorkspace,restoreWorkspace}=await server.ssrLoadModule('./src/workspace-portability/workspace-snapshot.ts')
 const at=Date.UTC(2026,2,19,12,30),oldAt=at-30*86400000,jan=Date.UTC(2026,0,1)/1000,feb=Date.UTC(2026,1,1)/1000
 let id=0
 const row=(series,actual,time,period,extra={})=>({value_id:String(++id),event_id:series,release_at:time,chart_time_seconds:time/1000,server_time_seconds:time/1000,period_seconds:period,revision:0,currency:'EUR',country_code:'EU',country_name:'Euro area',name:'Test',event_code:'',importance:'high',unit:1,multiplier:0,digits:1,time_mode:0,impact:'none',actual,previous:999,forecast:999,revised_previous:null,availability:'observed',...extra})
 const euroSettings={version:1,selected:['euro-inflation'],calibration:{mode:'undefined',limits:{'euro-inflation/core-annual':[.1,.2,.4],'euro-inflation/headline-annual':[.1,.2,.4]}}}
 const usdSettings={version:1,selected:['fomc'],calibration:{mode:'automatic',limits:{}}}
 saveR1Settings(euroSettings,'EUR');saveR1Settings(usdSettings)
 let rows=[row('999030012',2.5,oldAt,jan),row('999030013',2.4,oldAt,jan),row('999030012',2.6,at,feb),row('999030013',2.5,at,feb),row('840050014',3.75,at-86400000,0,{currency:'USD',country_code:'US',previous:3.75})]
 const queries=[]
 globalThis.fetch=async url=>{const params=new URL('http://localhost'+url).searchParams;queries.push(params);return{ok:true,json:async()=>url.endsWith('/health')?{revision:1,sources:[{id:'test',server_now:1}],collector_error:null}:{source_id:'test',revision:1,timestamp_convention:'trade_server_time',time_basis:'chart',event_ids:params.get('event_ids')?.split(','),events:rows,coverage:{USD:{missing:[]},EUR:{missing:[]}},next_cursor:null,r1_source_version:1,r1_schedules:[]}}}
 let release=groupInspectorReleases(rows).find(r=>r.familyId==='euro-inflation'&&r.releaseAt===at)
 const app=mount(R1Score);await app.render({release,brokerId:'test',events:[]})
 assert.match(app.div.querySelector('[aria-label="Publication summary"]').textContent,/Overall EUR Strengthening.*Evidence: Moderate.*Evidence points: 0 → \+25.*Change \+25/s)
 assert.match(app.div.querySelector('[aria-label="EURUSD evidence"]').textContent,/evidence favors EUR.*EUR Strengthening.*\+25.*Pair points 0 → \+12.5/s)
 assert.equal(app.div.querySelectorAll('table').length,1)
 assert.deepEqual([...app.div.querySelectorAll('tbody tr')].map(tr=>tr.cells[3].textContent),['+2.5','+2.4'],'Comparable Previous uses the distinct preceding month')
 assert.ok(queries.some(q=>q.get('event_ids')?.includes('840050014')&&q.get('event_ids')?.includes('999030012')&&!q.has('currency')),'Both currencies load together at the selected clock')
 const choose=async value=>React.act(async()=>{const select=app.div.querySelector('[aria-label="Scoring details"]');select.value=value;select.dispatchEvent(new dom.Event('change',{bubbles:true}))})
 const beforeDetails=posts;await choose('freshness')
 assert.equal(posts,beforeDetails);assert.equal(app.div.querySelectorAll('table').length,1)
 assert.match(app.div.querySelector('[data-family="euro-inflation"]').textContent,/0 days.*45 days.*Age-based/)
 const held=row('999010006',2,at+86400000,0,{previous:2});rows=[...rows,held];release=groupInspectorReleases(rows).find(r=>r.familyId==='ecb')
 await app.render({release,brokerId:null,events:rows})
 assert.equal(app.div.querySelector('[aria-label="Scoring details"]').value,'freshness','Details choice persists across releases')
 assert.match(app.div.querySelector('[aria-label="Publication summary"]').textContent,/Rate held at 2%/)
 await choose('release');assert.match(app.div.querySelector('[aria-label="Release evidence"]').textContent,/A hold alone does not establish currency strength or weakness/)
 const panel=mount(InspectorPanel),view={supported:true,selectedRelease:release,allReleases:groupInspectorReleases(rows),releases:groupInspectorReleases(rows),now:at,brokerId:null,preferences:{...defaultInspectorPreferences(),detailView:'r1'},error:null,brokerTime:false,range:{from:at-1,to:at+1},storage:{coverage:{},loading:false,error:null},rangeDates:{from:'2026-03-01',to:'2026-03-31'},magnitudeHistory:{rows:{}},applyPreferences(){},selectRelease(){}}
 await panel.render({view,symbol:'EURUSD',source:null,error:null,timeDisplay:{mode:'utc',utcOffsetMinutes:0}})
 assert.match(panel.div.querySelector('[aria-label="Inspector view"]').textContent,/EUR R1/)
 assert.ok(panel.div.querySelector('[aria-label="EUR R1 scoring"]'))
 let navigation;const onSettings=e=>{navigation=e.detail};window.addEventListener('fyodor:fundamental-settings',onSettings)
 await React.act(async()=>panel.div.querySelector('[aria-label="Scoring explanation & settings"]').click());window.removeEventListener('fyodor:fundamental-settings',onSettings)
 assert.deepEqual(navigation,{family:'ecb',model:'r1'})
 const pmiOld=row('999500001',50,oldAt,jan,{unit:0}),pmiNew=row('999500001',51,at,feb,{unit:0})
 rows=[pmiOld,pmiNew];release=groupInspectorReleases(rows).find(r=>r.releaseAt===at)
 const pmiSettings={version:1,selected:['euro-manufacturing-pmi'],calibration:{mode:'undefined',limits:{'euro-manufacturing-pmi/activity':[1,2,3]}}}
 await React.act(async()=>saveR1Settings(pmiSettings,'EUR'))
 const binding=scatterFamilyBindings.find(b=>b.family.familyId==='euro-pmi'),dock=mount(R1ScatterPanel)
 await dock.render({brokerId:'test',clockOffsetMs:at+86400000-Date.now(),target:{brokerId:'test',familyId:'euro-pmi',releaseId:release.id,at},binding,viewState:new Map(),familyOptions:[binding.scope.family],onFamilyChange(){},onMeasureChange(){}})
 assert.equal(dock.div.querySelector('[aria-label="R1 Scatter input"]').value,'euro-manufacturing-pmi/activity','Manufacturing-only publication defaults to the actual supplied reading')
 assert.equal(dock.div.querySelector('[aria-label="R1 Scatter input"]').options.length,3)
 assert.match(dock.div.textContent,/R1 evidence: 100/)
 await app.render({release,brokerId:null,events:rows})
 const fundamental=mount(R1ScoringSettings);await fundamental.render({family:'euro-manufacturing-pmi'})
 assert.equal(fundamental.div.querySelector('[aria-label="Euro-area employment freshness days"]').value,'120')
 const beforePreview=posts
 await React.act(async()=>{const field=dock.div.querySelector('[aria-label="Small R1 upper boundary"]');Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype,'value').set.call(field,'1.5');field.dispatchEvent(new dom.Event('input',{bubbles:true}))})
 assert.equal(posts,beforePreview);assert.match(dock.div.textContent,/Preview evidence: 66.67/)
 assert.equal(readR1Settings('EUR').calibration.limits['euro-manufacturing-pmi/activity'][0],1)
 await React.act(async()=>dock.div.querySelector('[aria-label="R1 magnitude boundaries"]').dispatchEvent(new dom.Event('submit',{bubbles:true,cancelable:true})))
 assert.match(app.div.textContent,/Net\s*\+66.67/);assert.equal(fundamental.div.querySelector('[aria-label="euro-manufacturing-pmi/activity Small"]').value,'1.5')
 assert.deepEqual(readR1Settings(),usdSettings,'EUR Apply cannot modify USD settings')
 const portable=exportWorkspace();assert.ok(portable.entries[eurR1SettingsKey]);assert.equal(portable.entries[r1DetailsKey],'release')
 const saved=readR1Settings('EUR');await React.act(async()=>{saveR1Settings(euroSettings,'EUR');restoreWorkspace(portable)})
 assert.deepEqual(readR1Settings('EUR'),saved)
 await React.act(async()=>[...dock.div.querySelectorAll('button')].find(b=>b.textContent==='Reset to inherited').click())
 assert.equal(readR1Settings('EUR').calibration.limits['euro-manufacturing-pmi/activity'],undefined)
 const combined=[...rows,row('999500003',51,oldAt,jan,{unit:0}),row('999500003',50,at,feb,{unit:0}),row('999500002',51,oldAt,jan,{unit:0}),row('999500002',52,at,feb,{unit:0})]
 const groupSettings={version:1,selected:['euro-pmi','euro-services-pmi','euro-manufacturing-pmi'],calibration:{mode:'undefined',limits:Object.fromEntries(['euro-pmi','euro-services-pmi','euro-manufacturing-pmi'].map(f=>[`${f}/activity`,[1,2,3]]))}}
 await React.act(async()=>saveR1Settings(groupSettings,'EUR'))
 await app.render({release:groupInspectorReleases(combined).find(r=>r.releaseAt===at),brokerId:null,events:combined})
 assert.match(app.div.querySelector('[aria-label="Publication summary"]').textContent,/Overall EUR Weakening/)
 const beforeAssessment=posts
 await React.act(async()=>{const select=app.div.querySelector('[aria-label="Release assessment"]');select.value='euro-services-pmi';select.dispatchEvent(new dom.Event('change',{bubbles:true}))})
 assert.equal(posts,beforeAssessment,'Changing the standalone sector reuses the publication calculation')
 assert.match(app.div.querySelector('[aria-label="Release evidence"]').textContent,/services PMI/)
 assert.match(app.div.querySelector('[aria-label="Publication summary"]').textContent,/Overall EUR Weakening.*services PMI: EUR-supportive/s,'Standalone sector changes cannot alter composite-owned overall evidence')
 console.log('✓ Mounted EUR summary, same-clock pair, hold presentation, table persistence, Inspector settings, sector Scatter default, local preview/Apply and portable currency isolation')
}finally{
 await React.act(async()=>roots.forEach(root=>root.unmount()));assert.equal(terminated,created)
 await server.close();dom.happyDOM.abort()
 for(const[k,descriptor]of previous)if(descriptor)Object.defineProperty(globalThis,k,descriptor);else delete globalThis[k]
}
