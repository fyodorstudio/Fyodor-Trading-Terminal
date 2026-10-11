import type { R1TimelineState, R1Update } from '../../scoring-system/r1/timeline'
import { precise } from '../../scoring-system/r1/arithmetic'

const tankPosition=(value:number)=>50-Math.max(-100,Math.min(100,value))/2
export function r1TankGeometry(state:R1TimelineState) {
  const previous=state.update?.before??state.net
  return {fillTop:Math.min(50,tankPosition(state.net)),fillHeight:Math.abs(Math.max(-100,Math.min(100,state.net)))/2,
    previousTop:tankPosition(previous),rangeTop:tankPosition(state.interval[1]),rangeHeight:tankPosition(state.interval[0])-tankPosition(state.interval[1])}
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
// Reconcile display cents only; raw evidence and contributions stay unchanged.
export function r1DisplayParts(update:R1Update) {
  const cents=update.parts.map(p=>Math.round(p.change*100))
  const remainder=Math.round(update.change*100)-cents.reduce((a,b)=>a+b,0)
  if(remainder&&cents.length){
    const largest=update.parts.reduce((best,p,i)=>Math.abs(p.change)>Math.abs(update.parts[best].change)?i:best,0)
    cents[largest]+=remainder
  }
  return update.parts.map((p,i)=>({...p,change:cents[i]/100}))
}
