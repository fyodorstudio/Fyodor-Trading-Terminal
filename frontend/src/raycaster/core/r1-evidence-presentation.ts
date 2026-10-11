import type { R1TimelineState, R1Update } from '../../scoring-system/r1/timeline'
import { precise } from '../../scoring-system/r1/arithmetic'
import {r1DisplayChangeParts as r1DisplayParts} from '../../scoring-system/r1/changes'
export {r1DisplayParts}

const tankMagnitude=(value:number)=>Math.min(100,Math.abs(value))
export function r1TankGeometry(state:R1TimelineState) {
  const previous=state.update?.before??state.net
  return {fillHeight:tankMagnitude(state.net),previousBottom:tankMagnitude(previous)}
}

export function r1UpdateRows(update:R1Update) {
  const parts=r1DisplayParts(update),assigned=new Set<string>()
  return [...update.standalone.map(score=>{
    const part=assigned.has(score.family)?undefined:parts.find(p=>p.family===score.family)
    assigned.add(score.family)
    return {key:`${score.releaseId}/${score.family}`,label:score.label,score,change:part?.change}
  }),...parts.filter(p=>!p.family||!assigned.has(p.family)).map(p=>({key:p.family??p.label,label:p.label,score:undefined,change:p.change}))]
}

export function r1EvidencePoints(value:number) {
  const rounded=Math.round(value*100)/100
  return `${rounded>0?'+':''}${rounded.toFixed(2)}`
}

export function r1EvidenceComparison(eur:R1TimelineState,usd:R1TimelineState) {
  const gap=precise(usd.net-eur.net)
  const unavailable=eur.direction==='empty'||usd.direction==='empty'
  const lower=usd.interval[0]-eur.interval[1],upper=usd.interval[1]-eur.interval[0]
  return {gap,leader:gap>0?'USD':gap<0?'EUR':null,unavailable,uncertain:unavailable||(gap>0?lower<=0:gap<0?upper>=0:lower!==0||upper!==0)}
}
