import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createServer } from 'vite'
import { Window } from 'happy-dom'

const dom=new Window({url:'http://localhost:5173'}), timers=new Map()
let nextTimer=0, now=1794877200000, blocked=true, failSchedule=false, starts=0, api, resumeGate=null
const originalNow=Date.now; Date.now=()=>now
const globals={window:dom,document:dom.document,HTMLElement:dom.HTMLElement,Node:dom.Node,navigator:dom.navigator,IS_REACT_ACT_ENVIRONMENT:true}
const previous=new Map([...Object.keys(globals),'AudioContext'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]))
for(const [key,value] of Object.entries(globals)) Object.defineProperty(globalThis,key,{configurable:true,writable:true,value})
dom.setTimeout=(fn,ms)=>{timers.set(++nextTimer,{fn,ms});return nextTimer};dom.clearTimeout=id=>timers.delete(id)
globalThis.AudioContext=class {
  state='suspended';currentTime=0;destination={}
  async resume(){if(blocked)throw Error('Gesture required');if(resumeGate)await resumeGate();this.state='running'}
  async close(){this.state='closed'}
  createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}}
  createOscillator(){return {frequency:{setValueAtTime(){}},connect(){},disconnect(){},start(){if(failSchedule)throw Error('Device temporarily unavailable');starts++},stop(){}}}
}
const server=await createServer({root:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),server:{middlewareMode:true,hmr:false},appType:'custom'})
const {createRoot}=await import('react-dom/client'),host=document.createElement('div');document.body.append(host)
const root=createRoot(host)
const command=fn=>React.act(async()=>{await fn()})
async function tick(ms){await command(()=>{for(const [id,timer] of [...timers])if(timer.ms===ms){timers.delete(id);timer.fn()}})}
try{
  const {usePriceAlerts}=await server.ssrLoadModule('./src/price-alerts/usePriceAlerts.ts')
  const {PriceAlertDeliveryNotice}=await server.ssrLoadModule('./src/price-alerts/PriceAlertDeliveryNotice.tsx')
  const {priceAlertStorageKey}=await server.ssrLoadModule('./src/price-alerts/price-alert-store.ts')
  function Harness(){const controller=usePriceAlerts('Broker',[{symbol:'EURUSD',bid:1.3}],true);React.useEffect(()=>{api=controller});return React.createElement(PriceAlertDeliveryNotice,{controller})}
  const seed=(change={})=>dom.localStorage.setItem(priceAlertStorageKey,JSON.stringify({playSound:true,duration:1,volume:30,soundId:'thin',alerts:[{
    id:'one',brokerId:'Broker',symbol:'EURUSD',price:1.2,precision:5,direction:'above',status:'armed',createdAt:now-1000,triggeredAt:null,triggeredBid:null,...change}]}))
  const mount=()=>command(()=>root.render(React.createElement(Harness)))
  const unmount=()=>command(()=>root.render(null))
  const saved=()=>JSON.parse(dom.localStorage.getItem(priceAlertStorageKey))
  seed();await mount()
  assert.equal(saved().alerts[0].status,'triggered');assert.equal(saved().alerts[0].soundStatus,'pending')
  assert.equal(starts,0);assert.match(host.textContent,/waiting for playback/)
  const triggeredAt=saved().alerts[0].triggeredAt
  await tick(1000);assert.equal(saved().alerts[0].triggeredAt,triggeredAt,'Retries never create another crossing')
  await unmount();assert.equal(timers.size,0)
  await mount();assert.equal(saved().alerts[0].soundStatus,'pending','Blocked sound survives reload')
  blocked=false
  await command(()=>dom.dispatchEvent(new dom.Event('pointerdown')))
  assert.ok(starts>0);assert.equal(saved().alerts[0].soundStatus,'played');assert.equal(saved().alerts[0].triggeredAt,triggeredAt)
  const played=starts;await tick(1000);await command(()=>dom.dispatchEvent(new dom.Event('keydown')))
  assert.equal(starts,played,'Delivered sound is not replayed by gestures or retry ticks')
  await unmount();await mount();assert.equal(starts,played,'Delivered one-shot persists through reload')
  await unmount()
  seed({status:'triggered',triggeredAt:now-300001,triggeredBid:1.3,soundStatus:'pending'});await mount()
  assert.equal(saved().alerts[0].soundStatus,'missed');assert.equal(starts,played)
  assert.match(host.textContent,/could not play/)
  await command(()=>api.dismissSoundWarnings());assert.equal(saved().alerts[0].status,'triggered');assert.equal(saved().alerts[0].soundStatus,'muted')
  await unmount()
  blocked=true;seed();await mount();await command(()=>api.stopSound());blocked=false
  await command(()=>dom.dispatchEvent(new dom.Event('pointerdown')))
  assert.equal(saved().alerts[0].soundStatus,'muted');assert.equal(starts,played,'Explicit silence cancels recovery')
  await unmount()
  failSchedule=true;seed();await mount();assert.equal(saved().alerts[0].soundStatus,'pending')
  failSchedule=false;await tick(1000);assert.equal(saved().alerts[0].soundStatus,'played','Transient audio scheduling failure retries safely')
  await unmount()
  seed();const custom=saved();custom.soundId='custom';dom.localStorage.setItem(priceAlertStorageKey,JSON.stringify(custom))
  const beforeFallback=starts;await mount()
  assert.equal(saved().alerts[0].soundStatus,'played');assert.ok(starts>beforeFallback,'Missing custom file falls back to an audible built-in tone for a real crossing')
  assert.match(api.customSoundError,/using Thin/);assert.equal(saved().soundId,'custom','Fallback does not replace the user selection')
  await unmount()
  seed();let release
  resumeGate=()=>new Promise(resolve=>{release=resolve})
  await mount();assert.equal(saved().alerts[0].soundStatus,'pending')
  const beforeDelete=starts;await command(()=>api.deleteAlert('one'))
  resumeGate=null;await command(()=>release())
  assert.equal(starts,beforeDelete,'Late audio preparation cannot play a deleted alert')
  await unmount()
  seed({status:'triggered',triggeredAt:now-1000,triggeredBid:1.3})
  const beforeLegacy=starts;await mount();assert.equal(starts,beforeLegacy,'Legacy triggered records are not replayed without pending delivery metadata')
  await unmount();assert.equal(timers.size,0)
  console.log('✓ Price delivery: persistent blocked queue, gesture/reload recovery, expiry warning, no duplicate crossing/sound, silence, scheduling retries and custom fallback')
}finally{
  await command(()=>root.unmount());await server.close();Date.now=originalNow
  for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
  await dom.happyDOM.abort()
}
