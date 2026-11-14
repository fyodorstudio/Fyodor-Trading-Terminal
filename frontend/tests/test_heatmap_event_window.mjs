import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const dom=new Window({url:'http://localhost:5173'}),timers=new Map(),pending=[],observers=new Set()
let serial=0,copied='',visits=0
class ResizeObserver { constructor(fn){this.fn=fn;observers.add(this)} observe(){} disconnect(){observers.delete(this)} }
const globals={window:dom,document:dom.document,localStorage:dom.localStorage,navigator:dom.navigator,HTMLElement:dom.HTMLElement,Node:dom.Node,ResizeObserver,IS_REACT_ACT_ENVIRONMENT:true,__eventVisit:()=>visits++}
const previous=new Map([...Object.keys(globals),'fetch'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value})
const originalNow=Date.now,now=Date.parse('2026-11-12T12:00:00Z')
Date.now=()=>now
dom.setTimeout=(fn,ms)=>{timers.set(++serial,{fn,ms});return serial};dom.clearTimeout=id=>timers.delete(id)
dom.requestAnimationFrame=fn=>{fn();return ++serial};dom.cancelAnimationFrame=()=>{}
Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>copied=text}})
globalThis.fetch=(url,options)=>url.includes('wildcards')?Promise.resolve({ok:true,json:async()=>({schema:1,revision:0,items:[]})}):new Promise(resolve=>pending.push({url,options,body:JSON.parse(options.body),resolve}))
const frontend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const server=await createServer({root:frontend,server:{middlewareMode:true,hmr:false},plugins:[{name:'minute-work',enforce:'pre',transform(code,id){if(id.endsWith('/event-window.ts'))return code.replace('for(const bar of record.bars) {','for(const bar of record.bars) { globalThis.__eventVisit();')}}]})
const {createRoot}=await import('react-dom/client'),host=document.createElement('div'),target=document.createElement('div')
document.body.append(host,target);const root=createRoot(host)
const props=node=>node[Object.getOwnPropertyNames(node).find(k=>k.startsWith('__reactProps$'))]
const click=node=>React.act(async()=>{assert.ok(node);node.click()})
const change=(node,value)=>React.act(async()=>{ assert.ok(node); if(props(node))props(node).onChange({target:{value}});else {node.value=value;node.dispatchEvent(new dom.Event('change',{bubbles:true}))} })
const check=node=>React.act(async()=>props(node).onChange({target:{checked:!node.checked}}))
const button=(label,scope=host)=>[...scope.querySelectorAll('button')].find(n=>n.textContent===label)
const reply=(request,data)=>React.act(async()=>request.resolve({ok:true,json:async()=>structuredClone(data)}))
try{
  const model=await server.ssrLoadModule('./src/heatmap/event-window.ts')
  const heatmap=await server.ssrLoadModule('./src/heatmap/heatmap-model.ts')
  const exports=await server.ssrLoadModule('./src/heatmap/heatmap-export.ts')
  const {majorForexPairs}=await server.ssrLoadModule('./src/economic-calendar/forex/pairs.ts')
  const from=now-3600000,window={from,through:now,anchor:from,minutes:5}
  assert.equal(model.parseJakarta('2026-11-12T18:00'),from)
  assert.equal(model.jakartaInput(from),'2026-11-12T18:00')
  assert.equal(model.validEventWindow(window),true)
  for(const patch of [{through:from},{through:from+73*3600000},{anchor:from-60000},{from:now+60000},{minutes:3}])assert.equal(model.validEventWindow({...window,...patch}),false)
  const bars=Array.from({length:61},(_,i)=>({time:from/1000-60+i*60,open:100,high:i===5?105:102,low:99,close:i===0?100:i<30?102:101}))
  const record={availability:'available',checked_at:now/1000,bars}
  const data={schema:1,source_id:'Pepperstone-Demo',generation:2,from_utc:from/1000,through_utc:now/1000,observed_at:now/1000,revision:'a'.repeat(64),pending:0,symbols:{EURUSD:record,XAUUSD:record}}
  assert.equal(model.validIntraday(data,'Pepperstone-Demo',2,window),true)
  for(const patch of [{generation:3},{through_utc:0},{symbols:{EURUSD:{...record,bars:[{...bars[0],time:now/1000+60}]}}}])assert.equal(model.validIntraday({...data,...patch},'Pepperstone-Demo',2,window),false)
  const catalog=['EURUSD','XAUUSD'].map(symbol=>({symbol,description:symbol})),ids=catalog.map(s=>'symbol:'+s.symbol)
  visits=0
  const rows=model.eventRows(ids,catalog,'Pepperstone-Demo',data,window),summary=rows[0].points.get('window')
  assert.equal(visits,122,'Every minute is visited once, independent of output interval count')
  assert.equal(summary.start,100);assert.ok(Math.abs(summary.value-1)<1e-10)
  assert.deepEqual(heatmap.heatmapOHLC(summary).map(f=>Math.round(f.value)),[0,5,-1,1])
  assert.equal(model.eventPeriods(window,now).length,13)
  const text=model.eventChangesText(rows,window,['C'],'candles',[],now/1000)
  assert.match(text,/05:00 PM|06:00 PM/);assert.match(text,/Baseline/);assert.doesNotMatch(text,/ O | H | L /)
  assert.ok(text.indexOf('06:00 PM')<text.lastIndexOf('06:55 PM'),'Candle exports preserve chronology')
  const eventRequest=exports.heatmapResearchPrompt(text,'daily','Pepperstone-Demo',now,true)
  assert.ok(eventRequest.startsWith('Explain the market moves in this selected event window.'))
  assert.ok(eventRequest.endsWith(text),'The request includes the selected event-window readings')
  const ranked=exports.heatmapRankingText([...rows].reverse(),'window',['C'],'Ranking')
  assert.ok(ranked.indexOf('XAUUSD')<ranked.indexOf('EURUSD'),'Copy ranking preserves displayed order')
  const gapped=structuredClone(data);gapped.symbols.EURUSD.bars=bars.filter((_,i)=>i!==4)
  assert.match(model.eventRows(ids,catalog,'Pepperstone-Demo',gapped,window)[0].points.get('window').reason,/59\/60/)
  assert.equal(model.eventRows(ids,catalog,'Pepperstone-Demo',data,{...window,anchor:now+60000,through:now+120000})[0].points.get('window').value,null,'A future event cannot acquire a premature baseline')
  const pairCatalog=majorForexPairs.map(symbol=>({symbol,description:symbol}))
  const allData={...data,symbols:Object.fromEntries(majorForexPairs.map(pair=>[pair,record]))}
  const baskets=model.eventRows(['basket:USD'],pairCatalog,'Pepperstone-Demo',allData,window)
  assert.equal(baskets[0].points.get('window').coverage,7)
  assert.deepEqual(heatmap.heatmapOHLC(baskets[0].points.get('window')).slice(0,3).map(f=>f.value),[null,null,null])
  allData.symbols.USDJPY={...record,bars:bars.slice(0,-1)}
  assert.equal(model.eventRows(['basket:USD'],pairCatalog,'Pepperstone-Demo',allData,window)[0].points.get('window').value,null,'Mismatched counterpart endpoint cannot form a basket')
  localStorage.setItem('fyodor.heatmap.v1:Pepperstone-Demo',JSON.stringify({rows:ids}))
  const {HeatmapDock:HeatmapComponent}=await server.ssrLoadModule('./src/heatmap/HeatmapDock.tsx')
  const {WildcardsProvider}=await server.ssrLoadModule('./src/wildcards/WildcardsProvider.tsx')
  const HeatmapDock=props=>React.createElement(WildcardsProvider,null,React.createElement(HeatmapComponent,props))
  const {DisplayClockProvider}=await server.ssrLoadModule('./src/appearance/time-display/DisplayClock.tsx')
  const render=(panel=false)=>React.act(async()=>root.render(React.createElement(DisplayClockProvider,{brokerId:'Pepperstone-Demo',brokerOffsetSeconds:7200,preference:{mode:'fixed-offset',utcOffsetMinutes:420,hour12:true}},
    React.createElement(HeatmapDock,{symbols:catalog,broker:'Pepperstone-Demo',generation:2,active:true,dockActive:!panel,rankingTarget:panel?target:null}))))
  await render()
  await reply(pending.shift(),{schema:1,source_id:'Pepperstone-Demo',generation:2,year:2026,today:'2026-11-12',observed_at:now/1000,revision:'a'.repeat(64),pending:0,symbols:Object.fromEntries(catalog.map(s=>[s.symbol,{...record,bars:[{...bars[0],time:Date.parse('2026-11-11')/1000},{...bars[1],time:Date.parse('2026-11-12')/1000}]}]))})
  for(const field of ['O','H','L'])await check(host.querySelector(`[aria-label="Visible fields ${field}"]`))
  assert.match(host.querySelector('.heatmap-tape').style.gridTemplateColumns,/78px/,'C-only view shrinks the actual date column')
  assert.equal(host.querySelector('.heatmap-cell .heatmap-ohlc').children.length,1)
  assert.equal(host.querySelector('[aria-label="Visible fields C"]').disabled,true,'At least one field remains visible')
  await click(button('Copy Details Only'));assert.doesNotMatch(copied,/ O | H | L /)
  await check(host.querySelector('[aria-label="Match visible fields"]'))
  await click(button('Copy Details Only'));assert.match(copied,/O .*H .*L .*C /)
  await check(host.querySelector('[aria-label="Copy XAUUSD"]'))
  await click(button('Copy Details Only'));assert.doesNotMatch(copied,/XAUUSD/)
  const count=pending.length
  await render(true)
  assert.equal(host.querySelector('.heatmap-viewport'),null)
  assert.ok(target.querySelector('.heatmap-ranking'));assert.equal(pending.length,count,'Ranking and dock share the same history owner')
  await click(button('Event window',target))
  const initial=pending.shift();assert.equal(initial.url,'/storage-api/heatmap/intraday')
  await reply(initial,data)
  assert.match(target.querySelector('.heatmap-ranking').textContent,/Window summary/)
  await change(target.querySelector('[aria-label="Event anchor"]'),'2026-11-12T18:30')
  await change(target.querySelector('[aria-label="Event candle interval"]'),'15')
  await click(button('Apply window',target))
  const stale=pending.shift()
  await change(target.querySelector('[aria-label="Event from"]'),'2026-11-12T18:05')
  await click(button('Apply window',target))
  assert.equal(stale.options.signal.aborted,true)
  const current=pending.shift()
  await reply(current,{...data,from_utc:from/1000+300})
  await reply(stale,data)
  assert.match(target.querySelector('.heatmap-ranking header').textContent,/06:30 PM/)
  await click(button('Copy displayed ranking',target));assert.match(copied,/Event-window ranking/)
  await React.act(async()=>root.unmount())
  assert.equal(timers.size,0);assert.equal(observers.size,0)
  console.log('✓ Heatmap event windows: bounded minute aggregation, anchor semantics, coverage, baskets, field sizing, copy selection, shared ranking and stale-request cleanup')
}finally{
  await React.act(async()=>root.unmount());await server.close();await dom.happyDOM.close();Date.now=originalNow
  for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
}
