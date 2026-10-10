import type { EconomicCalendarEvent } from '../../inspector/calendar-event'

export type R1Vintage = 'stored-unverified' | 'retrospective' | 'observed-as-of' | 'corrected' | 'unavailable'
type Snapshot={knownAt:number;event:EconomicCalendarEvent;source:string}
const fields=['actual','actual_raw_scaled_1e6','previous','previous_raw_scaled_1e6','revised_previous','revised_previous_raw_scaled_1e6','period_seconds','previous_period_seconds','release_at','revision','unit','multiplier'] as const
const cache=new Map<string,Snapshot[]|null>()
function snapshots(encoded:string) {
  if(cache.has(encoded))return cache.get(encoded)!
  let result:Snapshot[]|null=null
  try {
    const parsed:unknown=JSON.parse(encoded)
    if(Array.isArray(parsed)&&parsed.every(s=>s&&Number.isFinite(s.knownAt)&&s.event&&typeof s.event.value_id==='string'&&typeof s.event.event_id==='string')) {
      result=(parsed as Snapshot[]).sort((a,b)=>a.knownAt-b.knownAt)
      // Forecasts and display metadata do not create correction versions.
      result=result.filter((s,i,all)=>i===0||fields.some(f=>s.event[f]!==all[i-1].event[f]))
    }
  }catch{ /* Invalid source metadata stays unavailable. */ }
  if(cache.size>=4096)cache.clear()
  cache.set(encoded,result)
  return result
}
export function r1Observation(row:EconomicCalendarEvent,at:number):{row:EconomicCalendarEvent|null;vintage:R1Vintage;knownAt:number|null} {
  if(row.r1_vintages===undefined)return{row:(row.available_at??row.release_at??Infinity)<=at?row:null,vintage:'stored-unverified',knownAt:row.available_at??null}
  const versions=snapshots(row.r1_vintages)
  if(!versions?.length||versions.some(s=>s.event.value_id!==row.value_id||s.event.event_id!==row.event_id))return{row:null,vintage:'unavailable',knownAt:null}
  const original=versions[0]
  const known=versions.filter(s=>s.knownAt<=at)
  // Earliest retrospective snapshot is usable, with no claim of original-time proof.
  let chosen=known.at(-1)??original
  // A lower revision cannot undo a higher revision already captured.
  for(const s of known)if(s.event.revision>chosen.event.revision)chosen=s
  if(known.some(s=>s!==chosen&&s.knownAt===chosen.knownAt&&s.event.revision===chosen.event.revision&&fields.some(f=>s.event[f]!==chosen.event[f])))return{row:null,vintage:'unavailable',knownAt:null}
  const vintage=chosen!==original?'corrected':chosen.knownAt>at?'retrospective':'observed-as-of'
  return{row:{...row,...chosen.event,r1_vintages:row.r1_vintages,available_at:vintage==='retrospective'?undefined:chosen.knownAt},vintage,knownAt:chosen.knownAt}
}
