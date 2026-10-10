import {calculateR1Pair} from './pair'
import type {R1PairInput} from './contracts'
import {sameCalendarRows} from '../../inspector/storage/calendar-snapshot-identity'
let events:R1PairInput['events']=[]
self.onmessage=(event:MessageEvent<{id:number;input:R1PairInput}>)=>{const{id,input}=event.data;try{
  if(!sameCalendarRows(events,input.events))events=input.events
  self.postMessage({id,result:calculateR1Pair({...input,events})})
}catch(error){self.postMessage({id,error:String(error)})}}
