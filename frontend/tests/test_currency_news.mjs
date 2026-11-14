import assert from 'node:assert/strict'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import React from 'react'
import {createServer} from 'vite'
import {Window} from 'happy-dom'
const dom=new Window({url:'http://localhost:5173'}),globals={window:dom,document:dom.document,navigator:dom.navigator,localStorage:dom.localStorage,HTMLElement:dom.HTMLElement,Node:dom.Node,IS_REACT_ACT_ENVIRONMENT:true}
const previous=new Map([...Object.keys(globals),'fetch'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v})
let items=[],sequence=0,fail=false;const calls=[]
globalThis.fetch=async(url,options={})=>{calls.push([url,options]);let status=200
 if(fail&&options.method){status=503;return{ok:false,json:async()=>({detail:'Save failed'})}}
 if(options.method==='POST')items.push({id:String(++sequence),...JSON.parse(options.body)})
 if(options.method==='PUT')items=items.map(item=>item.id===url.split('/').at(-1)?{id:item.id,...JSON.parse(options.body)}:item)
 if(options.method==='DELETE')items=items.filter(item=>item.id!==url.split('/').at(-1))
 return{ok:true,status,json:async()=>structuredClone({items})}}
const server=await createServer({root:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),server:{middlewareMode:true},appType:'custom'})
const{createRoot}=await import('react-dom/client'),{CurrencyNewsDock}=await server.ssrLoadModule('./src/currency-news/CurrencyNewsDock.tsx')
const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
const button=text=>[...host.querySelectorAll('button')].find(b=>b.textContent===text)
const click=async node=>{assert.ok(node);await React.act(async()=>node.click())}
const change=async(label,value)=>React.act(async()=>{const input=host.querySelector(`[aria-label="${label}"]`);const proto=input.tagName==='TEXTAREA'?dom.HTMLTextAreaElement.prototype:dom.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(input,value);input.dispatchEvent(new dom.Event('input',{bubbles:true}));input.dispatchEvent(new dom.Event('change',{bubbles:true}))})
const submit=async()=>React.act(async()=>host.querySelector('form').dispatchEvent(new dom.Event('submit',{bubbles:true,cancelable:true})))
try{
 await React.act(async()=>root.render(React.createElement(CurrencyNewsDock)))
 assert.match(host.textContent,/No news for this date/);assert.equal(button('Copy refresh prompt'),undefined)
 await click(button('Add news'));await change('News title','Manual headline');await change('News details','My notes <script>text</script>');await change('News source URL','https://example.com/news');await submit()
 assert.equal(items.length,1);assert.match(host.querySelector('[data-news-story]').textContent,/Manual headline/);assert.equal(host.querySelector('script'),null)
 await click(button('Edit'));await change('News title','Edited headline');fail=true;await submit();assert.match(host.querySelector('[role="alert"]').textContent,/Save failed/);assert.ok(host.querySelector('form'));assert.equal(items[0].title,'Manual headline')
 fail=false;await submit();assert.equal(items[0].title,'Edited headline')
 await click(button('Edit'));await change('News title','Cancelled');await click(button('Cancel'));assert.equal(items[0].title,'Edited headline')
 await click(button('Delete'));assert.equal(items.length,1);await click(button('Cancel'));assert.equal(items.length,1)
 await click(button('Delete'));await click(button('Confirm delete'));assert.equal(items.length,0);assert.match(host.textContent,/No news for this date/)
 assert.ok(calls.every(([url])=>url.startsWith('/storage-api/currency-news')))
 console.log('✓ Manual News: blank slate, add/edit/delete, cancel, save failure, safe text and source links')
}finally{await React.act(async()=>root.unmount());await server.close();await dom.happyDOM.close();for(const[k,d]of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}}
