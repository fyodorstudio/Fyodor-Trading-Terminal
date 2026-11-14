import assert from 'node:assert/strict'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import React from 'react'
import {createServer} from 'vite'
import {Window} from 'happy-dom'
const dom=new Window({url:'http://localhost:5173'}),frames=new Map(),timers=new Map();let sequence=0,historyReads=0
class ResizeObserver{observe(){}disconnect(){}}
const globals={window:dom,document:dom.document,localStorage:dom.localStorage,navigator:dom.navigator,HTMLElement:dom.HTMLElement,Node:dom.Node,ResizeObserver,IS_REACT_ACT_ENVIRONMENT:true}
const previous=new Map([...Object.keys(globals),'fetch'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v})
dom.requestAnimationFrame=fn=>{frames.set(++sequence,fn);return sequence};dom.cancelAnimationFrame=id=>frames.delete(id)
dom.setTimeout=(fn,ms)=>{timers.set(++sequence,{fn,ms});return sequence};dom.clearTimeout=id=>timers.delete(id)
const originalNow=Date.now;Date.now=()=>Date.parse('2026-11-12T10:00:00Z')
let saved={schema:1,revision:0,items:[{id:'one',date:'2026-11-12',at:'2026-11-12T03:00:00Z',title:'First development',details:'One',url:'',archived:false},{id:'two',date:'2026-11-12',at:'2026-11-12T03:15:00Z',title:'Second development',details:'Two',url:'',archived:false}]}
globalThis.fetch=async(url,options={})=>{
  if(url.startsWith('/storage-api/wildcards')){
    if(options.method){const body=JSON.parse(options.body);delete body.expected_revision
      if(options.method==='POST')saved.items.push({id:'new-'+(++sequence),...body})
      if(options.method==='PUT')saved.items=saved.items.map(item=>item.id===url.split('/').at(-1)?{id:item.id,...body}:item)
      saved.revision++
    }
    return{ok:true,json:async()=>structuredClone(saved)}
  }
  assert.equal(url,'/storage-api/heatmap/history');historyReads++;const body=JSON.parse(options.body)
  return{ok:true,json:async()=>({schema:1,source_id:body.source_id,generation:body.generation,year:body.year,today:'2026-11-12',observed_at:Date.now()/1000,revision:'a'.repeat(64),pending:0,symbols:{}})}
}
const server=await createServer({root:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),server:{middlewareMode:true,hmr:false},appType:'custom'})
const {createRoot}=await import('react-dom/client'),{WildcardsProvider}=await server.ssrLoadModule('./src/wildcards/WildcardsProvider.tsx')
const {WildcardsDock}=await server.ssrLoadModule('./src/wildcards/WildcardsDock.tsx'),{HeatmapDock}=await server.ssrLoadModule('./src/heatmap/HeatmapDock.tsx')
const {wildcardHeatmapRows,wildcardNotes}=await server.ssrLoadModule('./src/heatmap/wildcards-model.ts')
const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
const symbols=[{symbol:'US500',description:'US500',bid:1,ask:1,precision:2}]
const button=text=>[...host.querySelectorAll('button')].find(node=>node.textContent===text)
const click=async node=>{assert.ok(node);await React.act(async()=>node.click())}
const change=async(label,value)=>React.act(async()=>{const input=host.querySelector(`[aria-label="${label}"]`);Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new dom.Event('input',{bubbles:true}));input.dispatchEvent(new dom.Event('change',{bubbles:true}))})
async function flush(){await React.act(async()=>{for(let n=0;frames.size&&n<8;n++){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn())}})}
const render=(broker='Pepperstone-Demo')=>React.act(async()=>root.render(React.createElement(WildcardsProvider,null,React.createElement(WildcardsDock),React.createElement(HeatmapDock,{symbols,broker,generation:1}))))
async function reveal(){const viewport=host.querySelector('.heatmap-viewport');const template=host.querySelector('.heatmap-tape').style.gridTemplateRows;viewport.scrollTop=Math.max(0,42+Number(/repeat\((\d+),/.exec(template)[1])*30-130);await React.act(async()=>viewport.dispatchEvent(new dom.Event('scroll')));await flush()}
try{
  await render();await flush();await reveal()
  const cell=host.querySelector('[data-wildcard-cell="global:2026-11-12"]');assert.ok(cell);assert.match(cell.title,/First development/);assert.match(cell.title,/Second development/)
  const before=historyReads;await click(cell);assert.equal(host.querySelectorAll('.wildcards-list > button').length,2)
  await click([...host.querySelectorAll('.wildcards-list > button')].find(node=>node.textContent.includes('First development')))
  await change('Wildcard title','Edited everywhere');await React.act(async()=>host.querySelector('form').dispatchEvent(new dom.Event('submit',{bubbles:true,cancelable:true})));await flush()
  assert.match(host.querySelector('.wildcards-dock').textContent,/Edited everywhere/);assert.match(host.querySelector('[data-wildcard-cell="global:2026-11-12"]').title,/Edited everywhere/)
  assert.equal(historyReads,before,'Editing a wildcard never requests price history')
  await click(button('+ Add wildcard'));await change('Wildcard title','Added from Heatmap');await React.act(async()=>host.querySelector('form').dispatchEvent(new dom.Event('submit',{bubbles:true,cancelable:true})));await flush()
  assert.equal(saved.items.length,3);assert.match(host.querySelector('.wildcards-dock').textContent,/Added from Heatmap/)
  await render('Elev8-Demo2');await flush();await reveal();assert.match(host.querySelector('[data-wildcard-cell="global:2026-11-12"]').title,/Edited everywhere/,'Global entries survive broker switches')
  const rows=wildcardHeatmapRows(saved.items,{brokerId:'Pepperstone-Demo',brokerOffsetSeconds:0});assert.equal(rows.length,1)
  assert.equal(wildcardNotes(rows[0],'2026-11-12','daily').length,3);assert.equal(wildcardNotes(rows[0],'2026-11-09','weekly').length,3)
  await React.act(async()=>root.render(null));assert.equal(timers.size,0)
  console.log('✓ Heatmap Wildcards: shared global entries, multiple daily updates, edit/add from cells, weekly aggregation and broker switches without price-history work')
}finally{await React.act(async()=>root.unmount());await server.close();await dom.happyDOM.close();Date.now=originalNow;for(const[k,d]of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}}
