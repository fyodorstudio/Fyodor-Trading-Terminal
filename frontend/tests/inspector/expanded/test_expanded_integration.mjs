import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'
const server = await createServer({root:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),server:{middlewareMode:true,hmr:false}})
const dom = new Window({url:'http://localhost:5173'})
const keys=['window','document','HTMLElement','Node','navigator','localStorage','IS_REACT_ACT_ENVIRONMENT','Worker']
const previous=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
for(const key of keys)Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:key==='window'?dom:key==='document'?dom.document:key==='IS_REACT_ACT_ENVIRONMENT'?true:dom[key]})
globalThis.Worker=undefined
const {createRoot}=await import('react-dom/client')
const container=document.createElement('div');document.body.append(container);const root=createRoot(container)
try{
 const load=p=>server.ssrLoadModule('./src/'+p)
 const {ExpandedReleaseScore}=await load('inspector/scoring/shared/ui/ExpandedReleaseScore.tsx')
 const {FedScore}=await load('inspector/scoring/PAIR/EURUSD/USD/FED/ui/FedScore.tsx')
 const {previousFedMeeting}=await load('scoring-system/PAIR/EURUSD/USD/FED/assessment/fed-context.ts')
 const {buildContextTimeline}=await load('scoring-system/context/usd/build-context-timeline.ts')
 const {contextAt}=await load('scoring-system/context/usd/context-lookup.ts')
 const {contextPairLabel}=await load('scoring-system/context/usd/usd-pair.ts')
 const {InspectorScoringView}=await load('inspector/scoring/InspectorScoringView.tsx')
 const {PublicationContext}=await load('usd-context/ui/PublicationContext.tsx')
 const {inspectorScoringBinding}=await load('inspector/scoring/scoring-registry.ts')
 const {groupInspectorReleases}=await load('inspector/inspector-data.ts')
 const {ppiSignalSettings,gdpSignalSettings}=await load('scoring-system/shared/core/signal-magnitude-settings.ts')
 const {readContextFamilies,contextFamiliesKey,saveContextFamilies}=await load('usd-context/storage/context-family-settings.ts')
 const {exportWorkspace,restoreWorkspace,parseWorkspaceSnapshot}=await load('workspace-portability/workspace-snapshot.ts')
 const rows=m=>['840030001','840030002','840030003','840030004'].map((id,i)=>({value_id:id+'/'+m,event_id:id,name:id,event_code:id,server_time_seconds:Date.UTC(2015,m+1,14)/1000,release_at:Date.UTC(2015,m+1,14),period_seconds:Date.UTC(2015,m,1)/1000,revision:0,currency:'USD',country_code:'US',country_name:'United States',importance:'high',unit:1,multiplier:0,digits:1,time_mode:0,impact:'none',actual:m===42?i<2?.8:4:i<2?.2+m%3*.1:3+m%3*.1,previous:i<2?.2:3,forecast:null,revised_previous:null}))
 const events=Array.from({length:43},(_,m)=>rows(m)).flat(),release=groupInspectorReleases(rows(42))[0]
 await React.act(async()=>root.render(React.createElement(ExpandedReleaseScore,{release,events,history:{}})))
 assert.match(container.textContent,/EURUSD Short/);assert.equal(container.querySelectorAll('[aria-label="PPI component scores"] tbody tr').length,4)
 assert.equal(container.querySelector('[aria-label="How this scorer works"]'),null)
 assert.equal(container.querySelector('[aria-label="PPI component scores"]').closest('details'),null,'Result drivers stay visible')
 await React.act(async()=>ppiSignalSettings.save('core-pace',[.001,.002,.003]));assert.deepEqual(ppiSignalSettings.read()['core-pace'],[.001,.002,.003]);assert.equal(container.querySelector('[aria-label="PPI signal calibration"]'),null)
 assert.deepEqual(gdpSignalSettings.read(),{})
 await React.act(async()=>gdpSignalSettings.save('growth',[.1,.2,.3]));const exported=exportWorkspace()
 assert.deepEqual(JSON.parse(exported.entries[gdpSignalSettings.key]),{growth:[.1,.2,.3]})
 await React.act(async()=>{ppiSignalSettings.save('core-pace',null);restoreWorkspace(exported)})
 assert.deepEqual(ppiSignalSettings.read()['core-pace'],[.001,.002,.003])
 assert.throws(()=>parseWorkspaceSnapshot(JSON.stringify({...exported,entries:{[gdpSignalSettings.key]:'{"growth":[1,1,2]}'}})))
 for(const familyId of ['gdp','ppi','fomc','fed-chair'])assert.equal(inspectorScoringBinding('EURUSD.a',{...release,familyId}).familyId,familyId)
 assert.equal(inspectorScoringBinding('GBPUSD',release),null)
 const speech={...release,familyId:'fed-chair',events:[]}
 await React.act(async()=>root.render(React.createElement(FedScore,{release:speech,history:{}})))
 assert.match(container.textContent,/Uncomputed/);assert.match(container.textContent,/no usable policy decision or speech text/)
 await React.act(async()=>saveContextFamilies(['ppi']))
 const fedAt=release.releaseAt+2*86400000
 const fedRow=(at,actual=3.75,previous=3.75)=>({...rows(42)[0],value_id:'fed/'+at,event_id:'840050014',event_code:'fed-interest-rate-decision',
   name:'Fed Interest Rate Decision',release_at:at,server_time_seconds:at/1000,chart_time_seconds:at/1000,
   actual,previous,period_seconds:0})
 const priorFed=fedRow(fedAt-45*86400000),currentFed=fedRow(fedAt),futureFed=fedRow(fedAt+45*86400000,4)
 const fedRelease=groupInspectorReleases([currentFed])[0],fedEvents=[...events,priorFed,currentFed,futureFed]
 const input={events:fedEvents,families:['ppi'],settings:{cpi:{},nfp:{},services:{},manufacturing:{},ppi:ppiSignalSettings.read()},asOf:fedAt}
 const expected=contextAt(buildContextTimeline(input),fedAt).result
 assert.equal(previousFedMeeting(fedRelease,fedEvents).releaseAt,priorFed.release_at)
 assert.equal(previousFedMeeting(fedRelease,[...fedEvents,{...priorFed,value_id:'ambiguous-prior'}]),null)
 assert.equal(previousFedMeeting(fedRelease,[currentFed,futureFed]),null)
 const withFed=buildContextTimeline(input),withoutFed=buildContextTimeline({...input,events:events})
 assert.deepEqual({...withFed,relationships:undefined},{...withoutFed,relationships:undefined},
   'Fed rates, holds and future meetings do not vote or renew macro evidence')
 assert.ok(withFed.relationships.episodes.some(e=>e.kind==='fed-relationship'),'Fed adds an annotation separately from accumulated context')
 const fedProps={release:fedRelease,events:fedEvents,now:fedAt,history:{}}
 await React.act(async()=>root.render(React.createElement(InspectorScoringView,{...fedProps,surface:'both',binding:inspectorScoringBinding('EURUSD',fedRelease)})))
 assert.equal(container.querySelector('[aria-label="Fed contextual pair direction"]').textContent,contextPairLabel('EURUSD',expected.direction))
 const actionPanel=container.querySelector('[aria-label="Fed rate-action interpretation"]')
 assert.equal(actionPanel.querySelector('[aria-label="Decision & rate action"] p').textContent,'Rate held at 3.75%. A hold alone does not establish currency strength or weakness.')
 assert.equal(actionPanel.querySelectorAll('[aria-label="Decision & rate action"] p').length,1)
 assert.equal(actionPanel.querySelector('[aria-label="Fed standalone direction"]'),null)
 assert.equal(actionPanel.querySelector('[aria-label="Rate history"]').open,false)
 assert.match(actionPanel.querySelector('[aria-label="Fed rate action readings"]').textContent,/3.75%.*3.75%.*0 bp/)
 assert.doesNotMatch(actionPanel.textContent,/Fed guidance:|Partial policy coverage|no extra vote/)
 assert.ok(container.querySelector('[aria-label="Fed previous meeting comparison"]'))
 assert.equal(container.querySelectorAll('[aria-label="Fed economic context inputs"] tbody tr').length,8,'One shared context table, without a duplicate generic panel')
 if (!container.querySelector('[aria-label="Use PPI v1"]')) await React.act(async () => container.querySelector('[aria-label="Advanced USD input settings"]').click())
 await React.act(async()=>container.querySelector('[aria-label="Use PPI v1"]').click())
 assert.equal(container.querySelector('[aria-label="Fed contextual pair direction"]').textContent,'Uncomputed')
 await React.act(async()=>saveContextFamilies(['ppi']))
 await React.act(async()=>root.render(React.createElement(FedScore,{...fedProps,now:fedAt-1})))
 assert.equal(container.querySelector('[aria-label="Fed contextual pair direction"]').textContent,'Uncomputed')
 assert.match(container.textContent,/already published chart time/)
 await React.act(async()=>root.render(React.createElement(PublicationContext,{release,events,now:release.releaseAt})))
 assert.match(container.textContent,/EURUSD Short/);assert.equal(container.querySelectorAll('[aria-label="Publication context inputs"] tbody tr').length,8)
 if (!container.querySelector('[aria-label="Use PPI v1"]')) await React.act(async () => container.querySelector('[aria-label="Advanced USD input settings"]').click())
 await React.act(async()=>container.querySelector('[aria-label="Use PPI v1"]').click())
 assert.deepEqual(readContextFamilies(),[])
 await React.act(async()=>root.render(React.createElement(PublicationContext,{release,events,now:release.releaseAt-1})))
 assert.match(container.textContent,/already published chart time/)
 localStorage.setItem(contextFamiliesKey,JSON.stringify({version:2,families:['cpi','nfp','claims','ism','retail']}))
 assert.equal(readContextFamilies().length,8)
 await React.act(async()=>saveContextFamilies(['cpi','nfp','claims','ism','retail']))
 assert.equal(readContextFamilies().length,5,'Deliberate new-family Off selections survive in version 3')
 const {FedRateAction}=await load('inspector/scoring/PAIR/EURUSD/USD/FED/ui/FedRateAction.tsx')
 const {assessFedScore}=await load('scoring-system/PAIR/EURUSD/USD/FED/assessment/fed-score.ts')
 for(const [actual, direction] of [[3.5,'EURUSD Long'],[4,'EURUSD Short']]) {
   const changed=groupInspectorReleases([fedRow(fedAt,actual)])[0],action=assessFedScore(changed)
   await React.act(async()=>root.render(React.createElement(FedRateAction,{action,eligible:true})))
   assert.equal(container.querySelector('[aria-label="Fed standalone direction"]').textContent,direction,'Simplifying holds must preserve rate-change directions')
   await React.act(async()=>root.render(React.createElement(FedRateAction,{action,eligible:true,path:{priorConsistent:false}})))
   assert.equal(container.querySelector('[aria-label="Fed standalone direction"]').textContent,'Uncomputed')
   assert.match(container.querySelector('[aria-label="Decision & rate action"]').textContent,/supplied prior conflicts/,'Prior inconsistencies stay visible in the primary view')
   await React.act(async()=>root.render(React.createElement(FedRateAction,{action,eligible:false})))
   assert.equal(container.querySelector('[aria-label="Fed rate action readings"]'),null,'Future readings stay unavailable')
 }
 console.log('✓ Expanded scorer views, live magnitude isolation/portability, Fed missing text, publication cutoff and eight-family preference migration')
}finally{
 await React.act(async()=>root.unmount());await server.close();await dom.happyDOM.abort();dom.close()
 for(const key of keys){if(previous[key])Object.defineProperty(globalThis,key,previous[key]);else delete globalThis[key]}
}
