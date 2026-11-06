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
from storage.tests.test_currency_details import DetailTests, payload, NOW, event
from storage.detail_registry import registry
from storage.currency_details import DetailRefresh,save_details
t=DetailTests();t.setUp()
try:
 save_details(DetailRefresh.model_validate(payload()),t.directory,t.store)
 rows=[]
 for currency,value in [('USD',4),('CAD',2.5)]:
  metric=next(m for m in registry()['metrics'] if m['id']==currency.lower()+'.rate')
  for i in range(2):
   rows.append(event(value_id=currency+str(i),event_id=metric['broker_event_id'],currency=currency,country_code=metric['broker_country'],server_time_seconds=NOW//1000-86400-i*40*86400+7200,period_seconds=0,actual=value-i*.25,previous=value-.25-i*.25,forecast=None))
 t.store.import_rows('history','Pepperstone-Demo',{**t.manifest,'calendar_currencies':'USD,CAD'}, {}, rows)
 print(json.dumps({s:t.snapshot(s) for s in ['EURUSD','EURX','JPYX','USDX','GBPJPY','AUDCAD','USDCAD']}))
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
 const {calendarTier,eventPublisher}=await server.ssrLoadModule('./src/event-tiers/event-tiers.ts')
 assert.equal(calendarTier({event_id:'840030005',currency:'USD',country_code:'US',importance:'low',name:'Renamed'}),'S')
 assert.equal(calendarTier({event_id:'840030005',currency:'EUR',country_code:'US'}),'C','Wrong currency never borrows a tier')
 assert.equal(eventPublisher({event_id:'840030005',currency:'EUR',country_code:'US'}),undefined)
 assert.equal(calendarTier({event_id:'new-id',currency:'USD',country_code:'US'}),'C','Unknown series stay admitted with the secondary fallback')
 assert.equal(validDetail(fixtures.EURUSD,'Pepperstone-Demo',['EUR','USD']),true)
 for(const mutate of [v=>v.metrics.push(v.metrics[0]),v=>v.metrics[0].currency='BTC',v=>v.metrics[0].broker={},
  v=>v.metrics[0].next_releases=[{stage:'flash',date:'2026-99-99'}],v=>v.sources.ecb.url='javascript:alert(1)',
  v=>v.metrics.find(m=>m.official).official.sources[0].url='data:text/html,bad']){
  const bad=structuredClone(fixtures.EURUSD);mutate(bad);assert.equal(validDetail(bad,'Pepperstone-Demo',['EUR','USD']),false)
 }
 assert.match(detailRefreshPrompt('EURUSD'),/details prepare --scope EURUSD/)
 const preview=structuredClone(fixtures.EURUSD)
 const previewInflation=preview.metrics.find(m=>m.id==='eur.hicp-yoy')
 Object.assign(previewInflation.broker,{previous:3,revised_previous:3.1,forecast:9.9})
 previewInflation.broker_next.forecast=0
 // A saved official quarter newer than the last broker quarter cannot borrow its previous value.
 const previewGdp=preview.metrics.find(m=>m.id==='eur.gdp')
 previewGdp.official={...structuredClone(previewInflation.official),period:'2026-07-01',value:0}
 previewGdp.official_latest=true
 previewGdp.broker.previous=123
 await render();await reply(requests.at(-1),preview)
 assert.deepEqual([...container.querySelectorAll('thead th')].map(n=>n.textContent),['EUR','USD'])
 assert.deepEqual([...container.querySelectorAll('[data-detail-tier]')].map(n=>n.dataset.detailTier),['S','A','B','C'])
 for(const heading of container.querySelectorAll('.detail-tier-heading th'))assert.equal(heading.colSpan,2,'Tier sections span both currency columns')
 const inflation=container.querySelector('[data-detail-metric="eur.hicp-yoy"]')
 assert.equal(inflation.querySelector('strong').textContent,'4%')
 assert.deepEqual([...inflation.querySelectorAll('.detail-values > div > span:first-child')].map(n=>n.textContent),['Previous reading','Latest actual','Next upcoming forecast'])
 assert.deepEqual([...inflation.querySelectorAll('.detail-number')].map(n=>n.textContent.replace('⚠','')),['3.1%','4%','0%'],'Use revised previous, official actual and the next release forecast, including zero')
 assert.equal(container.querySelector('[data-detail-metric="eur.gdp"] .detail-number').textContent,'—','An older broker vintage supplies no previous value for a newer official actual')
 assert.equal(container.querySelector('[data-detail-metric="usd.cpi-yoy"] .detail-values > div:last-child .detail-number').textContent,'—','Missing next forecasts never borrow the released event forecast')
 assert.equal(inflation.querySelector('[aria-label="Source conflict"]').textContent,'⚠')
 assert.match(inflation.querySelector('[aria-label="Source conflict"]').title,/publisher 4%.*captured value 3.2%/)
 assert.match(inflation.querySelector('a').href,/ec.europa.eu/)
 assert.equal(inflation.querySelectorAll('.detail-field').length,3)
 for(const text of ['Source conflict','MT5','not independently checked','Verified','partial:','Reference','Next major releases'])
  assert.ok(!container.textContent.includes(text),text+' is absent from the compact table')
 assert.equal(container.querySelector('tbody button[aria-expanded]'),null,'No category expanders')
 for(const row of container.querySelectorAll('.detail-comparison tbody tr:not(.detail-tier-heading)'))assert.equal(row.querySelectorAll('td').length,2,'Both currencies share the same event row geometry')
 assert.match(inflation.textContent,/05:00 PM/,'Publication uses the selected Jakarta display clock')
 assert.equal(container.querySelector('[data-detail-metric="eur.gdp"] strong').textContent,'0%','Zero and quarterly observations beyond 31 days remain visible')
 assert.match(container.querySelector('[data-detail-metric="usd.cpi-yoy"] a').href,/bls.gov/)
 assert.equal(container.querySelector('[data-detail-metric="eur.hicp-yoy"] [data-mt5-impact]'),null)
 await click(inflation.querySelector('[aria-label="Open released Headline HICP YoY"]'))
 assert.deepEqual(viewed,['eur-cpi'])
 const beforeInfo=requests.length
 await click([...container.querySelectorAll('button')].find(b=>b.textContent==='Tier List Info'))
 assert.ok(container.querySelector('.detail-comparison').closest('[hidden]'))
 assert.deepEqual([...container.querySelectorAll('[aria-label="Currency tier reference"] tbody th')].map(n=>n.textContent),['EUR','USD'])
 assert.match(container.querySelector('[aria-label="Tier list reference"]').textContent,/C — secondary.*Routine minor surveys/s)
 assert.match(container.querySelector('[aria-label="Currency tier reference"]').textContent,/German inflation as an early input/)
 assert.equal(container.querySelector('footer'),null)
 assert.equal(requests.length,beforeInfo,'Info is local static reference only')
 await click(container.querySelector('[aria-label="Close Tier List Info"]'))
 assert.equal(document.activeElement.textContent,'Tier List Info','Info close restores focus to its trigger')
 assert.equal(container.querySelector('[data-detail-metric="eur.hicp-yoy"]'),inflation,'Returning preserves the comparison DOM')
 assert.equal(closed,0,'Closing Info does not close Detail')
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
  assert.deepEqual([...container.querySelectorAll('thead th')].map(n=>n.textContent),[currency])
  await click(container.querySelector('footer button'));assert.match(copied,new RegExp(`scope ${currency}`))
  await click([...container.querySelectorAll('button')].find(b=>b.textContent==='Tier List Info'))
  assert.deepEqual([...container.querySelectorAll('[aria-label="Currency tier reference"] tbody th')].map(n=>n.textContent),[currency])
  await React.act(async()=>container.querySelector('aside').dispatchEvent(new dom.KeyboardEvent('keydown',{bubbles:true,key:'Escape'})))
  assert.equal(container.querySelector('[aria-label="Tier list reference"]'),null)

 }
 await render('USDCAD');await reply(requests.at(-1),fixtures.USDCAD)
 assert.ok(container.querySelector('.detail-decision-table'),'USD/CAD uses decision anchors')
 assert.equal(container.querySelectorAll('[data-policy-decision]').length,4)
 assert.match(container.querySelector('[data-policy-decision="USD0"]').textContent,/Fed target upper boundActual4%Forecast—Previous3.75%/)
 assert.match(container.querySelector('[data-policy-decision="CAD0"]').textContent,/BoC overnight targetActual2.5%Forecast—Previous2.25%/)
 assert.equal(container.querySelectorAll('.detail-history-placeholder').length,20,'Historical fundamentals remain unpopulated, with no current readings leaked')
 assert.match(container.querySelector('.detail-history-intro').textContent,/2026-05-05.*2026-11-05/)
 const scroll=container.querySelector('.detail-history-scroll')
 scroll.scrollLeft=246
 await click(container.querySelector('[data-policy-decision="CAD0"] button'))
 assert.equal(viewed.at(-1),'CAD0')
 await click([...container.querySelectorAll('button')].find(b=>b.textContent==='Tier List Info'))
 await click(container.querySelector('[aria-label="Close Tier List Info"]'))
 assert.equal(container.querySelector('.detail-history-scroll'),scroll)
 assert.equal(scroll.scrollLeft,246,'Info preserves horizontal history position')
 await poll();await reply(requests.at(-1),{schema:1,broker:'Pepperstone-Demo',currencies:['USD','CAD'],revision:fixtures.USDCAD.revision,unchanged:true})
 assert.equal(scroll.scrollLeft,246,'Unchanged polling preserves horizontal position')
 for(const mutate of [v=>v.policy_history.decisions.USD[0].source_url='javascript:bad',v=>v.policy_history.decisions.USD[0].value=null,
  v=>v.policy_history.decisions.EUR=[],v=>v.policy_history.decisions.USD.push(v.policy_history.decisions.USD[0])]){
  const bad=structuredClone(fixtures.USDCAD);mutate(bad);assert.equal(validDetail(bad,'Pepperstone-Demo',['USD','CAD']),false)
 }
 await render('GBPJPY');const obsolete=requests.at(-1)
 await render('AUDCAD');assert.equal(obsolete.signal.aborted,true)
 await reply(requests.at(-1),fixtures.AUDCAD);await reply(obsolete,fixtures.GBPJPY)
 assert.deepEqual([...container.querySelectorAll('thead th')].map(n=>n.textContent),['AUD','CAD'])
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
