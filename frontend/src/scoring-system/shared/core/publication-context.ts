import type { EconomicCalendarEvent } from '../../../inspector/calendar-event'
import { groupInspectorReleases, type InspectorRelease } from '../../../inspector/inspector-data'
import { observedReading, referenceMonth } from './historical-release-signals'

// A context is a timestamped view over publications, not a merged calendar event.
// Selecting a later update must never alter an earlier view of the same month.
export function contextReference(release: InspectorRelease) {
  const months = new Set(release.events.map(referenceMonth))
  return months.size === 1 && !months.has(null) ? [...months][0]! : null
}
export function publicationsAsOf(events: readonly EconomicCalendarEvent[], at: number,
  earliestKnownTime: (event: EconomicCalendarEvent) => number | null = () => null) {
  const seen = new Set<string>()
  return events.filter((event) => {
    const earliest = earliestKnownTime(event)
    if (!observedReading(event) || event.release_at > at || (earliest !== null && earliest > at) || seen.has(event.value_id)) return false
    seen.add(event.value_id); return true
  })
}
export function latestContextPublication(publications: readonly InspectorRelease[], familyId: string, month: number) {
  // Mixed-reference latest publications stay inspectable but cannot replace a
  // valid assessment silently with one of their older publications.
  const matching = publications.filter((release) => release.familyId === familyId && release.events.some((event) => referenceMonth(event) === month))
  const latest = Math.max(...matching.map((release) => release.releaseAt ?? -Infinity))
  const candidates = matching.filter((release) => release.releaseAt === latest)
  return { release: candidates.length === 1 ? candidates[0] : null, ambiguous: candidates.length > 1 }
}
export const contextPublications = (events: readonly EconomicCalendarEvent[]) => groupInspectorReleases([...events])
