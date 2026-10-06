import type { ContextPoint } from '../../usd-context/core/contracts'
import type { EurContextPoint } from './contracts'
// Both legs use signed 0–4 magnitude votes in a 100% budget. Normalize each
// leg to [-1,1] before subtracting; missing weight is never redistributed.
export function relativeContext(eur: EurContextPoint | null, usd: ContextPoint | null) {
  const eurTotal = eur?.total ?? null, usdTotal = usd?.result.total == null ? null : usd.result.total / 4
  if (eurTotal === null || usdTotal === null) return { label: 'Uncomputed', direction: 'uncomputed', strength: null,
    total: null, eurTotal, usdTotal, explanation: 'Both currency legs need usable numerical context for a relative interpretation.' } as const
  const total = eurTotal - usdTotal
  const gross = (eur?.members.reduce((sum,m)=>sum+Math.abs(m.contribution),0) ?? 0) + (usd?.result.members.reduce((sum,m)=>sum+Math.abs(m.contribution)/4,0) ?? 0)
  // Exact cancellation gives the inflation/labor-led USD leg priority, then EUR.
  const deciding = Math.abs(total) < 1e-12 ? usd!.result.direction === 'stronger' ? -1 : usd!.result.direction === 'weaker' ? 1 : -usdTotal || eurTotal : total
  const direction = deciding > 0 ? 'long' : deciding < 0 ? 'short' : 'uncomputed'
  const usdCoverage = usd!.result.members.filter(m=>m.status==='active').reduce((sum,m)=>sum+(m.memory?.effectiveWeight ?? 0)/100,0)
  const weak = Math.abs(total)<1e-12 || !gross || Math.abs(total)/gross < 1/3 || (eur?.coverage ?? 0) < .6 || usdCoverage < .6 || usd!.result.strength === 'weak' || eur!.members.some(m=>m.status==='active' && (m.provisional || m.coverage<1))
  const strength = direction === 'uncomputed' ? null : weak ? 'weak' : 'moderate'
  return { label: direction==='uncomputed' ? 'Uncomputed' : direction==='long' ? 'EURUSD Long' : 'EURUSD Short', direction, strength, total, eurTotal, usdTotal,
    explanation: direction==='uncomputed' ? 'Neither currency leg has a directional change.' : `${direction==='long' ? 'EUR support relative to USD' : 'USD support relative to EUR'} leads under the declared numerical rules.${Math.abs(total)<1e-12 ? ' Votes cancel; the USD leg decides with Weak evidence.' : ''} Country proxies replace only missing aggregate periods; this remains a dataset-only interpretation.` }
}
export function eurContextAt(timeline: { points: EurContextPoint[] }, at: number) {
  let lo=0,hi=timeline.points.length
  while(lo<hi){const mid=(lo+hi)>>>1;if(timeline.points[mid].chartAt<=at)lo=mid+1;else hi=mid}
  return timeline.points[lo-1] ?? null
}
