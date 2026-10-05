import type { InspectorRelease } from '../../inspector/inspector-data'
import type { ScatterReleaseTarget } from '../contracts/scatter-plot-types'
import { scatterFamilyBindings } from '../dock/scatter-family-bindings'

export function scatterReleaseTarget(release: InspectorRelease | null, brokerId: string | null | undefined, now: number): ScatterReleaseTarget | null {
  if (!release || !brokerId || release.releaseAt === null || release.chartTime === null || release.timingUncertain ||
    !Number.isFinite(release.releaseAt) || release.releaseAt > now) return null
  const binding = scatterFamilyBindings.find((candidate) => candidate.family.familyId === release.familyId &&
    candidate.family.country === release.country && candidate.family.currency === release.currency)
  if (!binding || release.releaseAt < binding.family.historyStart) return null
  return { brokerId, familyId: binding.family.familyId, releaseId: release.id, at: release.releaseAt }
}
