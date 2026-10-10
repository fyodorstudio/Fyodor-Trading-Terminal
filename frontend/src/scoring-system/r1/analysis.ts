import type { R1Analysis, R1Assessment, R1Family, R1Input, R1Schedule } from './contracts'
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
  const schedules:R1Schedule[]=[...(input.schedules??[])]
  const policy=input.settings.freshness??(currency==='USD'?r1DefaultFreshness:eurR1DefaultFreshness)
  const combine=currency==='USD'?combineR1:combineEurR1
  function snapshot(clock:number,sensitivity:boolean) {
  const assessments=new Map<R1Family,R1Assessment>()
  for(const f of input.settings.selected){
    const candidates=prepared.get(f)!.filter(e=>e.release.releaseAt!<=clock)
    // Choose the newest declared period before inspecting completeness or sign.
    const period=(e:typeof candidates[number])=>{
      const declared=Math.max(-Infinity,...r1Profiles[f].components.flatMap(c=>e.release.events.filter(row=>row.event_id===c.seriesId).map(row=>reference(r1Observation(row,clock).row??row,c.period)??-Infinity)))
      // A published PMI can identify the new reference month without supplying
      // the missing Orders vote. Never reuse old Orders for that newer report.
      return f==='ism-manufacturing'&&!Number.isFinite(declared)?Math.max(-Infinity,...e.release.events.filter(row=>row.event_id==='840040001').map(row=>reference(r1Observation(row,clock).row??row,'month')??-Infinity)):declared
    }
    const entry=candidates.sort((a,b)=>period(b)-period(a)||b.release.releaseAt!-a.release.releaseAt!)[0]
    if(!entry)continue
    const momentum=r1Profiles[f].components.some(c=>c.period==='quarter')
    assessments.set(f,f===family&&entry.release.id===input.release.id&&!momentum&&clock===input.release.releaseAt?assessment:assessR1(entry.release,r1Profiles[f],history,input.settings.calibration,input.savedBands,momentum,momentum?undefined:prepared.get(f),clock))
  }
  const slots=input.settings.selected.map(f=>r1Freshness(f,assessments.get(f)??null,clock,schedules,policy))
  const combined=combine(slots,input.settings.selected,clock)
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
