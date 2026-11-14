import assert from 'node:assert/strict'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import React from 'react'
import {createServer} from 'vite'
import {Window} from 'happy-dom'

const dom=new Window({url:'http://localhost:5173'}), frames=new Map(), timers=new Map(); let sequence=0
const globals={window:dom,document:dom.document,navigator:dom.navigator,localStorage:dom.localStorage,HTMLElement:dom.HTMLElement,Node:dom.Node,IS_REACT_ACT_ENVIRONMENT:true}
const previous=new Map([...Object.keys(globals),'fetch'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v})
dom.requestAnimationFrame=fn=>{frames.set(++sequence,fn);return sequence};dom.cancelAnimationFrame=id=>frames.delete(id)
dom.setTimeout=(fn,ms)=>{timers.set(++sequence,{fn,ms});return sequence};dom.clearTimeout=id=>timers.delete(id)
const now=Date.parse('2026-11-14T10:00:00Z'), originalNow=Date.now; Date.now=()=>now
let saved={schema:1,revision:0,items:[]}, fail=false, calls=[]
globalThis.fetch=async(url,options={})=>{
  calls.push([url,options]);if(fail&&options.method)return{ok:false,status:503,json:async()=>({detail:'Failed'})}
  if(options.method){const body=options.body?JSON.parse(options.body):null;const revision=body?.expected_revision??Number(new URL(url,'http://localhost').searchParams.get('expected_revision'))
    if(revision!==saved.revision)return{ok:false,status:409,json:async()=>({detail:'Conflict'})}
    const id=new URL(url,'http://localhost').pathname.split('/').at(-1)
    if(options.method==='POST')saved.items.push({id:String(++sequence),...body})
    if(options.method==='PUT')saved.items=saved.items.map(item=>item.id===id?{id,...body}:item)
    if(options.method==='DELETE')saved.items=saved.items.filter(item=>item.id!==id)
    for(const item of saved.items)delete item.expected_revision
    saved.revision++
  }
  return{ok:true,status:200,json:async()=>structuredClone(saved)}
}
const server=await createServer({root:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),server:{middlewareMode:true,hmr:false},appType:'custom'})
const {createRoot}=await import('react-dom/client'),{WildcardsProvider}=await server.ssrLoadModule('./src/wildcards/WildcardsProvider.tsx')
const {useWildcards}=await server.ssrLoadModule('./src/wildcards/useWildcards.ts'),{WildcardsDock}=await server.ssrLoadModule('./src/wildcards/WildcardsDock.tsx')
const model=await server.ssrLoadModule('./src/wildcards/wildcard-model.ts'),{DetailWildcards}=await server.ssrLoadModule('./src/wildcards/DetailWildcards.tsx')
const {WildcardChartLayer}=await server.ssrLoadModule('./src/wildcards/WildcardChartLayer.tsx'),{DisplayClockProvider}=await server.ssrLoadModule('./src/appearance/time-display/DisplayClock.tsx')
const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
let state;function Capture(){const value=useWildcards();React.useLayoutEffect(()=>{state=value},[value]);return null}
const click=async node=>{assert.ok(node,'Expected control');await React.act(async()=>node.click())}
const button=text=>[...host.querySelectorAll('button')].find(node=>node.textContent===text)
const change=async(label,value)=>React.act(async()=>{const input=host.querySelector(`[aria-label="${label}"]`);assert.ok(input,label);const proto=input.tagName==='TEXTAREA'?dom.HTMLTextAreaElement.prototype:dom.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(input,value);input.dispatchEvent(new dom.Event('input',{bubbles:true}));input.dispatchEvent(new dom.Event('change',{bubbles:true}))})
const submit=async()=>React.act(async()=>host.querySelector('form').dispatchEvent(new dom.Event('submit',{bubbles:true,cancelable:true})))
async function flush(){await React.act(async()=>{for(let n=0;frames.size&&n<8;n++){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn())}})}
const scope={brokerId:'Pepperstone-Demo',brokerOffsetSeconds:7200}
const start=Date.parse('2026-11-14T05:00:00Z')/1000 // broker 05:00 = UTC 03:00
const bars=Array.from({length:8},(_,i)=>({time:start+i*900,open:1,high:2,low:0,close:1}))
const rangeListeners=new Set(),sizeListeners=new Set(),clickListeners=new Set(),primitives=new Set()
const scale={width:()=>800,timeToCoordinate:time=>100+(time-start)/900*80,subscribeVisibleLogicalRangeChange:fn=>rangeListeners.add(fn),unsubscribeVisibleLogicalRangeChange:fn=>rangeListeners.delete(fn),subscribeSizeChange:fn=>sizeListeners.add(fn),unsubscribeSizeChange:fn=>sizeListeners.delete(fn)}
const chartElement=document.createElement('div');document.body.append(chartElement)
const chart={timeScale:()=>scale,paneSize:()=>({width:800,height:400}),chartElement:()=>chartElement,subscribeClick:fn=>clickListeners.add(fn),unsubscribeClick:fn=>clickListeners.delete(fn)}
const seriesApi={attachPrimitive:p=>primitives.add(p),detachPrimitive:p=>primitives.delete(p)}
const render=()=>React.act(async()=>root.render(React.createElement(WildcardsProvider,null,React.createElement(Capture),React.createElement(WildcardsDock),
  React.createElement(DisplayClockProvider,{...scope,preference:{mode:'fixed-offset',utcOffsetMinutes:420,hour12:true}},React.createElement(WildcardChartLayer,{chartApi:chart,seriesApi,bars,step:900,visible:true,context:'EURUSD:M15'})),
  React.createElement(DetailWildcards,{at:Date.parse('2026-11-14T04:00:00Z'),pinned:false}))))
try{
  await render();await flush();assert.match(host.textContent,/No wildcards for this selection/)
  await click(button('Add wildcard'));await change('Wildcard title','Manual headline');await change('Wildcard details','My notes <script>text</script>');await change('Wildcard time','10:15:00');await submit();await flush()
  assert.equal(saved.items.length,1);assert.equal(saved.items[0].at,'2026-11-14T03:15:00.000Z');assert.equal(host.querySelector('script'),null)
  assert.match(host.querySelector('.detail-wildcards').textContent,/Manual headline/)
  assert.ok(host.querySelector('[aria-label="Wildcard: Manual headline"]'))
  await click(host.querySelector('[aria-label="Wildcard: Manual headline"]'));await change('Wildcard title','Edited headline');fail=true;await submit()
  assert.match(host.querySelector('[role="alert"]').textContent,/draft is retained/);assert.equal(saved.items[0].title,'Manual headline')
  fail=false;await submit();await flush();assert.equal(saved.items[0].title,'Edited headline');assert.match(host.querySelector('.detail-wildcards').textContent,/Edited headline/)
  await click(button('Edit / Delete'));await change('Wildcard title','Cancelled');await click(button('Cancel'));assert.equal(saved.items[0].title,'Edited headline')
  await React.act(async()=>state.setPlacing(true));assert.equal(clickListeners.size,1)
  await React.act(async()=>{for(const fn of clickListeners)fn({point:{x:180,y:100},time:bars[1].time,paneIndex:0})})
  assert.match(host.querySelector('[aria-label="Wildcard time"]').value,/^10:15(?::00)?$/,'Chart placement converts historical broker time to Jakarta input')
  await change('Wildcard title','Same candle');await submit();await flush()
  assert.ok(host.querySelector('[aria-label="2 wildcards"]'),'Two entries share a chart icon without losing either')
  await click(host.querySelector('[aria-label="2 wildcards"]'));assert.match(host.querySelector('[role="dialog"]').textContent,/Edited headline/);assert.match(host.querySelector('[role="dialog"]').textContent,/Same candle/)
  await click(button('Close'))
  const baseline={date:'2026-11-14',at:'2026-11-14T03:15:00Z',title:'Entry',details:'',url:'',archived:false,id:'base'}
  const items=[baseline,{...baseline,id:'later',at:'2026-11-14T05:00:00Z'},{...baseline,id:'previous',date:'2026-11-13',at:'2026-11-13T03:00:00Z'},{...baseline,id:'date-only',at:null}]
  assert.deepEqual(model.wildcardsAt(items,Date.parse('2026-11-14T04:00:00Z'),false).map(e=>e.id),['base'])
  assert.deepEqual(model.wildcardsAt(items,Date.parse('2026-11-14T04:00:00Z'),true).map(e=>e.id),['base','previous'])
  assert.equal(model.wildcardHeatmapDay({...baseline,date:'2026-11-15',at:'2026-11-14T18:30:00Z'},scope),'2026-11-14','Heatmap uses the broker candle day across Jakarta midnight')
  assert.equal(model.containingWildcardCandle(start+950,bars,900),start+900)
  assert.equal(model.containingWildcardCandle(start-1,bars,900),null)
  await click(button('Edit / Delete'));await click(button('Delete…'));await click(button('Confirm delete'));await flush();assert.equal(saved.items.length,1)
  assert.ok(calls.every(([url])=>url.startsWith('/storage-api/wildcards')))
  await React.act(async()=>root.render(null));assert.equal(primitives.size,0);assert.equal(rangeListeners.size,0);assert.equal(clickListeners.size,0);assert.equal(timers.size,0)
  const {LedgerProvider}=await server.ssrLoadModule('./src/currency-ledger/LedgerProvider.tsx'),{useLedger}=await server.ssrLoadModule('./src/currency-ledger/useLedger.ts')
  const {LedgerCandlePicker}=await server.ssrLoadModule('./src/currency-ledger/LedgerCandlePicker.tsx')
  const hoverListeners=new Set();chart.subscribeCrosshairMove=fn=>hoverListeners.add(fn);chart.unsubscribeCrosshairMove=fn=>hoverListeners.delete(fn)
  let ledger;function LedgerCapture(){const value=useLedger();React.useLayoutEffect(()=>{ledger=value},[value]);return null}
  await React.act(async()=>root.render(React.createElement(DisplayClockProvider,{...scope,preference:{mode:'fixed-offset',utcOffsetMinutes:420,hour12:true}},React.createElement(LedgerProvider,{broker:scope.brokerId,enabled:false,pickerScope:'EURUSD:M15',currencies:['EUR','USD']},React.createElement(LedgerCapture),React.createElement(LedgerCandlePicker,{chartApi:chart,bars})))))
  await React.act(async()=>ledger.followChart());assert.equal(hoverListeners.size,1)
  const candleEvent=time=>({time,point:{x:180,y:100},paneIndex:0})
  await React.act(async()=>{for(const fn of hoverListeners){fn(candleEvent(bars[0].time));fn(candleEvent(bars[1].time))}})
  assert.equal(ledger.selection.at,null,'Hover updates are batched until the next animation frame');assert.equal(frames.size,1)
  await flush();assert.equal(ledger.at,Date.parse('2026-11-14T03:15:00Z'));assert.equal(ledger.detailPinned,false)
  await React.act(async()=>{for(const fn of clickListeners)fn(candleEvent(bars[2].time))})
  assert.equal(ledger.at,Date.parse('2026-11-14T03:30:00Z'));assert.equal(ledger.detailPinned,true);assert.equal(ledger.following,false)
  assert.equal(hoverListeners.size,0)
  await React.act(async()=>ledger.followChart());await React.act(async()=>dom.dispatchEvent(new dom.KeyboardEvent('keydown',{key:'Escape'})))
  assert.equal(ledger.following,false);assert.equal(ledger.at,Date.parse('2026-11-14T03:30:00Z'))
  await React.act(async()=>root.render(null));assert.equal(hoverListeners.size,0);assert.equal(clickListeners.size,0)
  console.log('✓ Wildcards: global CRUD, safe content, shared chart/Detail updates, candle placement, collisions, time windows, broker dates, failures and cleanup')
}finally{await React.act(async()=>root.unmount());await server.close();await dom.happyDOM.close();Date.now=originalNow;for(const[k,d]of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}}
