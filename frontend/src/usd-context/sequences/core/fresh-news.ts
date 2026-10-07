import type { ContextFamily, ContextResult, UsdDirection } from '../../core/contracts'
import { contextWeights } from '../../core/policy'
import { interpretationQuality } from '../../core/interpretation-quality'
import type { FreshChange, FreshPoint } from './contracts'
import { compareSourceSupport } from './compare-source-support'

export const freshWindowMs = 7 * 86400000
const domain = (family: ContextFamily) => ['cpi', 'pce', 'ppi'].includes(family) ? 'inflation' :
  ['nfp', 'claims'].includes(family) ? 'labor' : 'activity'

/** A comparable economic score change is distinct from its replacement effect and standalone bias.
 * Only the latest change per family is retained; overlapping reports do not stack.
 * Reweighting other families is excluded, so a policy transfer is not new data.
 */
export function updateFreshNews(latest: Map<ContextFamily, FreshChange>, before: ContextResult | null,
  after: ContextResult, chartAt: number) {
  for (const member of after.members.filter(m => m.chartAt === chartAt)) {
    const old = before?.members.find(m => m.family === member.family)
    const usable = member.status === 'active'
    const oldUsable = old?.status === 'active' && old.total !== null
    const oldCoverage = oldUsable ? old.coverage ?? 1 : 0
    const newCoverage = usable ? member.coverage ?? 1 : 0
    const previous = oldUsable ? old.total! * (old.memory?.retention ?? 1) : 0
    const next = usable ? member.total! : 0
    // Constant nominal budget for the two readings; no policy-transfer bonus.
    const nominal = contextWeights[member.family]
    const clean = (value: number) => Math.round(value * 1e12) / 1e12 || 0
    const matched = !!oldUsable && usable && oldCoverage >= .6 && newCoverage >= .6 && Math.abs(oldCoverage - newCoverage) < 1e-12 &&
      !!member.comparisonBasis && member.comparisonBasis === old?.comparisonBasis
    const comparison = matched ? compareSourceSupport(old!, member) : null
    const comparable = comparison?.previousAtCurrentCalibration != null
    const scoreChange = comparable ? clean((member.total! - comparison!.previousAtCurrentCalibration!) * nominal / 100) : 0
    const calibrationChange = comparable ? clean((comparison!.previousAtCurrentCalibration! - old!.total!) * nominal / 100) : 0
    const memoryRenewal = oldUsable && usable ? clean(old.total! * (1 - (old.memory?.retention ?? 1)) * nominal / 100) : 0
    const replacementChange = clean((next - previous) * nominal / 100)
    const availabilityChange = clean(replacementChange - scoreChange - calibrationChange - memoryRenewal)
    latest.set(member.family, { ...member, change: scoreChange, scoreChange, replacementChange, calibrationChange, memoryRenewal, availabilityChange, comparable,
      contribution: member.contribution, role: !usable ? 'Unavailable new assessment; no economic change vote' : !comparable ?
        `No comparable predecessor, components, weights or calibration; no support-change vote${comparison?.reason ? ` · ${comparison.reason}` : ''}` : scoreChange === 0 ?
          'Unchanged interpreted support at common calibration; renewal is separate' : 'Change in interpreted support; calibration and renewal are separate' })
  }
}

export function freshNewsAt(latest: ReadonlyMap<ContextFamily, FreshChange>, chartAt: number): FreshPoint {
  const members = [...latest.values()].filter(m => m.chartAt <= chartAt && chartAt - m.chartAt < freshWindowMs).map(m => {
    if (m.family !== 'ism' || !m.participants) return m
    const participants = m.participants.filter(p => p.chartAt <= chartAt && chartAt - p.chartAt < freshWindowMs)
    return { ...m, participants, comparable: participants.some(p => p.comparable),
      change: Math.round(participants.reduce((sum, p) => sum + (p.change ?? 0), 0) * 1e12) / 1e12 }
  })
  const directional = members.filter(m => m.change !== 0)
  const total = directional.length ? Math.round(directional.reduce((sum, m) => sum + m.change, 0) * 1e12) / 1e12 : null
  const deciding = total
  const direction: UsdDirection = deciding == null || deciding === 0 ? 'uncomputed' : deciding > 0 ? 'stronger' : 'weaker'
  const domains = new Map<string, number>()
  for (const m of directional) domains.set(domain(m.family), (domains.get(domain(m.family)) ?? 0) + m.change)
  const agreeingDomains = [...domains.values()].filter(v => Math.sign(v) === Math.sign(deciding ?? 0) && v !== 0).length
  const gross = directional.reduce((sum, m) => sum + Math.abs(m.change), 0)
  const decision = interpretationQuality(total, gross, directional.length ? 1 : 0)
  return { chartAt, total, direction, members, agreeingDomains, decision,
    explanation: decision.state === 'mixed' ? 'Changes in interpreted support conflict or cancel; no directional fresh-news output. Calibration drift, memory renewal and coverage changes do not vote.' : directional.length ?
      `Changes in interpreted support within seven days ${direction === 'stronger' ? 'increase' : 'reduce'} USD support. ${agreeingDomains} economic domains agree. Both readings use the latest release calibration. Calibration drift, memory renewal, changed coverage and newly available assessments do not vote in this experiment.` :
      'No comparable changes in interpreted support are available within seven days. Calibration, coverage and renewal remain visible in details without a directional change vote.' }
}

export function lookupFreshNews(points: readonly FreshPoint[], chartAt: number) {
  let lo = 0, hi = points.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (points[mid].chartAt <= chartAt) lo = mid + 1; else hi = mid }
  const point = points[lo - 1]
  return point ? freshNewsAt(new Map(point.members.map(m => [m.family, m])), chartAt) : null
}
