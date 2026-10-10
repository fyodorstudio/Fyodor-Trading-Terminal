import type { EconomicCalendarEvent } from '../../inspector/calendar-event'
import { groupInspectorReleases, type InspectorRelease } from '../../inspector/inspector-data'
import { observedReading } from '../shared/core/historical-release-signals'
import { decimal } from './arithmetic'
import type { R1Component, R1Feature, R1Profile } from './contracts'
import { r1Observation } from './vintages'

type Row = EconomicCalendarEvent & { release_at: number }
export function reference(row: EconomicCalendarEvent, period: R1Component['period']): number | null {
  if (period==='action') return row.release_at
  if (!Number.isSafeInteger(row.period_seconds) || row.period_seconds<=0) return null
  if (period==='week') return row.period_seconds
  const date=new Date(row.period_seconds*1000)
  return Number.isFinite(date.getTime()) ? date.getUTCFullYear()*(period==='quarter'?4:12)+(period==='quarter'?Math.floor(date.getUTCMonth()/3):date.getUTCMonth()) : null
}
const key=(id:string,ref:number)=>`${id}/${ref}`
const prior=(ref:number,period:R1Component['period'])=>ref-(period==='week'?604800:1)
const field=(row:EconomicCalendarEvent,name:'actual'|'previous'|'revised_previous')=>decimal(row[name],row[`${name}_raw_scaled_1e6`])
const present=(row:EconomicCalendarEvent,name:'previous'|'revised_previous')=>row[name]!=null||row[`${name}_raw_scaled_1e6`]!=null
const unavailable=(reason:string):R1Feature=>({actual:null,previous:null,delta:null,reference:null,previousReference:null,publishedAt:null,valueId:null,revision:null,basis:'Unavailable',reason})
export function createR1History(events:readonly EconomicCalendarEvent[]) {
  const seen=new Set<string>(),rows=events.filter((e):e is Row=>{
    if (!observedReading(e)||seen.has(e.value_id)) return false
    seen.add(e.value_id);return true
  }).map(row=>{const original=r1Observation(row,row.release_at).row;return {...row,...original,release_at:original?.release_at??row.release_at}}).sort((a,b)=>a.release_at-b.release_at||a.value_id.localeCompare(b.value_id))
  const indexes=new Map<string,Row[]>()
  for (const row of rows) for (const period of ['month','quarter','week'] as const) {
    const ref=reference(row,period);if(ref===null)continue
    const id=key(`${period}:${row.event_id}`,ref),group=indexes.get(id)??[];group.push(row);indexes.set(id,group)
  }
  function latest(id:string,ref:number,period:R1Component['period'],at:number,before=false,availabilityAt=at) {
    const matches=indexes.get(key(`${period}:${id}`,ref))??[]
    let lo=0,hi=matches.length
    while(lo<hi){const mid=(lo+hi)>>>1;if(before?matches[mid].release_at<at:matches[mid].release_at<=at)lo=mid+1;else hi=mid}
    let i=lo-1
    while(i>=0&&!r1Observation(matches[i],availabilityAt).row)i--
    if(i<0)return null
    const row=r1Observation(matches[i],availabilityAt).row as Row
    if(i>0&&matches[i-1].release_at===row.release_at&&(matches[i-1].available_at??row.release_at)<=at)return null
    return row
  }
  return { rows, latest, releases:groupInspectorReleases(rows) }
}
export type R1History=ReturnType<typeof createR1History>

function valid(row:Row,c:R1Component,at:number) {
  if(!observedReading(row)||row.release_at>at||(row.available_at??row.release_at)>at||!c.units.includes(row.unit)||row.multiplier!==c.multiplier||field(row,'actual')===null)return false
  const ref=reference(row,c.period)
  if(ref===null)return false
  if(c.period!=='action'){
    const date=new Date(row.release_at),published=c.period==='week'?row.release_at/1000:date.getUTCFullYear()*(c.period==='quarter'?4:12)+(c.period==='quarter'?Math.floor(date.getUTCMonth()/3):date.getUTCMonth())
    if(ref>=published)return false
    if(c.period==='week'&&(published-ref>35*86400||field(row,'actual')!<0))return false
  }
  if(c.unit==='pts'&&(field(row,'actual')!<0||field(row,'actual')!>100e6))return false
  return true
}
export function r1Features(release:InspectorRelease,profile:R1Profile,history:R1History,gdpMomentum=false,availabilityAt=release.releaseAt??0):R1Feature[] {
  const at=release.releaseAt
  if(at===null||!Number.isFinite(at)||release.timingUncertain)return profile.components.map(()=>unavailable('Publication time is unverified.'))
  const refs=new Set(profile.components.flatMap(c=>{
    const source=release.events.find(e=>e.event_id===c.seriesId),row=source&&r1Observation(source,availabilityAt).row
    const ref=row&&reference(row,c.period)
    return c.period==='month'&&ref!=null?[ref]:[]
  }))
  if(refs.size>1)return profile.components.map(()=>unavailable('Inputs cover different reference months.'))
  return profile.components.map(c=>{
    const matching=release.events.filter(e=>e.event_id===c.seriesId)
    if(matching.length!==1)return unavailable(matching.length?'Duplicate series reading.':`Missing ${c.label}.`)
    const observation=r1Observation(matching[0],availabilityAt),row=observation.row as Row|null
    if(!row||row.release_at!==at||!valid(row,c,availabilityAt))return unavailable(`Invalid ${c.label} or reference period.`)
    const actual=field(row,'actual')!,ref=reference(row,c.period)!,previousRef=prior(ref,c.period)
    const same=c.period==='quarter'?history.latest(c.seriesId,ref,c.period,at,true,availabilityAt):null
    let previous:number|null=null,basis='',stage:R1Feature['stage']='momentum',comparisonRef=previousRef
    if(c.period==='quarter'){
      if(same&&!gdpMomentum){previous=valid(same,c,availabilityAt)?field(same,'actual'):null;basis='Earlier estimate of this quarter';stage='revision';comparisonRef=ref}
      else {const preceding=history.latest(c.seriesId,previousRef,c.period,availabilityAt);previous=preceding&&valid(preceding,c,availabilityAt)?field(preceding,'actual'):null;basis='Previous quarter, latest available estimate'
        // Only a new-quarter supplied prior can revise the preceding quarter.
        if(!same&&present(row,'revised_previous')){previous=field(row,'revised_previous');basis='Revised Previous quarter'}
      }
    }else if(present(row,'revised_previous')){previous=field(row,'revised_previous');basis='Revised Previous'}
    else if(present(row,'previous')){previous=field(row,'previous');basis='Supplied Previous'}
    else {const preceding=history.latest(c.seriesId,previousRef,c.period,availabilityAt);previous=preceding&&valid(preceding,c,availabilityAt)?field(preceding,'actual'):null;basis='Previous period, latest available observation'}
    if(row.previous_period_seconds!=null&&c.period!=='action'){
      const stated=reference({...row,period_seconds:row.previous_period_seconds},c.period)
      if(stated!==comparisonRef)previous=null
    }
    if(c.period==='week'&&previous!==null&&previous<0)previous=null
    if(c.unit==='pts'&&previous!==null&&(previous<0||previous>100e6))previous=null
    const scale=c.scale??1
    const result:R1Feature={actual:actual/1e6*scale,previous:previous===null?null:previous/1e6*scale,delta:previous===null?null:(actual-previous)/1e6*scale*(c.period==='action'?100:1),reference:ref,previousReference:c.period==='action'?null:comparisonRef,publishedAt:at,valueId:row.value_id,revision:row.revision,basis,reason:previous===null?'Comparable Previous is unavailable.':'',stage,vintage:observation.vintage,knownAt:observation.knownAt}
    return result
  })
}
