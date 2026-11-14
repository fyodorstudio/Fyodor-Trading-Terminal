import assert from 'node:assert/strict'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createServer} from 'vite'
import {Window} from 'happy-dom'
const dom=new Window({url:'http://localhost:5173'}),frames=new Map();let sequence=0
const globals={window:dom,document:dom.document,localStorage:dom.localStorage,navigator:dom.navigator,HTMLElement:dom.HTMLElement,Node:dom.Node}
const previous=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v})
dom.requestAnimationFrame=fn=>{frames.set(++sequence,fn);return sequence};dom.cancelAnimationFrame=id=>frames.delete(id)
const server=await createServer({root:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),server:{middlewareMode:true,hmr:false},appType:'custom'})
const shell=document.createElement('div');document.body.append(shell)
const start=Date.parse('2026-11-14T05:00:00Z')/1000,bars=Array.from({length:10},(_,i)=>({time:start+i*3600,open:1,close:1,high:1,low:1}))
const listeners=new Set(),scale={getVisibleRange:()=>({from:start,to:start+9*3600}),timeToCoordinate:time=>100+(time-start)/3600*50,subscribeVisibleLogicalRangeChange:fn=>listeners.add(fn),unsubscribeVisibleLogicalRangeChange:fn=>listeners.delete(fn),subscribeSizeChange:fn=>listeners.add(fn),unsubscribeSizeChange:fn=>listeners.delete(fn)}
const chart={chartElement:()=>shell,timeScale:()=>scale}
const flush=()=>{for(let n=0;frames.size&&n<8;n++){const work=[...frames.values()];frames.clear();work.forEach(fn=>fn())}}
try{
  const p=await server.ssrLoadModule('./src/market-data/indicators/macro/macro-preferences.ts'),{macroCatalog,isMacroTextEvent}=await server.ssrLoadModule('./src/market-data/indicators/macro/macro-catalog.ts')
  const {defaultMacroCategories}=await server.ssrLoadModule('./src/market-data/indicators/macro/macro-layout.ts'),{validateMacroSnapshot}=await server.ssrLoadModule('./src/market-data/indicators/macro/macro-presets.ts')
  const chf=Object.keys(macroCatalog).find(key=>macroCatalog[key].currency==='CHF'&&!isMacroTextEvent(key));assert.ok(chf)
  let preferences=p.setMacroEvents({...p.defaultMacroPreferences,enabled:true,currencies:['USD'],eventsByCurrency:{USD:['rate']},activeCurrency:'USD',categories:defaultMacroCategories,categoryByEvent:{},layout:{hideLegend:true,laneMode:true,categoryOrder:[],collapsed:[],rowOrder:['rate'],rowOffsets:{rate:35},laneSpacing:33}},'CHF',[chf])
  preferences=p.switchMacroCurrency(preferences,'CHF');assert.deepEqual(p.selectedMacroMetrics(preferences),[chf]);assert.equal(preferences.axisTarget,chf)
  preferences={...preferences,layout:{...preferences.layout,rowOffsets:{[chf]:80},laneSpacing:44},series:{...preferences.series,[chf]:{...preferences.series[chf],color:'#123456'}}}
  preferences=p.switchMacroCurrency(preferences,'USD');assert.deepEqual(p.selectedMacroMetrics(preferences),['rate']);assert.equal(preferences.layout.rowOffsets.rate,35);assert.equal(preferences.layout.laneSpacing,33)
  preferences=p.switchMacroCurrency(preferences,'CHF');assert.equal(preferences.layout.rowOffsets[chf],80);assert.equal(preferences.layout.laneSpacing,44);assert.equal(preferences.series[chf].color,'#123456')
  assert.ok(p.saveMacroPreferences(preferences));assert.deepEqual(p.readMacroPreferences().currencyViews,preferences.currencyViews)
  assert.deepEqual(validateMacroSnapshot(preferences),preferences,'Currency views survive preset validation and export/import')
  assert.throws(()=>validateMacroSnapshot({...preferences,currencyViews:{USD:{axisTarget:'missing'}}}),/Invalid MFDI/)
  const speech=Object.keys(macroCatalog).find(key=>isMacroTextEvent(key)&&macroCatalog[key].currency==='USD');assert.ok(speech,'Scheduled speeches are identified independently of their calendar category')
  assert.equal(p.selectedMacroMetrics({...preferences,activeCurrency:'USD',eventsByCurrency:{USD:[speech]}}).length,0,'Speech selections never create empty numeric series')
  const {createMacroEventsRow}=await server.ssrLoadModule('./src/market-data/indicators/macro/macro-events-row.ts')
  const row=createMacroEventsRow(chart)
  const events=[{id:'speech',time:start+60,at:start*1000,title:'USD · Governor speech',details:''},{id:'wildcard',time:start+900,at:(start+900)*1000,title:'Global wildcard',details:'Manual <script>text</script>',wildcardId:'one'},{id:'later',time:start+7200,at:(start+7200)*1000,title:'Another announcement',details:''}]
  row.sync(events,bars,3600,true,at=>new Date(at).toISOString());row.position(400,800);flush()
  assert.equal(shell.querySelectorAll('.macro-events-row').length,1);assert.equal(shell.querySelectorAll('.macro-events-row button').length,2)
  const dot=shell.querySelector('.macro-events-row button');assert.equal(dot.textContent,'2');dot.dispatchEvent(new dom.MouseEvent('mouseenter'))
  const tooltip=shell.querySelector('[role="tooltip"]');assert.equal(tooltip.hidden,false);assert.match(tooltip.textContent,/Governor speech/);assert.match(tooltip.textContent,/Global wildcard/);assert.equal(tooltip.querySelector('script'),null)
  dot.dispatchEvent(new dom.MouseEvent('mouseleave'));assert.equal(tooltip.hidden,true)
  dot.click();dot.dispatchEvent(new dom.MouseEvent('mouseleave'));assert.equal(tooltip.hidden,false,'Click holds a grouped tooltip open for reading and scrolling')
  tooltip.querySelector('button').click();assert.equal(tooltip.hidden,true)
  row.sync(events,bars,3600,false,String);flush();assert.equal(shell.querySelector('.macro-events-row').hidden,true)
  row.destroy();assert.equal(listeners.size,0);assert.equal(frames.size,0);assert.equal(shell.children.length,0)
  console.log('✓ MFDI: independent currency selection/layout/style persistence, preset validation and one optional non-numerical row with combined speech/Wildcard tooltips')
}finally{await server.close();await dom.happyDOM.close();for(const[k,d]of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}}
