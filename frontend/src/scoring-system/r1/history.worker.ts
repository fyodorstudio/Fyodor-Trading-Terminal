import {calculateR1History,type R1HistoryInput} from './history'
self.onmessage=(event:MessageEvent<{id:number;input:R1HistoryInput}>)=>{const{id,input}=event.data;try{self.postMessage({id,result:calculateR1History(input)})}catch(error){self.postMessage({id,error:String(error)})}}
