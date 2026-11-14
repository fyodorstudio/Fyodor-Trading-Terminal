import type { StoredCalendarEvent } from '../../economic-calendar/storage/useStoredCalendar'
import type { InspectorRelease } from '../../economic-calendar/releases/release'
import { groupInspectorReleases } from '../../inspector/releases/group-releases'
import { selectedPackageSeries } from '../../inspector/episodes/display-episodes'
import type { AlertPreferences } from './alert-preferences'
import { groupAlertPublications } from './publication-packages'

export const dayMs = 86400000
export function jakartaDate(at: number) { return new Date(at + 7 * 3600000).toISOString().slice(0, 10) }
export function moveDate(date: string, days: number) { return new Date(Date.parse(`${date}T00:00:00Z`) + days * dayMs).toISOString().slice(0, 10) }
export type AlertDayGroup = { key: string; title: string; currency: string; at: number | null; release: InspectorRelease; valueIds: string[] }
export function dayGroups(events: StoredCalendarEvent[], preferences: Pick<AlertPreferences, 'families' | 'currency'>): AlertDayGroup[] {
  return groupAlertPublications(groupInspectorReleases(events, false, 'publication')).flatMap(original => {
    const release = selectedPackageSeries(original, preferences.families)
    if (!release || !preferences.families.includes(release.familyId) && !release.familyIds?.some(id => preferences.families.includes(id))
      || preferences.currency !== 'all' && release.currency !== preferences.currency) return []
    return [{ key: `calendar:${original.id}`, title: release.label, currency: release.currency,
      at: release.timingUncertain ? null : release.releaseAt, release, valueIds: original.events.map(event => event.value_id) }]
  }).sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity) || a.title.localeCompare(b.title) || a.key.localeCompare(b.key))
}
