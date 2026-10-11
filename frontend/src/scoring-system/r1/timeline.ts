import type { R1Aggregate, R1Assessment, R1Balance, R1Currency, R1Family, R1Settings } from './contracts'
import { assessFedPublication,createR1SnapshotReader, r1ObservationClocks, type R1SnapshotInput } from './analysis'
import { createR1History } from './features'
import { r1Profiles,r1Families } from './profiles'
import { precise } from './arithmetic'
import { assessR1 } from './assessment'

export type R1TimelineInput=Omit<R1SnapshotInput,'currency'|'settings'>&{usdSettings:R1Settings;eurSettings:R1Settings;end:number}
export type R1UpdatePart={label:string;change:number;family?:R1Family}
export type R1ReleaseScore=Pick<R1Assessment,'family'|'label'|'releaseId'|'net'|'direction'|'strength'|'unavailable'|'explanation'>
export type R1Update={at:number;before:number;after:number;change:number;kind:'publication'|'expiry'|'correction'|'schedule';releases:{id:string;family:string;label:string;country:string}[];parts:R1UpdatePart[];standalone:R1ReleaseScore[]}
export type R1TimelineState=Pick<R1Balance,'supportive'|'negative'|'net'|'unavailable'|'interval'|'direction'|'strength'|'coverage'>&{update:R1Update|null}
export type R1TimelinePoint={at:number;USD:R1TimelineState;EUR:R1TimelineState}
export type R1Timeline={points:R1TimelinePoint[]}
const currencies=['USD','EUR'] as const
const state=(aggregate:R1Aggregate,update:R1Update|null):R1TimelineState=>({supportive:aggregate.supportive,negative:aggregate.negative,net:aggregate.net,unavailable:aggregate.unavailable,interval:aggregate.interval,direction:aggregate.direction,strength:aggregate.strength,coverage:aggregate.coverage,update})
function relevant(family:R1Family,release:ReturnType<typeof createR1History>['releases'][number]) {
  const p=r1Profiles[family]
  return (p.releaseFamily??family)===release.familyId&&(p.country??'US')===release.country&&(p.currency??'USD')===release.currency&&release.events.some(row=>p.components.some(c=>c.seriesId===row.event_id))
}
// Compute only at evidence-changing clocks. Cursor lookup never calls a scorer.
export function calculateR1Timeline(input:R1TimelineInput):R1Timeline {
  const history=createR1History(input.events),start=Date.UTC(2015,0,1)
  const readers={USD:createR1SnapshotReader({...input,currency:'USD',settings:input.usdSettings},true),EUR:createR1SnapshotReader({...input,currency:'EUR',settings:input.eurSettings},true)}
  const settings={USD:input.usdSettings,EUR:input.eurSettings}
  const fedReader=createR1SnapshotReader({...input,currency:'USD',settings:{...input.usdSettings,selected:r1Families}},true)
  const publications=new Map<number,typeof history.releases>()
  for(const release of history.releases)if(release.releaseAt!==null&&release.releaseAt>=start&&release.releaseAt<=input.end&&settings[release.currency].selected.some(f=>relevant(f,release))){
    const at=release.releaseAt;publications.set(at,[...(publications.get(at)??[]),release])
  }
  const observations=new Set(r1ObservationClocks(input.events)),announcements=new Set((input.schedules??[]).map(s=>s.knownAt))
  const clocks=[...new Set([start,...publications.keys(),...observations,...announcements])].filter(at=>at>=start&&at<=input.end).sort((a,b)=>a-b)
  const seen=new Set(clocks),points:R1TimelinePoint[]=[],last:Record<R1Currency,R1TimelineState|null>={USD:null,EUR:null}
  const previousTotals:Record<R1Currency,Map<R1Family,number>>={USD:new Map(),EUR:new Map()}
  function expiry(at:number,index:number){if(at>input.end||seen.has(at))return;seen.add(at);let lo=index+1,hi=clocks.length;while(lo<hi){const mid=(lo+hi)>>>1;if(clocks[mid]<at)lo=mid+1;else hi=mid}clocks.splice(lo,0,at)}
  for(let i=0;i<clocks.length;i++){
    const at=clocks[i],next={} as Record<R1Currency,R1TimelineState>
    for(const currency of currencies){
      const aggregate=readers[currency](at),previous=last[currency]
      for(const slot of aggregate.slots)if(slot.status==='current'&&slot.expiresAt!==null)expiry(slot.expiresAt+1,i)
      const releases=(publications.get(at)??[]).filter(r=>r.currency===currency).map(r=>({id:r.id,family:r.familyId,label:r.label,country:r.country}))
      const changed=previous&&(aggregate.net!==previous.net||aggregate.unavailable!==previous.unavailable)
      const kind=releases.length?'publication':observations.has(at)?'correction':announcements.has(at)?'schedule':'expiry'
      const totals=new Map<R1Family,number>()
      for(const leaf of aggregate.leaves)totals.set(leaf.family,(totals.get(leaf.family)??0)+(leaf.value??0))
      let update=previous?.update??null
      if(releases.length||changed){
        const published=settings[currency].selected.filter(f=>(publications.get(at)??[]).some(r=>relevant(f,r)))
        const parts:R1UpdatePart[]=[],families=new Set([...previousTotals[currency].keys(),...totals.keys(),...published])
        let adjustment=0
        for(const family of families){
          const change=precise((totals.get(family)??0)-(previousTotals[currency].get(family)??0))
          if(releases.length&&!published.includes(family))adjustment+=change
          else if(change||published.includes(family))parts.push({family,label:r1Profiles[family].label,change})
        }
        // Replacing an inflation anchor can remove CPI or realign PPI without
        // publishing them again. Keep that change visible instead of assigning
        // it arbitrarily to a simultaneous release.
        if(precise(adjustment))parts.push({label:'Relationship adjustment',change:precise(adjustment)})
        const standalone:R1ReleaseScore[]=[]
        for(const release of publications.get(at)??[])for(const family of settings[currency].selected.filter(f=>relevant(f,release))){
          const profile=r1Profiles[family],slot=aggregate.slots.find(s=>s.family===family)?.assessment
          // Quarterly relationship momentum differs from the release's revision
          // score. Reuse other publication assessments; never calculate on hover.
          const raw=slot?.releaseId===release.id&&!profile.components.some(c=>c.period==='quarter')?slot:assessR1(release,profile,history,settings[currency].calibration,input.savedBands,false,undefined,at,false)
          const a=family==='fomc'?assessFedPublication(release,history,fedReader,raw):raw
          standalone.push({family:a.family,label:a.label,releaseId:a.releaseId,net:a.net,direction:a.direction,strength:a.strength,unavailable:a.unavailable,explanation:a.explanation})
        }
        update={at,before:previous?.net??0,after:aggregate.net,change:precise(aggregate.net-(previous?.net??0)),kind,releases,parts,standalone}
      }
      previousTotals[currency]=totals
      next[currency]=state(aggregate,update);last[currency]=next[currency]
    }
    points.push({at,...next})
  }
  return {points}
}
function upperBound(points:readonly R1TimelinePoint[],at:number){let lo=0,hi=points.length;while(lo<hi){const mid=(lo+hi)>>>1;if(points[mid].at<=at)lo=mid+1;else hi=mid}return lo}
export function r1TimelineAt(timeline:R1Timeline,at:number){return timeline.points[upperBound(timeline.points,at)-1]??null}
export function r1CandleUpdates(timeline:R1Timeline,from:number,to:number,currency:R1Currency):R1Update[]{
  const updates:R1Update[]=[]
  for(let i=upperBound(timeline.points,from-1);i<timeline.points.length&&timeline.points[i].at<=to;i++){
    const point=timeline.points[i],update=point[currency].update
    if(update?.at===point.at)updates.push(update)
  }
  return updates
}
