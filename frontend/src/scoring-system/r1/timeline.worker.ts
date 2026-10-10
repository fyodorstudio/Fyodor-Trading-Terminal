import { calculateR1Timeline, type R1TimelineInput } from './timeline'
import { sameCalendarRows } from '../../inspector/storage/calendar-snapshot-identity'
let events:R1TimelineInput['events']=[]
self.onmessage=(event:MessageEvent<{id:number;input:R1TimelineInput}>)=>{
  const {id,input}=event.data
  try{if(!sameCalendarRows(events,input.events))events=input.events;self.postMessage({id,result:calculateR1Timeline({...input,events})})}
  catch(error){self.postMessage({id,error:String(error)})}
}
