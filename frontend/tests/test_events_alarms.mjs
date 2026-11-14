import assert from 'node:assert/strict'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import React from 'react'
import {createServer} from 'vite'
import {Window} from 'happy-dom'
const dom=new Window({url:'http://localhost:5173'}),globals={window:dom,document:dom.document,navigator:dom.navigator,localStorage:dom.localStorage,HTMLElement:dom.HTMLElement,Node:dom.Node,IS_REACT_ACT_ENVIRONMENT:true}
const previous=new Map([...Object.keys(globals),'fetch'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v})
const now=Date.now(),at=now+60000,calls=[],broker='Pepperstone-Demo'
const row=(id,event_id)=>({value_id:id,event_id,name:'CPI '+id,currency:'USD',country_code:'US',country_name:'United States',event_code:'cpi',release_at:at,server_time_seconds:at/1000+7200,chart_time_seconds:null,period_seconds:0,revision:0,actual:null,forecast:.2,previous:.1,revised_previous:null,unit:1,multiplier:0,digits:1,time_mode:0,impact:'none',importance:'high',availability:'observed'})
const events=[row('1','840030005'),row('2','840030006')]
const alarms={application:'fyodor-alarms',schedule_schema:2,revision:1,now,native_available:true,settings:{enabled:true,release_minutes:2},schedule_error:null,refreshed_at:now/1000,events:[],jobs:[]}
globalThis.fetch=async(url,options={})=>{calls.push([url,options]);const query=new URL(url,'http://localhost')
 if(url.startsWith('/alarm-api/alarms')){if(options.method==='POST'){const action=JSON.parse(options.body);assert.equal(action.action,'subscribe');assert.deepEqual(action.value_ids,['1','2']);alarms.revision++;alarms.events=[{key:'calendar:fixture',reference:'fixture',source:'calendar',broker,title:'CPI',value_ids:['1','2'],currencies:['USD'],at,date:null,eligible:true,selected:true,armed:true,note:'Calendar release'}]}return{ok:true,json:async()=>structuredClone(alarms)}}
 if(query.pathname==='/storage-api/alert-calendar')return{ok:true,json:async()=>({source_id:broker,date:query.searchParams.get('date'),revision:'1',events,source:{publisher_status:'live'},coverage:{}})}
 throw new Error('Unexpected request '+url)}
const server=await createServer({root:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),server:{middlewareMode:true},appType:'custom'})
const{createRoot}=await import('react-dom/client'),{EventsDock}=await server.ssrLoadModule('./src/events-alarms/EventsDock.tsx')
const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
try{
 await React.act(async()=>root.render(React.createElement(EventsDock,{brokerId:broker})))
 assert.deepEqual([...host.querySelectorAll('thead th')].map(n=>n.textContent),['Time · Jakarta','Event','Actual','Forecast','Previous','Alarm'])
 assert.equal(host.querySelectorAll('.alert-summary-row').length,2);assert.equal(host.querySelectorAll('.event-alarm-toggle').length,1)
 assert.doesNotMatch(host.textContent,/Ongoing risks|Legacy pins|Tier|prompt|assessment/i)
 const bell=host.querySelector('.event-alarm-toggle');assert.equal(bell.disabled,false);await React.act(async()=>bell.click());assert.equal(host.querySelector('.event-alarm-toggle').getAttribute('aria-pressed'),'true')
 await React.act(async()=>host.querySelector('.alert-event-name').click());assert.ok(host.querySelector('.alert-event-details'))
 assert.ok(calls.every(([url])=>url.startsWith('/alarm-api/alarms')||url.startsWith('/storage-api/alert-calendar')))
 console.log('✓ Plain Alert: raw calendar rows, one package bell, subscription and row details')
}finally{await React.act(async()=>root.unmount());await server.close();await dom.happyDOM.close();for(const[k,d]of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}}
