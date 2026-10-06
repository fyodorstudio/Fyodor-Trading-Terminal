/// <reference lib="webworker" />
import { buildEurContextTimeline } from '../core/eur-context-timeline'
import type { EurContextInput } from '../core/contracts'
self.onmessage=(e:MessageEvent<{id:number;input:EurContextInput}>)=>{
  try{self.postMessage({id:e.data.id,result:buildEurContextTimeline(e.data.input)})}
  catch(error){self.postMessage({id:e.data.id,error:error instanceof Error?error.message:'EUR context calculation failed.'})}
}
