import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const fixture = JSON.parse(execFileSync(path.join(repo,'bridge/.venv/Scripts/python.exe'),['-c',`
import json
from storage.tests.test_recommended_pairs import RecommendedPairsTests
from storage.thesis_research import ResearchRequest, append_research
from storage.recommended_pairs import recommended_pairs
f=RecommendedPairsTests();f.setUp()
try:
    request=f.request()
    request['assessments'][1]['evaluation']['relative_preferences'][0]['daily_close']=f.daily_close()
    append_research(ResearchRequest(**request),f.path)
    print(json.dumps(recommended_pairs(f.path)))
finally:f.doCleanups()
`],{cwd:repo,encoding:'utf8'}))
const dom = new Window({url:'http://localhost:5173'})
const globals = {window:dom,document:dom.document,navigator:dom.navigator,localStorage:dom.localStorage,HTMLElement:dom.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true}
const previous = new Map([...Object.keys(globals),'fetch'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
for(const [key,value] of Object.entries(globals)) Object.defineProperty(globalThis,key,{configurable:true,writable:true,value})
let now=Date.parse('2026-07-22T10:01:00Z'), sequence=0, offline=false, malformed=false, hold=false
const realNow=Date.now;Date.now=()=>now
const timers=new Map(),intervals=new Map(),requests=[],held=[]
dom.setTimeout=(fn,ms)=>{timers.set(++sequence,{fn,ms});return sequence}
dom.clearTimeout=id=>timers.delete(id)
dom.setInterval=(fn,ms)=>{intervals.set(++sequence,{fn,ms});return sequence}
dom.clearInterval=id=>intervals.delete(id)
let snapshot=structuredClone(fixture)
function response(url){return offline ? {ok:false,status:503} : {ok:true,json:async()=>malformed ? {...snapshot,items:[{...snapshot.items[0],evidence:[]}]} : url.includes(`after_revision=${snapshot.revision}`) ? {schema:1,revision:snapshot.revision,unchanged:true} : structuredClone(snapshot)}}
globalThis.fetch=async(url,options={})=>{requests.push({url,options});return hold ? new Promise(resolve=>held.push({resolve,url,options})) : response(url)}
const server=await createServer({root:path.join(repo,'frontend'),server:{middlewareMode:true,hmr:false}})
const {createRoot}=await import('react-dom/client')
const container=document.createElement('div');document.body.append(container);const root=createRoot(container)
const poll=async()=>{const [id,t]=[...timers][0];timers.delete(id);await React.act(async()=>t.fn())}
const tick=async()=>React.act(async()=>{for(const t of intervals.values())t.fn()})
try{
  const {RecommendedPairs}=await server.ssrLoadModule('/src/thesis/RecommendedPairs.tsx')
  const {validRecommendedPairs,recommendationState}=await server.ssrLoadModule('/src/thesis/recommended-pairs-model.ts')
  assert.equal(validRecommendedPairs(fixture),true,'Production writer and projection satisfy the UI contract')
  for(const fields of [{until_utc:fixture.items[0].starts_at},{pair:'CHFGBP'},{intensity:'extreme'},{rank:0},{evidence:[fixture.items[0].evidence[0],fixture.items[0].evidence[0]]}]){
    const v=structuredClone(fixture);Object.assign(v.items[0],fields);assert.equal(validRecommendedPairs(v),false)
  }
  const unsafe=structuredClone(fixture);unsafe.items[0].evidence[0].sources[0].locator='javascript:alert(1)';assert.equal(validRecommendedPairs(unsafe),false)
  const legacy=structuredClone(fixture);legacy.items[0].intensity=null;legacy.items[0].rank=null;assert.equal(validRecommendedPairs(legacy),true)
  delete legacy.items[0].daily_close;assert.equal(validRecommendedPairs(legacy),true,'Earlier recommendations remain readable without a daily forecast')
  for(const change of [{open_price:0},{observed_price:NaN},{color:'blue'},{observed_utc:'2026-07-22T10:01:00Z'}]){
    const bad=structuredClone(fixture);Object.assign(bad.items[0].daily_close,change);assert.equal(validRecommendedPairs(bad),false)
  }
  assert.match(recommendationState({...fixture.items[0],status:'superseded'},now),/currency updated/)
  let selected=null
  const props={symbols:[{symbol:'GBPCHF.a',description:'GBPCHF',bid:1,ask:1,dailyChange:0,precision:5}],onSelectSymbol:s=>{selected=s}}
  await React.act(async()=>root.render(React.createElement(RecommendedPairs,props)))
  assert.match(container.textContent,/Recommended Pairs.*GBPCHF · BUY · Moderate/s)
  assert.match(container.textContent,/Current/)
  assert.match(container.textContent,/Opposition:.*Invalidation:/s)
  assert.match(container.textContent,/D1 target: RED.*D1 open 1.2.*observed 1.19/s)
  assert.match(container.textContent,/Probability: uncalibrated/)
  assert.match(container.textContent,/GBP evidence:.*CHF evidence:/s)
  assert.match(container.textContent,/5:30\s*PM/,'The earlier CHF checkpoint caps the window')
  const row=container.querySelector('[data-recommended-pair]')
  await poll();assert.equal(container.querySelector('[data-recommended-pair]'),row,'Unchanged polling retains rows')
  await React.act(async()=>container.querySelector('h3 button').click());assert.equal(selected,'GBPCHF.a','Uses the actual broker symbol')
  now=Date.parse(fixture.items[0].until_utc);await tick();assert.match(container.textContent,/checkpoint passed/)
  snapshot={...fixture,revision:'superseded',items:[{...fixture.items[0],status:'superseded'}]};await poll();assert.match(container.textContent,/currency updated/)
  malformed=true;await poll();assert.match(container.querySelector('[role="alert"]').textContent,/Invalid/)
  assert.match(container.textContent,/connection unavailable/,'A failed refresh cannot advertise Current')
  malformed=false;offline=true;await poll();assert.match(container.textContent,/Last loaded comparisons may be outdated/)
  offline=false
  const toggle=container.querySelector('h2 button');await React.act(async()=>toggle.click());assert.equal(toggle.getAttribute('aria-expanded'),'false')
  assert.equal(localStorage.getItem('fyodor.recommended-pairs.collapsed.v1'),'true')
  await React.act(async()=>root.render(null));await React.act(async()=>root.render(React.createElement(RecommendedPairs,props)))
  assert.equal(container.querySelector('h2 button').getAttribute('aria-expanded'),'false')
  hold=true
  const [timerId,timer]=[...timers][0];timers.delete(timerId)
  await React.act(async()=>{void timer.fn()})
  await React.act(async()=>root.render(null))
  assert.equal(held[0].options.signal.aborted,true)
  await React.act(async()=>held[0].resolve(response(held[0].url)))
  assert.equal(timers.size,0);assert.equal(intervals.size,0)
  hold=false;snapshot={schema:1,revision:'empty',items:[]}
  await React.act(async()=>root.render(React.createElement(RecommendedPairs,props)))
  assert.match(container.textContent,/No researched pair recommendations saved/)
  console.log('✓ Recommended pairs: real ledger contract, both currencies, exact windows, chart selection, expiry, supersession, stale data, persistence and cleanup')
}finally{
  await React.act(async()=>root.unmount());await server.close();await dom.happyDOM.close();Date.now=realNow
  for(const [k,d] of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}
}
