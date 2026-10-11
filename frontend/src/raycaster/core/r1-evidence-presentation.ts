import type { R1TimelineState, R1Update } from '../../scoring-system/r1/timeline'
import { precise } from '../../scoring-system/r1/arithmetic'

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
