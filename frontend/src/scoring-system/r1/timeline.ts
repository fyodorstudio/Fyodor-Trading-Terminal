import type { R1Aggregate, R1Balance, R1Currency, R1Family, R1Settings } from './contracts'
import { createR1SnapshotReader, r1ObservationClocks, type R1SnapshotInput } from './analysis'
import { createR1History } from './features'
import { r1Profiles } from './profiles'
import { precise } from './arithmetic'

export type R1TimelineInput=Omit<R1SnapshotInput,'currency'|'settings'>&{usdSettings:R1Settings;eurSettings:R1Settings;end:number}
export type R1Update={at:number;before:number;after:number;change:number;kind:'publication'|'expiry'|'correction'|'schedule';releases:{id:string;family:string;label:string;country:string}[]}
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
  const publications=new Map<number,typeof history.releases>()
  for(const release of history.releases)if(release.releaseAt!==null&&release.releaseAt>=start&&release.releaseAt<=input.end&&settings[release.currency].selected.some(f=>relevant(f,release))){
    const at=release.releaseAt;publications.set(at,[...(publications.get(at)??[]),release])
  }
  const observations=new Set(r1ObservationClocks(input.events)),announcements=new Set((input.schedules??[]).map(s=>s.knownAt))
  const clocks=[...new Set([start,...publications.keys(),...observations,...announcements])].filter(at=>at>=start&&at<=input.end).sort((a,b)=>a-b)
  const seen=new Set(clocks),points:R1TimelinePoint[]=[],last:Record<R1Currency,R1TimelineState|null>={USD:null,EUR:null}
  function expiry(at:number,index:number){if(at>input.end||seen.has(at))return;seen.add(at);let lo=index+1,hi=clocks.length;while(lo<hi){const mid=(lo+hi)>>>1;if(clocks[mid]<at)lo=mid+1;else hi=mid}clocks.splice(lo,0,at)}
  for(let i=0;i<clocks.length;i++){
    const at=clocks[i],next={} as Record<R1Currency,R1TimelineState>
    for(const currency of currencies){
      const aggregate=readers[currency](at),previous=last[currency]
      for(const slot of aggregate.slots)if(slot.status==='current'&&slot.expiresAt!==null)expiry(slot.expiresAt+1,i)
      const releases=(publications.get(at)??[]).filter(r=>r.currency===currency).map(r=>({id:r.id,family:r.familyId,label:r.label,country:r.country}))
      const changed=previous&&(aggregate.net!==previous.net||aggregate.unavailable!==previous.unavailable)
      const kind=releases.length?'publication':observations.has(at)?'correction':announcements.has(at)?'schedule':'expiry'
      const update:R1Update|null=releases.length||changed?{at,before:previous?.net??0,after:aggregate.net,change:precise(aggregate.net-(previous?.net??0)),kind,releases}:previous?.update??null
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
