import { ledgerDay, ledgerDayEnd, type LedgerData, type LedgerEntry, type LedgerMetric } from './ledger-model'

export type LedgerOccurrence={metric:LedgerMetric;entry:LedgerEntry;revision:boolean;eventAt:number}
export function indexLedgerEvents(data:LedgerData){
  const result=new Map<string,LedgerOccurrence[]>()
  const add=(metric:LedgerMetric,entry:LedgerEntry,revision:boolean)=>{
    const published=entry.at??ledgerDayEnd(entry.day)
    const eventAt=revision?Math.max(published,entry.known_at):published
    const day=revision?ledgerDay(eventAt):entry.day,key=metric.currency+day
    const items=result.get(key)??[];items.push({metric,entry,revision,eventAt});result.set(key,items)
  }
  for(const metric of data.metrics){
    const groups=new Map<string,LedgerEntry[]>()
    for(const entry of metric.entries){const items=groups.get(entry.value_id)??[];items.push(entry);groups.set(entry.value_id,items)}
    for(const group of groups.values()){
      group.sort((a,b)=>a.known_at-b.known_at)
      const actuals=group.filter(e=>e.value!==null)
      // The tape is a complete record browser. Header/scorecard alone evaluate
      // the chosen historical cutoff; tape actuals show latest retained values.
      add(metric,actuals.at(-1)??group.at(-1)!,false)
      for(let i=1;i<actuals.length;i++){
        const before=actuals[i-1],entry=actuals[i]
        if(before.value!==entry.value||before.previous!==entry.previous||before.revised_previous!==entry.revised_previous) add(metric,entry,true)
      }
    }
  }
  for(const items of result.values())items.sort((a,b)=>a.eventAt-b.eventAt||a.metric.id.localeCompare(b.metric.id))
  return result
}
