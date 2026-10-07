import type { ContextFamily, ContextResult, UsdDirection } from '../../core/contracts'
import { contextPriority, contextWeights } from '../../core/policy'
import type { FreshChange, FreshPoint } from './contracts'

export const freshWindowMs = 7 * 86400000
const domain = (family: ContextFamily) => ['cpi', 'pce', 'ppi'].includes(family) ? 'inflation' :
  ['nfp', 'claims'].includes(family) ? 'labor' : 'activity'

/** A replacement's incremental effect is distinct from its standalone bias.
 * Only the latest change per family is retained; overlapping reports do not stack.
 * Reweighting other families is excluded, so a policy transfer is not new data.
 */
export function updateFreshNews(latest: Map<ContextFamily, FreshChange>, before: ContextResult | null,
  after: ContextResult, chartAt: number) {
  for (const member of after.members.filter(m => m.chartAt === chartAt)) {
    const old = before?.members.find(m => m.family === member.family)
    const usable = member.status === 'active'
    const previous = old?.status === 'active' ? old.total! * (old.memory?.retention ?? 1) * (old.memory?.coverage ?? 1) : 0
    const next = usable ? member.total! * (member.memory?.coverage ?? 1) : 0
    // Constant nominal budget for the two readings; no policy-transfer bonus.
    const nominal = contextWeights[member.family]
    const change = usable ? Math.round((next - previous) * nominal / 100 * 1e12) / 1e12 : 0
    latest.set(member.family, { ...member, change, contribution: member.contribution,
      role: usable ? 'Latest replacement effect' : 'No directional update' })
  }
}

export function freshNewsAt(latest: ReadonlyMap<ContextFamily, FreshChange>, chartAt: number): FreshPoint {
  const members = [...latest.values()].filter(m => m.chartAt <= chartAt && chartAt - m.chartAt < freshWindowMs)
  const directional = members.filter(m => m.change !== 0)
  const total = directional.length ? Math.round(directional.reduce((sum, m) => sum + m.change, 0) * 1e12) / 1e12 : null
  const deciding = total === 0 ? contextPriority.map(f => directional.find(m => m.family === f)).find(Boolean)?.change ?? 0 : total
  const direction: UsdDirection = deciding == null || deciding === 0 ? 'uncomputed' : deciding > 0 ? 'stronger' : 'weaker'
  const domains = new Map<string, number>()
  for (const m of directional) domains.set(domain(m.family), (domains.get(domain(m.family)) ?? 0) + m.change)
  const agreeingDomains = [...domains.values()].filter(v => Math.sign(v) === Math.sign(deciding ?? 0) && v !== 0).length
  return { chartAt, total, direction, members, agreeingDomains,
    explanation: directional.length ? `${total === 0 ? 'Replacement effects exactly cancel; the declared family priority supplies a weak direction. ' : `The latest replacement effects within seven days ${direction === 'stronger' ? 'increase' : 'reduce'} USD support. `}${agreeingDomains} economic domains agree. This experimental comparison does not change the accumulated context.` :
      'No directional replacement effects are available within seven days.' }
}

export function lookupFreshNews(points: readonly FreshPoint[], chartAt: number) {
  let lo = 0, hi = points.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (points[mid].chartAt <= chartAt) lo = mid + 1; else hi = mid }
  const point = points[lo - 1]
  return point ? freshNewsAt(new Map(point.members.map(m => [m.family, m])), chartAt) : null
}
