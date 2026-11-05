import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

// Real storage projection -> production validation and mounted component.
// Terminal DOM tests only: no browser control, screenshots or visual inspection.
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), repo = path.dirname(frontend)
const python = path.join(repo, 'bridge/.venv/Scripts/python.exe')
const produced = spawnSync(python, ['-c', `
import json
from storage.tests.test_currency_details import DetailTests, payload
from storage.currency_details import DetailRefresh,save_details
t=DetailTests();t.setUp()
try:
 save_details(DetailRefresh.model_validate(payload()),t.directory,t.store)
 print(json.dumps({s:t.snapshot(s) for s in ['EURUSD','EURX','JPYX','USDX','GBPJPY','AUDCAD']}))
finally:t.doCleanups()
`], {cwd:repo,encoding:'utf8'})
assert.equal(produced.status,0,produced.stderr)
const fixtures=JSON.parse(produced.stdout)
const dom=new Window({url:'http://localhost:5173'})
const globals={window:dom,document:dom.document,navigator:dom.navigator,HTMLElement:dom.HTMLElement,Node:dom.Node,IS_REACT_ACT_ENVIRONMENT:true,__detailMetrics:0}
const previous=new Map([...Object.keys(globals),'fetch'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
for(const [k,v] of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v})
const requests=[],timers=new Map()
let sequence=0,closed=0,copied='',viewed=[]
dom.setTimeout=(fn,ms)=>{timers.set(++sequence,{fn,ms});return sequence}
dom.clearTimeout=id=>timers.delete(id)
globalThis.fetch=(url,options)=>new Promise(resolve=>requests.push({url,signal:options.signal,resolve}))
Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{copied=text}}})
const server=await createServer({root:frontend,server:{middlewareMode:true,hmr:false},plugins:[{
 name:'detail-work-count',enforce:'pre',transform(code,id){
  if(id.endsWith('/CurrencyDetailPanel.tsx'))return code.replace('  const m = metric,','  globalThis.__detailMetrics++; const m = metric,')
 }
}]})
const {createRoot}=await import('react-dom/client')
const container=document.createElement('div');document.body.append(container)
const root=createRoot(container)
let Panel,Provider
const onViewEvent=reading=>viewed.push(reading.value_id),onClose=()=>closed++
const render=async(symbol='EURUSD',brokerId='Pepperstone-Demo')=>React.act(async()=>root.render(React.createElement(Provider,{brokerId,brokerOffsetSeconds:7200,preference:{mode:'fixed-offset',utcOffsetMinutes:420,hour12:true}},React.createElement(Panel,{symbol,brokerId,onClose,onViewEvent}))))
const reply=async(request,value,status=200)=>React.act(async()=>request.resolve({ok:status===200,status,json:async()=>structuredClone(value)}))
const click=async node=>React.act(async()=>node.click())
const poll=async()=>{
 const [id,timer]=[...timers].find(([,t])=>t.ms===30000);timers.delete(id)
 await React.act(async()=>{void timer.fn()})
}
try{
 ({CurrencyDetailPanel:Panel}=await server.ssrLoadModule('./src/currency-details/CurrencyDetailPanel.tsx'))
 ;({DisplayClockProvider:Provider}=await server.ssrLoadModule('./src/appearance/time-display/DisplayClock.tsx'))
 const {validDetail,detailRefreshPrompt}=await server.ssrLoadModule('./src/currency-details/detail-model.ts')
 assert.equal(validDetail(fixtures.EURUSD,'Pepperstone-Demo',['EUR','USD']),true)
 for(const mutate of [v=>v.metrics.push(v.metrics[0]),v=>v.metrics[0].currency='BTC',v=>v.metrics[0].broker={},
  v=>v.metrics[0].next_releases=[{stage:'flash',date:'2026-99-99'}],v=>v.sources.ecb.url='javascript:alert(1)',
  v=>v.metrics.find(m=>m.official).official.sources[0].url='data:text/html,bad']){
  const bad=structuredClone(fixtures.EURUSD);mutate(bad);assert.equal(validDetail(bad,'Pepperstone-Demo',['EUR','USD']),false)
 }
 assert.match(detailRefreshPrompt('EURUSD'),/details prepare --scope EURUSD/)
 await render();await reply(requests.at(-1),fixtures.EURUSD)
 assert.deepEqual([...container.querySelectorAll('thead th')].map(n=>n.textContent),['Metric','EUR','USD'])
 assert.equal(container.querySelectorAll('tbody > tr').length,6)
 const inflation=container.querySelector('[data-detail-metric="eur.hicp-yoy"]')
 assert.equal(inflation.querySelector('strong').textContent,'4%')
 assert.match(inflation.textContent,/Source conflict/)
 assert.match(inflation.textContent,/MT5 actual 3.2%/)
 assert.match(inflation.textContent,/final/)
 assert.match(inflation.textContent,/time unconfirmed/)
 assert.match(inflation.textContent,/05:00 PM/,'Publication uses the selected Jakarta display clock')
 assert.equal(container.querySelector('[data-detail-metric="eur.gdp"] strong').textContent,'0%','Zero and quarterly observations beyond 31 days remain visible')
 assert.match(container.querySelector('[data-detail-metric="usd.cpi-yoy"]').textContent,/not independently checked/)
 assert.equal(container.querySelector('[data-detail-metric="eur.hicp-yoy"] [data-mt5-impact]'),null)
 await click([...inflation.querySelectorAll('button')].find(b=>b.textContent==='Open MT5 release'))
 assert.deepEqual(viewed,['eur-cpi'])
 await click(container.querySelector('footer button'));assert.match(copied,/EURUSD/)
 const firstMetric=inflation
 globalThis.__detailMetrics=0
 await poll()
 assert.match(requests.at(-1).url,/after_revision=/)
 await reply(requests.at(-1),{schema:1,broker:'Pepperstone-Demo',currencies:['EUR','USD'],revision:fixtures.EURUSD.revision,unchanged:true})
 assert.equal(globalThis.__detailMetrics,0,'Unchanged polling does no metric rendering')
 assert.equal(container.querySelector('[data-detail-metric="eur.hicp-yoy"]'),firstMetric)
 await poll();await reply(requests.at(-1),{},503)
 assert.match(container.querySelector('[role="alert"]').textContent,/503/)
 assert.equal(container.querySelector('[data-detail-metric="eur.hicp-yoy"]'),firstMetric)
 await poll();await reply(requests.at(-1),fixtures.EURUSD)
 assert.equal(container.querySelector('[role="alert"]'),null)
 for(const [symbol,currency] of [['EURX','EUR'],['JPYX','JPY'],['USDX','USD']]){
  await render(symbol);assert.equal(container.querySelector('table'),null,'Scope change hides stale evidence')
  await reply(requests.at(-1),fixtures[symbol])
  assert.deepEqual([...container.querySelectorAll('thead th')].map(n=>n.textContent),['Metric',currency])
  await click(container.querySelector('footer button'));assert.match(copied,new RegExp(`scope ${currency}`))
 }
 await render('GBPJPY');const obsolete=requests.at(-1)
 await render('AUDCAD');assert.equal(obsolete.signal.aborted,true)
 await reply(requests.at(-1),fixtures.AUDCAD);await reply(obsolete,fixtures.GBPJPY)
 assert.deepEqual([...container.querySelectorAll('thead th')].map(n=>n.textContent),['Metric','AUD','CAD'])
 await poll();await reply(requests.at(-1),{})
 assert.match(container.querySelector('[role="alert"]').textContent,/Invalid Detail/)
 await React.act(async()=>container.querySelector('aside').dispatchEvent(new dom.KeyboardEvent('keydown',{bubbles:true,key:'Escape'})))
 assert.equal(closed,1)
 await click(container.querySelector('[aria-label="Close Detail"]'));assert.equal(closed,2)
 const count=requests.length
 await render('BTCUSD');assert.match(container.textContent,/No currency Detail scope/);assert.equal(requests.length,count)
 await render('EURUSD',null);assert.match(container.textContent,/Connect a broker/);assert.equal(requests.length,count)
 await render();const last=requests.at(-1)
 await React.act(async()=>root.render(null));assert.equal(last.signal.aborted,true);assert.equal(timers.size,0)
 console.log('✓ Currency Detail: real projections, conflict provenance, latest quarterly values, clocks, pair/index scopes, independent local polling, cancellation and cleanup')
}finally{
 await React.act(async()=>root.unmount());await server.close();await dom.happyDOM.close()
 for(const [k,d] of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}
}
