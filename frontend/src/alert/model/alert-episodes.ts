import { groupInspectorReleases, isInspectorCommentary } from '../../inspector/releases/group-releases'
import { inspectorFamilies } from '../../inspector/catalog/inspector-families'
import { type InspectorRelease } from '../../economic-calendar/releases/release'
import type { StoredCalendarEvent } from '../../economic-calendar/storage/useStoredCalendar'

export const alertLookaheadDays = 7
export const alertRecentDays = 30
const day = 86400000
export type AlertEpisode = { release: InspectorRelease; state: 'upcoming' | 'awaiting' | 'partial' | 'unconfirmed' }
export function alertSeriesIds(preferences: { families: readonly string[] }) {
  return [...new Set(inspectorFamilies.filter((family) => preferences.families.includes(family.id)).flatMap((family) => family.events))]
}
export function alertEpisodes(events: StoredCalendarEvent[], preferences: { families: readonly string[] }, now: number, lookaheadDays = alertLookaheadDays): AlertEpisode[] {
  return alertEpisodesFromReleases(groupInspectorReleases(events.filter((event) => event.availability === 'observed')), preferences, now, lookaheadDays)
}
export function alertEpisodesFromReleases(releases: InspectorRelease[], preferences: { families: readonly string[] }, now: number, lookaheadDays = alertLookaheadDays): AlertEpisode[] {
  return releases.flatMap((release): AlertEpisode[] => {
    if (!preferences.families.includes(release.familyId)) return []
    const numeric = release.events.filter((event) => !isInspectorCommentary(event))
    const arrived = numeric.filter((event) => event.actual !== null && Number.isFinite(event.actual)).length
    if (release.timingUncertain || release.releaseAt === null || !Number.isFinite(release.releaseAt)) {
      if (numeric.length && arrived === numeric.length) return []
      // Retain dated schedules without inventing an exact UTC countdown.
      return [{ release, state: 'unconfirmed' }]
    }
    if (release.releaseAt > now + lookaheadDays * day || release.releaseAt < now - alertRecentDays * day) return []
    if (release.releaseAt > now) return [{ release, state: 'upcoming' }]
    // Speeches have no numerical publication to await. Completed numeric
    // episodes leave the queue; their readings remain in persistent storage.
    if (!numeric.length || arrived === numeric.length) return []
    return [{ release, state: arrived ? 'partial' : 'awaiting' }]
  }).sort((a, b) => (a.release.releaseAt ?? a.release.serverTime * 1000) -
    (b.release.releaseAt ?? b.release.serverTime * 1000) || a.release.id.localeCompare(b.release.id))
}
export function alertCountdown(at: number, now: number) {
  const minutes = Math.max(0, Math.ceil((at - now) / 60_000))
  const days = Math.floor(minutes / 1440), hours = Math.floor(minutes % 1440 / 60)
  const remaining = minutes % 60
  return `${days} ${days === 1 ? 'day' : 'days'} · ${hours} ${hours === 1 ? 'hour' : 'hours'} · ${remaining} ${remaining === 1 ? 'minute' : 'minutes'} remaining`
}
