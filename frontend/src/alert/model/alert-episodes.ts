import { groupInspectorReleases, isInspectorCommentary } from '../../inspector/releases/group-releases'
import { releaseFamilyIds, selectedPackageSeries } from '../../inspector/episodes/display-episodes'
import { inspectorFamilies } from '../../inspector/catalog/inspector-families'
import { type InspectorRelease } from '../../economic-calendar/releases/release'
import type { StoredCalendarEvent } from '../../economic-calendar/storage/useStoredCalendar'

export const alertLookaheadDays = 7
const day = 86400000
export type AlertEpisode = { release: InspectorRelease; state: 'upcoming' | 'awaiting' | 'partial' | 'unconfirmed' }
export function alertSeriesIds(preferences: { families: readonly string[] }) {
  return [...new Set(inspectorFamilies.filter((family) => preferences.families.includes(family.id)).flatMap((family) => family.events))]
}
export function alertCalendarScope(preferences: { families: readonly string[] }) {
  const families = inspectorFamilies.filter(f => preferences.families.includes(f.id))
  const eventIds = alertSeriesIds(preferences)
  return eventIds.length > 512 || families.some(f => f.catchAll) ?
    { currencies: [...new Set(families.map(f => f.currency))] } : { eventIds }
}
export function alertEpisodes(events: StoredCalendarEvent[], preferences: { families: readonly string[] }, now: number, lookaheadDays = alertLookaheadDays): AlertEpisode[] {
  return alertEpisodesFromReleases(groupInspectorReleases(events.filter((event) => event.availability === 'observed'), true, 'publication'), preferences, now, lookaheadDays)
}
export function alertEpisodesFromReleases(releases: InspectorRelease[], preferences: { families: readonly string[] }, now: number, lookaheadDays = alertLookaheadDays,
  dateNow = now): AlertEpisode[] {
  return releases.flatMap((source): AlertEpisode[] => {
    const release = selectedPackageSeries(source, preferences.families)
    if (!release) return []
    if (!releaseFamilyIds(release).some(id => preferences.families.includes(id))) return []
    const uncertain = release.timingUncertain || release.releaseAt === null || !Number.isFinite(release.releaseAt)
    const at = uncertain ? release.serverTime * 1000 : release.releaseAt
    if (at === null || !Number.isFinite(at) || at <= 0) return []
    if (uncertain) {
      // Date-only schedules can occur later today; yesterday is never upcoming.
      if (Math.floor(at / day) < Math.floor(dateNow / day) || Math.floor(at / day) > Math.floor((dateNow + lookaheadDays * day) / day)) return []
    } else if (at < now || at > now + lookaheadDays * day) return []
    const numeric = release.events.filter((event) => !isInspectorCommentary(event))
    const arrived = numeric.filter((event) => event.actual !== null && Number.isFinite(event.actual)).length
    if (release.timingUncertain || release.releaseAt === null || !Number.isFinite(release.releaseAt)) {
      if (numeric.length && arrived === numeric.length) return []
      // Retain dated schedules without inventing an exact UTC countdown.
      return [{ release, state: 'unconfirmed' }]
    }
    if (release.releaseAt > now) return [{ release, state: 'upcoming' }]
    // Speeches have no numerical publication to await. Completed numeric
    // episodes leave the queue; their readings remain in persistent storage.
    if (!numeric.length || arrived === numeric.length) return []
    return [{ release, state: arrived ? 'partial' : 'awaiting' }]
  }).sort((a, b) => (a.release.releaseAt ?? a.release.serverTime * 1000) -
    (b.release.releaseAt ?? b.release.serverTime * 1000) || a.release.id.localeCompare(b.release.id))
}
export function alertCountdown(at: number, now: number, precise = false) {
  if (precise) {
    const seconds = Math.max(0, Math.ceil((at - now) / 1000))
    const days = Math.floor(seconds / 86400), hours = Math.floor(seconds % 86400 / 3600), minutes = Math.floor(seconds % 3600 / 60)
    return `${days ? `${days}d · ` : ''}${hours || days ? `${hours}h · ` : ''}${minutes || hours || days ? `${minutes}m · ` : ''}${seconds % 60}s remaining`
  }
  const minutes = Math.max(0, Math.ceil((at - now) / 60_000))
  const days = Math.floor(minutes / 1440), hours = Math.floor(minutes % 1440 / 60)
  const remaining = minutes % 60
  return `${days} ${days === 1 ? 'day' : 'days'} · ${hours} ${hours === 1 ? 'hour' : 'hours'} · ${remaining} ${remaining === 1 ? 'minute' : 'minutes'} remaining`
}
