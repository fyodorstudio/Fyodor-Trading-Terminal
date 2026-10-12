import type { InspectorRelease } from '../../economic-calendar/releases/release'
import type { StoredCalendarEvent } from '../../economic-calendar/storage/useStoredCalendar'
import { inspectorFamilies } from '../../inspector/catalog/inspector-families'
import { policyEpisodeRule } from '../../inspector/episodes/policy-episodes'
import { isInspectorCommentary } from '../../inspector/releases/group-releases'

export type Highlight = {
  id: string; source_id: string; label: string; family_id: string; currency: string
  value_ids: string[]; event_ids: string[]; pinned_utc: string
  events: StoredCalendarEvent[]; release_at: number | null; server_time: number | null; missing_value_ids: string[]
}
export function highlightRequest(release: InspectorRelease, sourceId: string) {
  const families = new Set([release.familyId, ...(release.ismPublications ?? release.pmiPublications ?? []).map(item => item.familyId)])
  return { source_id: sourceId, label: release.label, family_id: release.familyId, currency: release.currency,
    value_ids: [...new Set(release.events.map(event => event.value_id))],
    event_ids: [...new Set([...release.events.map(event => event.event_id),
      ...inspectorFamilies.filter(family => families.has(family.id)).flatMap(family => family.events)])],
    join_window_seconds: policyEpisodeRule(release.familyId) ? 3600 : 0 }
}
export function highlightForRelease(items: Highlight[], release: InspectorRelease) {
  const ids = new Set(release.events.map(event => event.value_id))
  return items.find(item => item.value_ids.some(id => ids.has(id)) || item.events.some(event => ids.has(event.value_id)))
}
export function highlightState(item: Highlight, now: number) {
  if (!item.events.length || item.missing_value_ids.length) return 'Readings unavailable'
  const numeric = item.events.filter(event => !isInspectorCommentary(event))
  const arrived = numeric.filter(event => event.actual !== null && Number.isFinite(event.actual)).length
  if (numeric.length && arrived === numeric.length) return 'Released'
  if (arrived) return 'Partial release data'
  if (item.release_at === null) return 'Time unconfirmed'
  if (item.release_at > now) return 'Upcoming'
  return numeric.length ? 'Awaiting release data' : 'Event elapsed'
}
