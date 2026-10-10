import type { R1Analysis, R1Assessment, R1Family, R1Input, R1Schedule, R1Slot, R1Aggregate } from './contracts'
import { r1Family, r1Families, eurR1Families, r1Profiles, r1ReleaseFamily,r1Currency } from './profiles'
import { createR1History, reference } from './features'
import { assessR1, prepareR1Features, readingVariants } from './assessment'
import { aggregateSensitivity, combineR1, r1Freshness } from './relationships'
import { r1Observation } from './vintages'
import {r1DefaultFreshness,eurR1DefaultFreshness} from './freshness'
import {precise} from './arithmetic'
import {combineEurR1,eurCategoryWeights} from './eur-relationships'

export function calculateR1(input:R1Input):R1Analysis {
  const family=r1ReleaseFamily(input.release)??r1Family(input.release.familyId)
  if(!family||input.release.currency!==r1Currency(family)||input.release.country!==(r1Profiles[family].country??'US'))throw new Error('R1 supports mapped USD/EUR numeric publications only.')
  const currency=r1Currency(family),families=currency==='USD'?r1Families:eurR1Families
  if(input.settings.selected.some(f=>!families.includes(f)))throw new Error('Relationship inputs must match the selected currency.')
  const history=createR1History(input.events),at=input.asOf??input.release.releaseAt??0
  const prepared=new Map(families.map(f=>[f,prepareR1Features(history,r1Profiles[f])]))
  const originalRelease=history.releases.find(r=>r.id===input.release.id)??input.release
  const assessment=assessR1(originalRelease,r1Profiles[family],history,input.settings.calibration,input.savedBands,false,prepared.get(family))
  const snapshot=createR1SnapshotReader({...input,currency})
  const overall=snapshot(at,true),before=snapshot(at-1,false)
  const publications=history.releases.filter(r=>r.releaseAt===at&&r.currency===currency).flatMap(r=>{
    const mapped=r1ReleaseFamily(r)
    return mapped&&input.settings.selected.some(f=>(r1Profiles[f].releaseFamily??f)===r.familyId&&r1Profiles[f].components.some(c=>r.events.some(e=>e.event_id===c.seriesId)))?[r1Profiles[mapped].label]:[]
  })
  const corrections=overall.slots.filter(s=>s.assessment?.publishedAt!==at&&s.assessment?.readings.some(r=>r.knownAt===at&&r.vintage==='corrected')).map(s=>r1Profiles[s.family].label)
  const expiries=overall.slots.filter(s=>s.status==='stale'&&before.slots.find(b=>b.family===s.family)?.status==='current').map(s=>r1Profiles[s.family].label)
  const assessments=currency==='EUR'?families.filter(f=>(r1Profiles[f].releaseFamily??f)===originalRelease.familyId&&r1Profiles[f].country===originalRelease.country&&r1Profiles[f].components.some(c=>originalRelease.events.some(e=>e.event_id===c.seriesId))).map(f=>f===family?assessment:assessR1(originalRelease,r1Profiles[f],history,input.settings.calibration,input.savedBands,false,prepared.get(f))):[]
  return{assessment,...(assessments.length>1?{assessments}:{}),overall,transition:{before,change:precise(overall.net-before.net),publications:[...new Set(publications)],corrections,expiries}}
}

export type R1SnapshotInput=Omit<R1Input,'release'|'asOf'>&{currency:'USD'|'EUR'}
function upperBound(values:readonly number[],at:number){let lo=0,hi=values.length;while(lo<hi){const mid=(lo+hi)>>>1;if(values[mid]<=at)lo=mid+1;else hi=mid}return lo}
export function r1ObservationClocks(events:R1Input['events']) {
  return [...new Set(events.flatMap(row=>{
    const clocks=row.available_at===undefined?[]:[row.available_at]
    if(row.r1_vintages)try{const versions:unknown=JSON.parse(row.r1_vintages);if(Array.isArray(versions))for(const v of versions)if(Number.isFinite(v?.knownAt))clocks.push(v.knownAt)}catch{/* Invalid provenance remains unavailable. */}
    return clocks
  }))].sort((a,b)=>a-b)
}
export function createR1SnapshotReader(input:R1SnapshotInput,lightweight=false) {
  const currency=input.currency,families=currency==='USD'?r1Families:eurR1Families
  if(input.settings.selected.some(f=>!families.includes(f)))throw new Error('Relationship inputs must match the selected currency.')
  const history=createR1History(input.events)
  const prepared=new Map(families.map(f=>[f,prepareR1Features(history,r1Profiles[f]).slice().sort((a,b)=>a.release.releaseAt!-b.release.releaseAt!)]))
  const schedules:R1Schedule[]=[...(input.schedules??[])]
  const policy=input.settings.freshness??(currency==='USD'?r1DefaultFreshness:eurR1DefaultFreshness)
  const combine=currency==='USD'?combineR1:combineEurR1
  // Publication selection changes with time; an observation/correction can also
  // change a comparison against an earlier period. Cache only within that epoch.
  const observations=new Map(families.map(f=>{const rows=input.events.filter(row=>r1Profiles[f].components.some(c=>c.seriesId===row.event_id));return[f,[...new Set([...r1ObservationClocks(rows),...prepared.get(f)!.map(e=>e.release.releaseAt!)])].sort((a,b)=>a-b)]}))
  const cache=new Map<R1Family,{key:string;assessment:R1Assessment}>()
  type Entry=ReturnType<typeof prepareR1Features>[number]
  const selections=new Map<R1Family,{epoch:number;entry:Entry|undefined}>()
  const periods=new WeakMap<Entry,{clocks:number[];epoch:number;value:number}>()
  const scheduleClocks=[...new Set(schedules.map(s=>s.knownAt))].sort((a,b)=>a-b)
  const freshness=new Map<R1Family,{assessment:R1Assessment|null;epoch:number;slot:R1Slot}>()
  let nominal:R1Aggregate|null=null
  return function snapshot(clock:number,sensitivity=false) {
  const assessments=new Map<R1Family,R1Assessment>()
  for(const f of input.settings.selected){
    const epoch=upperBound(observations.get(f)!,clock),selection=selections.get(f)
    let entry=selection?.epoch===epoch?selection.entry:undefined
    if(selection?.epoch!==epoch){
    let best=-Infinity
    // A single pass replaces comparator scans of every historical publication.
    // Reference metadata changes only at its own captured observation clocks.
    for(const candidate of prepared.get(f)!){
      if(candidate.release.releaseAt!>clock)break
      let cachedPeriod=periods.get(candidate)
      const clocks=cachedPeriod?.clocks??r1ObservationClocks(candidate.release.events)
      const observation=upperBound(clocks,clock)
      if(cachedPeriod?.epoch!==observation){
        const declared=Math.max(-Infinity,...r1Profiles[f].components.flatMap(c=>candidate.release.events.filter(row=>row.event_id===c.seriesId).map(row=>reference(r1Observation(row,clock).row??row,c.period)??-Infinity)))
        // A published PMI identifies a newer month even when Orders is missing.
        const value=f==='ism-manufacturing'&&!Number.isFinite(declared)?Math.max(-Infinity,...candidate.release.events.filter(row=>row.event_id==='840040001').map(row=>reference(r1Observation(row,clock).row??row,'month')??-Infinity)):declared
        cachedPeriod={clocks,epoch:observation,value};periods.set(candidate,cachedPeriod)
      }
      const period=cachedPeriod.value
      if(!entry||period>best||period===best&&candidate.release.releaseAt!>entry.release.releaseAt!){entry=candidate;best=period}
    }
    selections.set(f,{epoch,entry})
    }
    if(!entry)continue
    const momentum=r1Profiles[f].components.some(c=>c.period==='quarter')
    const assessSensitivity=sensitivity||!lightweight
    const key=`${entry.release.id}/${epoch}/${assessSensitivity}`
    const cached=cache.get(f)
    const assessment=cached?.key===key?cached.assessment:assessR1(entry.release,r1Profiles[f],history,input.settings.calibration,input.savedBands,momentum,momentum?undefined:prepared.get(f),clock,assessSensitivity)
    cache.set(f,{key,assessment});assessments.set(f,assessment)
  }
  const scheduleEpoch=upperBound(scheduleClocks,clock)
  const slots=input.settings.selected.map(f=>{
    const assessment=assessments.get(f)??null,cached=freshness.get(f)
    let slot=cached?.assessment===assessment&&cached.epoch===scheduleEpoch?cached.slot:null
    if(slot&&slot.expiresAt!==null){const status=clock>slot.expiresAt?'stale':'current';if(status!==slot.status)slot={...slot,status}}
    slot??=r1Freshness(f,assessment,clock,schedules,policy)
    freshness.set(f,{assessment,epoch:scheduleEpoch,slot});return slot
  })
  if(!nominal||slots.some((slot,i)=>slot!==nominal!.slots[i]))nominal=combine(slots,input.settings.selected,clock)
  const combined=sensitivity?{...nominal,at:clock,slots,categories:nominal.categories.map(c=>({...c}))}:{...nominal,at:clock,slots}
  if(!sensitivity)return combined
  const alternatives=Object.fromEntries([...assessments].map(([f,a])=>[f,readingVariants(a,r1Profiles[f])]))
  const overall=currency==='USD'?aggregateSensitivity(combined,input.settings,alternatives):combined
  if(currency==='EUR'){
    const variants=Object.entries(alternatives).flatMap(([f,values])=>values!.map(assessment=>combineEurR1(slots.map(s=>s.family===f?{...s,assessment}:s),input.settings.selected,clock)))
    variants.push(combineEurR1(slots,input.settings.selected,clock,{...eurCategoryWeights,inflation:.35,activity:.25}),combineEurR1(slots,input.settings.selected,clock,{...eurCategoryWeights,inflation:.45,activity:.15}))
    overall.sensitive=variants.some(v=>v.direction!==overall.direction)
    overall.sensitivityRange=[Math.min(overall.interval[0],...variants.map(v=>v.interval[0])),Math.max(overall.interval[1],...variants.map(v=>v.interval[1]))]
  }
  const timingPolicies=[...[0,72].map(graceHours=>({...policy,graceHours})),...[.8,1.2].map(factor=>({...policy,fallbackDays:Object.fromEntries(families.map(f=>[f,Math.max(1,Math.round((policy.fallbackDays[f]??45)*factor))])) as typeof policy.fallbackDays}))]
  overall.timingSensitive=timingPolicies.some(p=>combine(input.settings.selected.map(f=>r1Freshness(f,assessments.get(f)??null,clock,schedules,p)),input.settings.selected,clock).direction!==overall.direction)
  return overall
  }
}
