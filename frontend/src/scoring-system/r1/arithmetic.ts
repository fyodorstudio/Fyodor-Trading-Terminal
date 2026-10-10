import type { R1Balance, R1Family, R1Leaf } from './contracts'

// Source decimal values are preserved to six places, including exact MT5 scaled
// integers. Threshold equality never depends on a subtraction's binary residue.
export function decimal(value: number | null, raw?: string | null): number | null {
  if (value === null || !Number.isFinite(value)) return null
  if (raw != null) { if (!/^[+-]?\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) return null; return Number(raw) }
  const integer = Math.round(value * 1e6)
  return Number.isSafeInteger(integer) ? integer : null
}
export const precise = (value: number) => Math.round(value*1e9)/1e9 || 0
export function magnitude(delta: number, limits: readonly number[], factor=1) {
  const x=Math.abs(delta),scaled=decimal(x)
  if (!x) return 0
  return limits.findIndex(limit=>{const boundary=decimal(limit);return scaled!==null&&boundary!==null?scaled<=Math.round(boundary*factor):x<=limit*factor})+1 || 4
}
export const usesFractionalMagnitude = (family:R1Family) => family==='claims'||family==='ism-manufacturing'||!['us-cpi','pce','ppi','jobs','gdp','retail','ism-services','fomc'].includes(family)
export function magnitudePoints(family:R1Family,delta:number,limits:readonly number[],factor=1) {
  if(!usesFractionalMagnitude(family))return magnitude(delta,limits,factor)
  const raw=Math.abs(delta),scaled=decimal(raw),x=scaled===null?raw:scaled/1e6
  if(!x)return 0
  let lower=0,points=0
  for(let i=0;i<limits.length;i++){
    const boundary=decimal(limits[i]),upper=boundary===null?limits[i]*factor:Math.round(boundary*factor)/1e6,target=i===2?4:i+1
    // Equality stays in the lower band; tied automatic limits skip zero-width spans.
    // Round contributions after weighting, not these fractional points.
    if(x<=upper)return upper===lower?points:points+(target-points)*(x-lower)/(upper-lower)
    lower=upper;points=target
  }
  return 4
}
export function balance(leaves: readonly R1Leaf[]): R1Balance {
  const supportive=precise(leaves.reduce((s,l)=>s+Math.max(l.value??0,0),0))
  // Resolve the unrounded signed sum first; reconcile displayed sides to that
  // net instead of letting separate side rounding create a directional vote.
  const net=precise(leaves.reduce((s,l)=>s+(l.value??0),0)),negative=precise(net-supportive)
  const unavailable=precise(leaves.reduce((s,l)=>s+(l.value===null?l.budget:0),0))
  const lower=precise(net-unavailable),upper=precise(net+unavailable),budget=leaves.reduce((s,l)=>s+l.budget,0)
  const direction=!leaves.length?'empty':lower>0?'strengthening':upper<0?'weakening':unavailable?'insufficient':'balanced'
  const guaranteed=Math.max(0,Math.abs(net)-unavailable)
  return {supportive,negative,net,unavailable,interval:[lower,upper],direction,strength:direction==='strengthening'||direction==='weakening'?guaranteed<=10?'slight':guaranteed<=30?'moderate':'strong':null,coverage:budget?precise((budget-unavailable)/budget):0,sensitive:false,sensitivityRange:null}
}
// Round balances after allocation, not each intermediate leaf: individually
// rounding three cancelling contributions can manufacture a nonzero lead.
export const multiplyLeaves=(leaves:readonly R1Leaf[],coefficient:number,role?:string):R1Leaf[]=>leaves.map(l=>({...l,value:l.value===null?null:l.value*coefficient,budget:precise(l.budget*coefficient),...(role?{role}:{})}))
