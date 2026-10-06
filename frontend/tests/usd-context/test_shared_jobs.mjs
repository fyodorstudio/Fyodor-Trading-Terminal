import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
import path from 'node:path'
import { createServer } from 'vite'
const server=await createServer({root:path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'),server:{middlewareMode:true,hmr:false}})
try {
 const {sharedContextJobs}=await server.ssrLoadModule('./src/usd-context/runtime/shared-context-jobs.ts')
 const {contextInventoryIdentity}=await server.ssrLoadModule('./src/usd-context/runtime/context-inventory-identity.ts')
 const workers=[]
 const jobs=sharedContextJobs(v=>v*2,()=>{const w={postMessage(v){this.input=v},terminate(){this.terminated=true}};workers.push(w);return w},1)
 const a=jobs.get('same',2),b=jobs.get('same',2);assert.equal(a,b)
 const offA=a.subscribe(()=>{}),offB=b.subscribe(()=>{});assert.equal(workers.length,1)
 offA();await Promise.resolve();assert.equal(workers[0].terminated,undefined,'One consumer must not cancel another')
 const reply=workers[0].onmessage
 reply({data:{id:99,result:100}});assert.equal(a.snapshot().loading,true)
 reply({data:{id:1,result:4}});assert.equal(a.snapshot().result,4);assert.equal(workers[0].terminated,true)
 reply({data:{id:1,result:99}});assert.equal(a.snapshot().result,4,'Completed replies cannot overwrite the result')
 offB();await Promise.resolve();assert.equal(jobs.get('same',2),a,'Warm remount reuses completed work')
 const c=jobs.get('new-settings',3),offC=c.subscribe(()=>{});assert.equal(workers.length,2)
 offC();const strict=c.subscribe(()=>{});await Promise.resolve();assert.equal(workers[1].terminated,undefined,'Immediate StrictMode resubscribe retains work')
 strict();await Promise.resolve();assert.equal(workers[1].terminated,true)
 const retry=jobs.get('new-settings',3);assert.notEqual(retry,c)
 const offRetry=retry.subscribe(()=>{});workers[2].onerror();assert.match(retry.snapshot().error,/Background calculation failed/)
 offRetry();await Promise.resolve();assert.notEqual(jobs.get('new-settings',3),retry,'Failed jobs retry on remount')
 const d=jobs.get('new-broker',5),offD=d.subscribe(()=>{});workers.at(-1).onmessage({data:{id:1,result:10}});offD();await Promise.resolve()
 assert.notEqual(jobs.get('same',2),a,'Idle completed cache is bounded')
 const hiddenWorkers=[],hiddenJobs=sharedContextJobs(v=>v,()=>{const w={postMessage(){},terminate(){}};hiddenWorkers.push(w);return w})
 const hidden=hiddenJobs.get('hidden',9),hide=hidden.subscribe(()=>{}),oldReply=hiddenWorkers[0].onmessage
 hide();await Promise.resolve();const show=hidden.subscribe(()=>{});assert.equal(hiddenWorkers.length,2,'A suspended subscriber can restart its cancelled job')
 oldReply({data:{id:1,result:99}});assert.equal(hidden.snapshot().loading,true,'Cancelled generation cannot complete the restarted job')
 hiddenWorkers[1].onmessage({data:{id:1,result:9}});assert.equal(hidden.snapshot().result,9);show()
 const fallback=sharedContextJobs(v=>v+1,()=>null),f=fallback.get('x',2),offF=f.subscribe(()=>{});await Promise.resolve();assert.equal(f.snapshot().result,3);offF()
 const rows=[{value_id:'1',actual:3,release_at:100}],copy=rows.map(r=>({...r}))
 assert.equal(contextInventoryIdentity(rows),contextInventoryIdentity(copy),'Equivalent independently fetched rows share calculations')
 for(const patch of [{actual:4},{release_at:101},{chart_time_seconds:2},{availability:'not-returned-by-latest-query'}])
  assert.notEqual(contextInventoryIdentity(rows),contextInventoryIdentity([{...rows[0],...patch}]))
 console.log('✓ Shared calculation fan-out, cancellation, StrictMode, stale replies, failures, bounded warm cache and exact inventory identity')
}finally{await server.close()}
