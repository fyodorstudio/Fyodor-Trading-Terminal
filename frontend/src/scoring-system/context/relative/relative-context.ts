import type { ContextPoint } from '../usd/contracts'
import type { EurContextPoint } from './contracts'
import { interpretationQuality, decisionLabel } from '../usd/interpretation-quality'
// Both legs use signed 0–4 magnitude votes in a 100% budget. Normalize each
// leg to [-1,1] before subtracting; missing weight is never redistributed.
export function relativeContext(eur: EurContextPoint | null, usd: ContextPoint | null) {
  const eurTotal = eur?.total ?? null, usdTotal = usd?.result.total == null ? null : usd.result.total / 4
  if (eurTotal === null || usdTotal === null) return { label: 'Insufficient context', direction: 'insufficient', strength: null,
    total: null, eurTotal, usdTotal, explanation: 'Both currency legs need usable numerical context for a relative interpretation.' } as const
  const total = eurTotal - usdTotal
  const gross = (eur?.members.reduce((sum,m)=>sum+Math.abs(m.contribution),0) ?? 0) + (usd?.result.members.reduce((sum,m)=>sum+Math.abs(m.contribution)/4,0) ?? 0)
  const usableUsd = usd!.result.decision?.coverage ?? usd!.result.members.filter(m=>m.status==='active')
    .reduce((sum,m)=>sum+(usd!.result.policy?.weights[m.family] ?? m.memory?.effectiveWeight ?? 0) * (m.coverage ?? 1) / 100,0)
  const eurUsable = eur?.usableCoverage ?? eur?.coverage ?? 0
  const decision = interpretationQuality(total, gross, Math.min(eurUsable, usableUsd))
  const withheld = decisionLabel(decision)
  if (withheld) return { label: withheld, direction: decision.state === 'mixed' ? 'mixed' : 'insufficient', strength: null,
    total, eurTotal, usdTotal, explanation: decision.reason } as const
  const deciding = total
  const direction = deciding > 0 ? 'long' : deciding < 0 ? 'short' : 'uncomputed'
  const usdCoverage = usd!.result.members.filter(m=>m.status==='active').reduce((sum,m)=>sum+(m.memory?.effectiveWeight ?? 0)/100,0)
  const weak = eurUsable < 1 - 1e-12 || usableUsd < 1 - 1e-12 || Math.abs(total)<1e-12 || !gross || Math.abs(total)/gross < 1/3 || (eur?.coverage ?? 0) < .6 || usdCoverage < .6 || usd!.result.strength === 'weak' || eur!.members.some(m=>m.status==='active' && (m.provisional || m.coverage<1))
  const strength = direction === 'uncomputed' ? null : weak ? 'weak' : 'moderate'
  return { label: direction==='uncomputed' ? 'Uncomputed' : direction==='long' ? 'EURUSD Long' : 'EURUSD Short', direction, strength, total, eurTotal, usdTotal,
    explanation: direction==='uncomputed' ? 'Neither currency leg has a directional change.' : `${direction==='long' ? 'EUR support relative to USD' : 'USD support relative to EUR'} leads in the available evidence under the declared numerical rules. Country proxies replace only missing aggregate periods; this remains a dataset-only interpretation.${eurUsable < 1 - 1e-12 || usableUsd < 1 - 1e-12 ? ` Usable configured coverage: EUR ${(eurUsable * 100).toFixed(1)}%, USD ${(usableUsd * 100).toFixed(1)}%. Missing components do not confirm this qualified result.` : ''}` }
}
export function eurContextAt(timeline: { points: EurContextPoint[] }, at: number) {
  let lo=0,hi=timeline.points.length
  while(lo<hi){const mid=(lo+hi)>>>1;if(timeline.points[mid].chartAt<=at)lo=mid+1;else hi=mid}
  return timeline.points[lo-1] ?? null
}
