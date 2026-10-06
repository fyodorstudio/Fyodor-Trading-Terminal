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
 const {PublicationContext}=await load('usd-context/ui/PublicationContext.tsx')
 const {inspectorScoringBinding}=await load('inspector/scoring/scoring-registry.ts')
 const {groupInspectorReleases}=await load('inspector/inspector-data.ts')
 const {ppiSignalSettings,gdpSignalSettings}=await load('inspector/scoring/shared/core/signal-magnitude-settings.ts')
 const {readContextFamilies,contextFamiliesKey,saveContextFamilies}=await load('usd-context/storage/context-family-settings.ts')
 const {exportWorkspace,restoreWorkspace,parseWorkspaceSnapshot}=await load('workspace-portability/workspace-snapshot.ts')
 const rows=m=>['840030001','840030002','840030003','840030004'].map((id,i)=>({value_id:id+'/'+m,event_id:id,name:id,event_code:id,server_time_seconds:Date.UTC(2015,m+1,14)/1000,release_at:Date.UTC(2015,m+1,14),period_seconds:Date.UTC(2015,m,1)/1000,revision:0,currency:'USD',country_code:'US',country_name:'United States',importance:'high',unit:1,multiplier:0,digits:1,time_mode:0,impact:'none',actual:m===42?i<2?.8:4:i<2?.2+m%3*.1:3+m%3*.1,previous:i<2?.2:3,forecast:null,revised_previous:null}))
 const events=Array.from({length:43},(_,m)=>rows(m)).flat(),release=groupInspectorReleases(rows(42))[0]
 await React.act(async()=>root.render(React.createElement(ExpandedReleaseScore,{release,events,history:{}})))
 assert.match(container.textContent,/EURUSD Short/);assert.equal(container.querySelectorAll('tbody tr').length,4);assert.equal(container.querySelector('details'),null)
 await React.act(async()=>ppiSignalSettings.save('core-pace',[.001,.002,.003]));assert.match(container.textContent,/custom boundaries/)
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
 await React.act(async()=>root.render(React.createElement(PublicationContext,{release,events,now:release.releaseAt})))
 assert.match(container.textContent,/EURUSD Short/);assert.equal(container.querySelectorAll('tbody tr').length,8)
 await React.act(async()=>container.querySelector('[aria-label="Use PPI v1"]').click())
 assert.deepEqual(readContextFamilies(),[])
 await React.act(async()=>root.render(React.createElement(PublicationContext,{release,events,now:release.releaseAt-1})))
 assert.match(container.textContent,/already published chart time/)
 localStorage.setItem(contextFamiliesKey,JSON.stringify({version:2,families:['cpi','nfp','claims','ism','retail']}))
 assert.equal(readContextFamilies().length,8)
 await React.act(async()=>saveContextFamilies(['cpi','nfp','claims','ism','retail']))
 assert.equal(readContextFamilies().length,5,'Deliberate new-family Off selections survive in version 3')
 console.log('✓ Expanded scorer views, live magnitude isolation/portability, Fed missing text, publication cutoff and eight-family preference migration')
}finally{
 await React.act(async()=>root.unmount());await server.close();await dom.happyDOM.abort();dom.close()
 for(const key of keys){if(previous[key])Object.defineProperty(globalThis,key,previous[key]);else delete globalThis[key]}
}
