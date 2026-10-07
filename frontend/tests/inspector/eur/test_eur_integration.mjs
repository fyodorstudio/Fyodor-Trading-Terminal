import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
import path from 'node:path'
import React from 'react'
import {Window} from 'happy-dom'
import {createServer} from 'vite'
import {history,latestRows} from '../../usd-context/fixtures.mjs'
const server=await createServer({root:path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'),server:{middlewareMode:true,hmr:false}})
const dom=new Window({url:'http://localhost:5173'})
const keys=['window','document','HTMLElement','Node','navigator','localStorage','IS_REACT_ACT_ENVIRONMENT','Worker','fetch','ResizeObserver']
const previous=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
for(const key of keys.slice(0,7))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:key==='window'?dom:key==='document'?dom.document:key==='IS_REACT_ACT_ENVIRONMENT'?true:dom[key]})
const workers=[],requests=[],frames=new Map();let handler,frame=0
window.requestAnimationFrame=fn=>{frames.set(++frame,fn);return frame};window.cancelAnimationFrame=id=>frames.delete(id)
globalThis.ResizeObserver=class{observe(){}disconnect(){}}
globalThis.Worker=class{jobs=[];terminated=false;constructor(){workers.push(this)}postMessage(v){this.jobs.push(v)}terminate(){this.terminated=true}}
const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
const eur=Array.from({length:42},(_,m)=>['999030012','999030013'].map((id,i)=>({value_id:id+'/'+m,event_id:id,event_code:id,name:id,currency:'EUR',country_code:'EU',country_name:'Euro area',unit:1,multiplier:0,digits:1,time_mode:0,revision:1,importance:'high',impact:'none',actual:2+m%5*.1+i*.1,previous:2,forecast:null,revised_previous:null,period_seconds:Date.UTC(2015,m,1)/1000,release_at:Date.UTC(2015,m+1,14),server_time_seconds:Date.UTC(2015,m+1,14)/1000,chart_time_seconds:Date.UTC(2015,m+1,14)/1000}))).flat()
try{
 const load=p=>server.ssrLoadModule('./src/'+p)
 const {Raycaster}=await load('raycaster/Raycaster.tsx'),{buildContextTimeline}=await load('usd-context/core/build-context-timeline.ts')
 const {buildEurContextTimeline}=await load('pair-context/core/eur-context-timeline.ts'),{relativeContext,eurContextAt}=await load('pair-context/core/relative-context.ts')
 const {contextAt}=await load('usd-context/core/context-lookup.ts')
 const pref=await load('pair-context/storage/relative-preferences.ts')
 const {exportWorkspace,restoreWorkspace,parseWorkspaceSnapshot}=await load('workspace-portability/workspace-snapshot.ts')
 globalThis.fetch=async url=>{requests.push(url);if(url.endsWith('/health'))return{ok:true,json:async()=>({revision:1,sources:[{id:'relative-broker',server_now:Date.UTC(2018,7,1)/1000}]})}
  const params=new URL(url,'http://localhost').searchParams,events=params.get('currencies')==='EUR' || params.get('currency')==='EUR'?eur:[...history,...latestRows]
  return{ok:true,json:async()=>({source_id:'relative-broker',revision:1,time_basis:'chart',timestamp_convention:'trade_server_time',event_ids:params.get('event_ids').split(','),events,coverage:{},next_cursor:null})}}
 const series={},props={chartApi:{subscribeCrosshairMove(fn){handler=fn},unsubscribeCrosshairMove(){}},seriesApi:series,symbol:'EURUSD',timeframe:'H1',brokerId:'relative-broker',brokerOffsetSeconds:0,clockOffsetMs:Date.UTC(2018,7,1)-Date.now(),timeDisplay:{mode:'utc',utcOffsetMinutes:0},onClose(){}}
 const render=(next=props)=>React.act(async()=>root.render(React.createElement(Raycaster,next)))
 await render();assert.equal(workers.length,1,'USD default does not load EUR calculation')
 const usdWorker=workers[0],usdInput=usdWorker.jobs[0].input,usdTimeline=buildContextTimeline(usdInput)
 await React.act(async()=>usdWorker.onmessage({data:{id:1,result:usdTimeline}}))
 await React.act(async()=>host.querySelector('[aria-label="Raycaster calculation and inputs"]').click())
 const selector=host.querySelector('[aria-label="Raycaster context view"]');assert.equal(selector.value,'usd')
 await React.act(async()=>{selector.value='relative';selector.dispatchEvent(new dom.Event('change',{bubbles:true}))})
 assert.equal(workers.length,2);assert.equal(usdWorker.jobs.length,1,'Mode changes reuse USD calculation')
 const eurWorker=workers[1],eurInput=eurWorker.jobs[0].input
 assert.ok(eurInput.events.every(e=>e.currency==='EUR'),'EUR request remains scoped')
 const eurTimeline=buildEurContextTimeline(eurInput)
 await React.act(async()=>eurWorker.onmessage({data:{id:1,result:eurTimeline}}))
 const open=Date.UTC(2018,6,1)/1000
 await React.act(async()=>{handler({time:open,point:{x:1,y:1},seriesData:new Map([[series,{}]])});for(const [id,fn]of frames){frames.delete(id);fn()}})
 const cutoff=(open+3600)*1000,expected=relativeContext(eurContextAt(eurTimeline,cutoff),contextAt(usdTimeline,cutoff))
 assert.ok(host.querySelector('.raycaster-bias').textContent.startsWith(expected.label))
 assert.ok(host.querySelector('[aria-label="EUR relative context inputs"]'))
 const exportValue=exportWorkspace();assert.equal(JSON.parse(exportValue.entries[pref.relativePreferencesKey]).mode,'relative')
 assert.throws(()=>parseWorkspaceSnapshot(JSON.stringify({...exportValue,entries:{[pref.relativePreferencesKey]:'{"mode":"relative","families":["bad"]}'}})),/Invalid/)
 await React.act(async()=>{pref.saveRelativePreferences({mode:'usd',families:[]});restoreWorkspace(exportValue)})
 assert.equal(pref.readRelativePreferences().mode,'relative')
 await render({...props,symbol:'USDJPY'});assert.equal(host.querySelector('[aria-label="Raycaster context view"]').disabled,true)
 assert.equal(workers.length,2,'Other USD pairs never dispatch an EUR context calculation')
 await render();assert.equal(workers.length,2,'Returning to EURUSD reuses completed EUR work')
 if (!host.querySelector('[aria-label="Use Euro-area inflation v1"]')) await React.act(async () => host.querySelector('[aria-label="Advanced EUR input settings"]').click())
 await React.act(async()=>host.querySelector('[aria-label="Use Euro-area inflation v1"]').click())
 assert.equal(workers.length,3,'EUR input changes invalidate only EUR calculation');assert.equal(usdWorker.jobs.length,1)
 console.log('✓ Relative view selection, scoped workers, USD reuse, historical output parity, independent EUR inputs, other-pair isolation and workspace portability')
}finally{await React.act(async()=>root.unmount());await server.close();await dom.happyDOM.abort();dom.close();for(const [key,value]of Object.entries(previous)){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key]}}
