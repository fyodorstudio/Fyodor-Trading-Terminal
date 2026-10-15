import type { InspectorRelease } from '../../economic-calendar/releases/release'
import { inspectorFamilyById } from '../catalog/inspector-families'

export const episodePublications = (release: InspectorRelease) => release.pmiPublications
export const releaseFamilyIds = (release: InspectorRelease): readonly string[] => release.familyIds ?? [release.familyId]

// A presentation package must still honour saved CPI-only or HICP-only filters.
export function selectedPackageSeries(release: InspectorRelease, selected: readonly string[]): InspectorRelease | null {
  if (!release.familyIds) return release
  const active = release.familyIds.filter(id => selected.includes(id))
  if (!active.length) return null
  if (active.length === release.familyIds.length) return release
  const ids = new Set(active.flatMap(id => inspectorFamilyById.get(id)?.events ?? []))
  return { ...release, familyIds: active, events: release.events.filter(event => ids.has(event.event_id)) }
}
