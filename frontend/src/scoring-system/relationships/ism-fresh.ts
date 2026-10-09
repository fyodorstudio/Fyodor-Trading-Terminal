import type { ContextMember, FamilyAssessment } from '../context/usd/contracts'
import type { ComboSource, FreshChange } from './contracts'
import { compareSourceSupport } from './compare-source-support'
import { contextWeights } from '../context/usd/policy'

export type IsmFreshMemory = { previous: Map<string, FamilyAssessment>; references: Map<string, number | null>; changes: Map<string, FreshChange & { referenceMonth: number | null }> }
export const createIsmFreshMemory = (): IsmFreshMemory => ({ previous: new Map(), references: new Map(), changes: new Map() })

/** Each sector compares to its own preceding publication, never the partial monthly assembly. */
export function updateIsmFresh(memory: IsmFreshMemory, sectors: readonly ComboSource[], member: ContextMember, prior: ContextMember | undefined, at: number): FreshChange | null {
  const nominal = contextWeights.ism / 100
  const clean = (n: number) => Math.round(n * 1e12) / 1e12
  let changed = false
  for (const source of sectors.filter(s => s.chartAt === at && s.sector && s.assessment)) {
    const current = source.assessment!, sector = source.sector!, old = memory.previous.get(sector)
    if (old?.sourceId === current.sourceId) continue
    changed = true
    const matched = old && current.chartAt > old.chartAt && current.chartAt - old.chartAt < 45 * 86400000 &&
      source.referenceMonth != null && memory.references.get(sector) != null && source.referenceMonth === memory.references.get(sector)! + 1 &&
      (old.coverage ?? 0) >= .6 && (current.coverage ?? 0) >= .6 && old.coverage === current.coverage &&
      old.comparisonBasis === current.comparisonBasis
    const comparison = matched ? compareSourceSupport(old, current) : null
    const comparable = comparison?.previousAtCurrentCalibration != null
    const weight = nominal * (sector === 'services' ? .7 : .3)
    const change = comparable ? clean((current.total! - comparison!.previousAtCurrentCalibration!) * weight) : 0
    const calibrationChange = comparable ? clean((comparison!.previousAtCurrentCalibration! - old!.total!) * weight) : 0
    memory.previous.set(sector, current)
    memory.references.set(sector, source.referenceMonth ?? null)
    memory.changes.set(sector, { ...source, family: 'ism', change, comparable, calibrationChange,
      referenceMonth: source.referenceMonth ?? null,
      role: comparable ? `${sector} change versus its preceding comparable publication; ${sector === 'services' ? 70 : 30}% of the ISM budget` :
        `${sector}: preceding comparable sector publication unavailable` })
  }
  if (!changed) return null
  const reference = sectors.find(s => s.chartAt === at)?.referenceMonth
  const participants = [...memory.changes.values()].filter(s => at - s.chartAt < 7 * 86400000 && s.referenceMonth === reference)
  const change = clean(participants.reduce((sum, s) => sum + s.change, 0))
  const calibrationChange = clean(participants.reduce((sum, s) => sum + (s.calibrationChange ?? 0), 0))
  const replacementChange = clean((member.status === 'active' ? member.total! : 0) * nominal -
    (prior?.status === 'active' ? prior.total! * (prior.memory?.retention ?? 1) : 0) * nominal)
  // Earlier sector changes remain visible, but are not charged again to this replacement.
  const incoming = participants.filter(s => s.chartAt === at)
  const scoreChange = clean(incoming.reduce((sum, s) => sum + s.change, 0))
  const incomingCalibration = clean(incoming.reduce((sum, s) => sum + (s.calibrationChange ?? 0), 0))
  const memoryRenewal = prior?.status === 'active' ? clean(prior.total! * (1 - (prior.memory?.retention ?? 1)) * nominal) : 0
  return { ...member, change, scoreChange, calibrationChange: incomingCalibration, replacementChange, memoryRenewal,
    availabilityChange: clean(replacementChange - scoreChange - incomingCalibration - memoryRenewal),
    comparable: participants.some(s => s.comparable), participants,
    role: `ISM sector changes retain their 70/30 budget; calibration effect ${calibrationChange.toFixed(3)} is non-voting.` }
}
