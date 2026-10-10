import { calculateR1 } from './analysis'
import type { R1Input } from './contracts'
self.onmessage=(event:MessageEvent<{id:number;input:R1Input}>)=>{
  const{id,input}=event.data
  try{self.postMessage({id,result:calculateR1(input)})}
  catch(error){self.postMessage({id,error:error instanceof Error?error.message:'R1 calculation failed.'})}
}
