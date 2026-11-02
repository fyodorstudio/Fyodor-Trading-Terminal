import assert from 'node:assert/strict'
import React from 'react'
import {createServer} from 'vite'
import {Window} from 'happy-dom'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const dom=new Window({url:'http://localhost:5173'}), intervals=new Map(), replies=[]
const globals={window:dom,document:dom.document,navigator:dom.navigator,HTMLElement:dom.HTMLElement,Node:dom.Node,IS_REACT_ACT_ENVIRONMENT:true}
const previous=new Map([...Object.keys(globals),'fetch','AudioContext'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
for(const [k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v})
let seq=0,body={available:true,sound_enabled:true,events:[]},offline=false,hold=false,closed=0
dom.setInterval=fn=>{intervals.set(++seq,fn);return seq};dom.clearInterval=id=>intervals.delete(id)
globalThis.fetch=async(url,options)=>hold ? new Promise(resolve=>replies.push({resolve,options})) : {ok:!offline,json:async()=>structuredClone(body)}
globalThis.AudioContext=class {
  async close(){closed++}
  async decodeAudioData(){return {duration:.25,numberOfChannels:2,sampleRate:8000,getChannelData:()=>new Float32Array(2000).fill(.5)}}
}
const server=await createServer({root:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),server:{middlewareMode:true,hmr:false}})
const {createRoot}=await import('react-dom/client'),host=dom.document.createElement('div');dom.document.body.append(host);const root=createRoot(host)
try {
  const {alarmAudioUpload}=await server.ssrLoadModule('./src/events-alarms/alarm-audio-upload.ts')
  const wav=await alarmAudioUpload(new dom.File(['audio'],'clip.mp3'))
  const bytes=Uint8Array.from(atob(wav.data),c=>c.charCodeAt(0)),view=new DataView(bytes.buffer)
  assert.equal(view.getUint32(24,true),16000);assert.equal(view.getUint16(22,true),1)
  assert.equal(view.getUint32(40,true),8000);assert.equal(view.getInt16(44,true),16384)
  assert.equal(closed,1,'Temporary decode context closes after conversion')
  await assert.rejects(()=>alarmAudioUpload(new dom.File(['bad'],'clip.exe')),/MP3/)
  const {CheckpointBell}=await server.ssrLoadModule('./src/thesis/CheckpointBell.tsx')
  const at=new Date(Date.now()+3600000).toISOString()
  const render=currency=>React.act(async()=>root.render(React.createElement(CheckpointBell,{currency,at})))
  const poll=()=>React.act(async()=>[...intervals.values()][0]())
  await render('JPY');assert.equal(host.textContent,'Silent')
  body={...body,events:[{title:'Exact scheduled occurrence',armed:true,selected:true}]}
  await poll();assert.equal(host.textContent,'Bell armed');assert.match(host.querySelector('span').title,/Exact scheduled occurrence/)
  body.sound_enabled=false;await poll();assert.equal(host.textContent,'Bell armed · sound off')
  body.available=false;await poll();assert.equal(host.textContent,'Bell unavailable')
  body.available=true;body.sound_enabled=true
  hold=true;await React.act(async()=>{void [...intervals.values()][0]()})
  await render('CHF');assert.equal(replies[0].options.signal.aborted,true,'Currency changes abort stale status reads')
  hold=false
  await React.act(async()=>{for(const r of replies.splice(0))r.resolve({ok:true,json:async()=>body})})
  offline=true;await poll();assert.equal(host.textContent,'Bell unavailable','A failed worker check never promises delivery')
  await React.act(async()=>root.render(React.createElement(CheckpointBell,{currency:'JPY',at:null})))
  assert.match(host.textContent,/hour unknown/);assert.equal(intervals.size,0)
  console.log('✓ Alarm audio: bounded PCM conversion, decoder cleanup, honest checkpoint bell status and cancelled stale replies')
}finally{
  await React.act(async()=>root.unmount());assert.equal(intervals.size,0);await server.close();await dom.happyDOM.close()
  for(const [k,d]of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}
}
