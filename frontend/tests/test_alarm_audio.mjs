import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {Window} from 'happy-dom'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const dom=new Window({url:'http://localhost:5173'})
const old=Object.getOwnPropertyDescriptor(globalThis,'AudioContext')
const oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window')
globalThis.window=dom
let closed=0,duration=.25,decodeFailure=false
// Existing browser codec boundary; production PCM conversion is exercised.
globalThis.AudioContext=class {
  async close(){closed++}
  async decodeAudioData(){
    if(decodeFailure)throw new Error('Decoder rejected audio')
    return {duration,numberOfChannels:2,sampleRate:8000,getChannelData:()=>new Float32Array(2000).fill(.5)}
  }
}
const server=await createServer({root:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),server:{middlewareMode:true,hmr:false}})
try {
  const {alarmAudioUpload}=await server.ssrLoadModule('./src/events-alarms/alarm-audio-upload.ts')
  const wav=await alarmAudioUpload(new dom.File(['audio'],'clip.mp3'))
  const bytes=Uint8Array.from(atob(wav.data),c=>c.charCodeAt(0)),view=new DataView(bytes.buffer)
  assert.equal(view.getUint32(24,true),16000);assert.equal(view.getUint16(22,true),1)
  assert.equal(view.getUint32(40,true),8000);assert.equal(view.getInt16(44,true),16384)
  assert.equal(closed,1,'Temporary decode context closes after conversion')
  for(const file of [new dom.File(['bad'],'clip.exe'),new dom.File([],'empty.mp3'),new dom.File([new Uint8Array(2*1024*1024+1)],'large.wav')])
    await assert.rejects(()=>alarmAudioUpload(file),/MP3/)
  assert.equal(closed,1,'Invalid files never allocate a decoder')
  duration=61
  await assert.rejects(()=>alarmAudioUpload(new dom.File(['audio'],'long.ogg')),/60 seconds/)
  assert.equal(closed,2,'Duration rejection closes its decoder')
  decodeFailure=true
  await assert.rejects(()=>alarmAudioUpload(new dom.File(['audio'],'broken.wav')),/Decoder rejected/)
  assert.equal(closed,3,'Decode failure closes its decoder')
  console.log('Alarm audio: bounded PCM conversion, file/duration limits and decoder cleanup')
}finally{
  await server.close();await dom.happyDOM.close()
  if(old)Object.defineProperty(globalThis,'AudioContext',old);else delete globalThis.AudioContext
  if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else delete globalThis.window
}
