import type { EconomicCalendarEvent } from '../calendar-event'
import { groupInspectorReleases, inspectorDelta, type InspectorRelease } from '../inspector-data'
import { nfpReadingRules } from '../grading/nfp-grading'
import type { StoredCalendarEvent } from '../useStoredCalendar'
import { magnitudeDistribution } from './magnitude-distribution'
import type { NfpMagnitudeSettings } from './nfp-magnitude-settings'

export const nfpHistoryStart = Date.UTC(2015, 0, 1)
export const nfpHistoryScope = { currency: 'USD' as const, eventIds: Object.keys(nfpReadingRules) }
export function isNfpRelease(release: InspectorRelease | null): release is InspectorRelease {
  return !!release && release.familyId === 'jobs' && release.country === 'US' && release.currency === 'USD'
}
export function nfpMagnitudeHistory(events: StoredCalendarEvent[], selected: InspectorRelease | null, settings: NfpMagnitudeSettings = {}) {
  if (!isNfpRelease(selected) || selected.releaseAt === null) return {}
  const earlier = nfpHistoryReleases(events, selected.releaseAt)
  return Object.fromEntries(selected.events.map((current) => {
    const { samples, excluded } = nfpMagnitudeSamples(earlier, current)
    return [current.value_id, { distribution: magnitudeDistribution(samples.map((sample) => sample.delta), inspectorDelta(current), settings[current.event_id]),
      excluded, first: samples.length ? Math.min(...samples.map((sample) => sample.at)) : null,
      last: samples.length ? Math.max(...samples.map((sample) => sample.at)) : null }]
  }))
}
export function nfpHistoryReleases(events: StoredCalendarEvent[], before: number) {
  return groupInspectorReleases(events.filter((event) => event.availability === 'observed' &&
    event.time_mode === 0 && event.release_at !== null && event.release_at >= nfpHistoryStart && event.release_at < before))
    .filter(isNfpRelease)
}
export function nfpMagnitudeSamples(releases: readonly InspectorRelease[], current: EconomicCalendarEvent) {
  const samples: { delta: number; at: number; releaseId: string; event: EconomicCalendarEvent }[] = []
  let excluded = 0
  for (const release of releases) {
    const rows = release.events.filter((event) => event.event_id === current.event_id)
    // Ambiguous reference periods/revisions contribute neither arbitrary nor repeated samples.
    if (rows.length !== 1) { if (rows.length) excluded++; continue }
    const row = rows[0], delta = inspectorDelta(row)
    if (delta === null || !sameUnits(row, current)) { excluded++; continue }
    samples.push({ delta, at: release.releaseAt!, releaseId: release.id, event: row })
  }
  return { samples, excluded }
}
function sameUnits(a: EconomicCalendarEvent, b: EconomicCalendarEvent) {
  return a.unit === b.unit && a.multiplier === b.multiplier
}
