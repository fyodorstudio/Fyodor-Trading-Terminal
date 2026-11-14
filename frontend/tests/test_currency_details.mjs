import assert from 'node:assert/strict'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import React from 'react'
import {createServer} from 'vite'
import {Window} from 'happy-dom'
const dom=new Window({url:'http://localhost:5173'}),globals={window:dom,document:dom.document,navigator:dom.navigator,HTMLElement:dom.HTMLElement,Node:dom.Node,IS_REACT_ACT_ENVIRONMENT:true}
const previous=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v})
const server=await createServer({root:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),server:{middlewareMode:true},appType:'custom'})
const{createRoot}=await import('react-dom/client'),{CurrencyDetailPanel}=await server.ssrLoadModule('./src/currency-details/CurrencyDetailPanel.tsx'),{LedgerContext}=await server.ssrLoadModule('./src/currency-ledger/useLedger.ts')
const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let closed=0
const categories=[['policy','Monetary policy'],['inflation','Inflation'],['labour','Labor'],['growth','Growth']]
const developments=['EUR','USD'].map(currency=>({currency,categories:categories.map(([id,label])=>({id,label,rows:[{metric:{id:currency+'.'+id,label:'Reading',unit:'%'},previous:2,entry:{value:3,impact:'positive'}}]}))}))
try{
 await React.act(async()=>root.render(React.createElement(LedgerContext.Provider,{value:{detailData:{},developments,error:null}},React.createElement(CurrencyDetailPanel,{brokerId:'Pepperstone-Demo',symbol:'EURUSD',onClose:()=>closed++}))))
 assert.deepEqual([...host.querySelectorAll('thead th')].map(n=>n.textContent),['Category','EUR','USD'])
 assert.deepEqual([...host.querySelectorAll('tbody > tr > th')].map(n=>n.textContent),categories.map(c=>c[1]))
 assert.equal(host.querySelectorAll('tbody > tr').length,4);assert.match(host.querySelector('tbody').textContent,/2% → 3%/)
 assert.equal(host.querySelectorAll('button').length,1);assert.doesNotMatch(host.textContent,/Retained capture|Release consensus|Reference:|Tier|prompt|assessment/i)
 await React.act(async()=>host.querySelector('aside').dispatchEvent(new dom.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(closed,1)
 console.log('✓ Detail: four-category currency table, readings, one close control and keyboard dismissal')
}finally{await React.act(async()=>root.unmount());await server.close();await dom.happyDOM.close();for(const[k,d]of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}}
