import {calculateR1Pair} from './pair'
import type {R1PairInput} from './contracts'
self.onmessage=(event:MessageEvent<{id:number;input:R1PairInput}>)=>{const{id,input}=event.data;try{self.postMessage({id,result:calculateR1Pair(input)})}catch(error){self.postMessage({id,error:String(error)})}}
