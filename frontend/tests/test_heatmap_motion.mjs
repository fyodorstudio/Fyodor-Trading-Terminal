import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const dom=new Window({url:'http://localhost:5173'}),calls=[],active=new Set(),mediaListeners=new Set()
let reduced=false
const globals={window:dom,document:dom.document,localStorage:dom.localStorage,navigator:dom.navigator,HTMLElement:dom.HTMLElement,Node:dom.Node,IS_REACT_ACT_ENVIRONMENT:true}
const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]))
for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value})
dom.matchMedia=()=>({get matches(){return reduced},addEventListener:(_type,fn)=>mediaListeners.add(fn),removeEventListener:(_type,fn)=>mediaListeners.delete(fn)})
dom.HTMLElement.prototype.animate=function(keyframes,options){
  const animation={target:this,keyframes,options,onfinish:null,oncancel:null,
    cancel(){active.delete(this);this.oncancel?.()},finish(){active.delete(this);this.onfinish?.()}}
  calls.push(animation);active.add(animation);return animation
}
const server=await createServer({root:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),server:{middlewareMode:true,hmr:false}})
const {createRoot}=await import('react-dom/client'),host=document.createElement('div')
document.body.append(host);const root=createRoot(host)
const entries=values=>values.map((value,i)=>({row:{id:`symbol:TEST${i}`,label:`TEST${i}`,group:'Test',checkedAt:1,points:new Map()},
  point:{value,relative:value,coverage:1,from:'2026-11-16',through:'2026-11-17',start:100,open:100,high:102,low:98,close:100+(value??0),checkedAt:1,reason:''}}))
const finish=()=>{for(const animation of [...active])animation.finish();calls.length=0}
try{
  const {HeatmapRanking}=await server.ssrLoadModule('./src/heatmap/HeatmapRanking.tsx')
  const {readHeatmapPreferences}=await server.ssrLoadModule('./src/heatmap/heatmap-preferences.ts')
  let current={entries:entries([-.5,.2]),fields:['C'],heading:'2026-11-17',status:'In progress',groups:['Test'],group:'All',onGroup(){},
    preferences:readHeatmapPreferences('motion'),onChange(){},eventMode:false,actions:null,onOpenRow(){},animate:true,motionScope:'daily:2026-11-17'}
  const render=overrides=>React.act(async()=>{current={...current,...overrides};root.render(React.createElement(HeatmapRanking,current))})
  await render({})
  document.documentElement.dataset.theme='light'
  assert.equal(calls.length,0,'Opening the panel does not flash initial readings')
  await render({entries:entries([-.4,.2])})
  assert.equal(calls.length,1,'A changed C flashes the whole instrument block once')
  const rise=calls[0]
  assert.ok(rise.target.classList.contains('heatmap-ranking-entry'))
  assert.equal(rise.keyframes[0].backgroundColor,'rgba(100, 116, 139, 0.30)','Light mode uses a visible neutral gray')
  assert.equal(rise.keyframes.at(-1).backgroundColor,'transparent','The block fades back to its normal appearance')
  assert.ok(rise.target.querySelector('[data-rank-field="C"]').classList.contains('negative'),'The flash preserves the number color')
  assert.equal(rise.options.duration,450)
  finish()
  await render({entries:entries([-.4001,.2])})
  assert.equal(calls.length,0,'Changes hidden by displayed rounding do not flash')
  await render({entries:entries([-.4001,.1])})
  assert.equal(calls[0].keyframes[0].backgroundColor,'rgba(100, 116, 139, 0.30)','Increases and decreases both use neutral gray')
  finish()
  document.documentElement.dataset.theme='dark'
  await render({entries:entries([-.4001,.15])})
  assert.equal(calls[0].keyframes[0].backgroundColor,'rgba(226, 232, 240, 0.28)','Dark mode uses a white-ish gray')
  finish()
  await render({fields:['O','H','L','C']})
  assert.equal(calls.length,0,'Changing visible fields resets the comparison')
  const highChanged=entries([-.4001,.15]);highChanged[0].point.high=103
  await render({entries:highChanged})
  assert.equal(calls.length,1,'An H-only update also flashes the whole block')
  assert.ok(calls[0].target.classList.contains('heatmap-ranking-entry'))
  finish()
  const severalChanged=entries([-.3,.15]);severalChanged[0].point.high=104;severalChanged[0].point.low=97
  await render({entries:severalChanged})
  assert.equal(calls.length,1,'Several changed fields in the same instrument trigger just one flash')
  finish()
  await render({motionScope:'daily:2026-11-16',entries:entries([1,2])})
  await render({group:'Test',entries:entries([2,3])})
  await render({preferences:{...current.preferences,rank:'lowest'},entries:[...current.entries].reverse()})
  assert.equal(calls.length,0,'Date, filter, and sort changes do not masquerade as market updates')
  await render({fields:['C'],preferences:{...current.preferences,rankingView:'bars'},entries:entries([-.4,1])})
  assert.equal(calls.length,0,'Switching to Bars does not flash')
  await render({entries:entries([-.3,1])})
  assert.equal(calls.length,1,'Bars use the same single block flash')
  assert.ok(calls[0].target.classList.contains('heatmap-ranking-entry'),'There are no separate number or endpoint effects')
  assert.ok(calls.every(call=>call.target.closest('[data-ranking-row]').dataset.rankingRow==='symbol:TEST0'),'Unchanged instruments do not flash')
  await render({motionScope:'daily:2026-11-15'})
  assert.equal(active.size,0,'Changing period cancels effects from the previous period')
  calls.length=0
  await render({animate:false,entries:entries([-.2,1])})
  await render({entries:entries([-.1,2])})
  assert.equal(calls.length,0,'The bottom-dock ranking runs no motion effects')
  await render({animate:true})
  await render({entries:entries([0,2])})
  assert.ok(active.size>0,'Effects resume on subsequent right-panel data updates')
  await React.act(async()=>{reduced=true;for(const listener of mediaListeners)listener()})
  assert.equal(active.size,0,'Enabling reduced motion immediately cancels ongoing effects')
  calls.length=0
  await render({entries:entries([.1,3])})
  assert.equal(calls.length,0,'Reduced motion suppresses flashes and movement')
  reduced=false
  await render({entries:entries([.2,3])})
  assert.ok(active.size>0)
  await React.act(async()=>root.unmount())
  assert.equal(active.size,0,'Unmounting cancels all native animations')
  assert.equal(mediaListeners.size,0)
  console.log('✓ Ranking motion: right-panel-only gray block flashes in both themes, rounding, field updates, period/filter/view resets, reduced motion and cleanup')
}finally{
  await React.act(async()=>root.unmount());await server.close();await dom.happyDOM.close()
  for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
}
