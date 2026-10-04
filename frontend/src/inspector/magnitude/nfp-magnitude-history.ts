import type { EconomicCalendarEvent } from '../calendar-event'
import { groupInspectorReleases, inspectorDelta, type InspectorRelease } from '../inspector-data'
import { nfpReadingRules } from '../grading/nfp-grading'
import type { StoredCalendarEvent } from '../useStoredCalendar'
import { magnitudeDistribution } from './magnitude-distribution'

export const nfpHistoryStart = Date.UTC(2015, 0, 1)
export const nfpHistoryScope = { currency: 'USD' as const, eventIds: Object.keys(nfpReadingRules) }
export function isNfpRelease(release: InspectorRelease | null): release is InspectorRelease {
  return !!release && release.familyId === 'jobs' && release.country === 'US' && release.currency === 'USD'
}
export function nfpMagnitudeHistory(events: StoredCalendarEvent[], selected: InspectorRelease | null) {
  if (!isNfpRelease(selected) || selected.releaseAt === null) return {}
  const earlier = groupInspectorReleases(events.filter((event) => event.availability === 'observed' &&
    event.time_mode === 0 && event.release_at !== null && event.release_at >= nfpHistoryStart && event.release_at < selected.releaseAt!))
    .filter(isNfpRelease)
  return Object.fromEntries(selected.events.map((current) => {
    const samples: { delta: number; at: number }[] = []
    let excluded = 0
    for (const release of earlier) {
      const rows = release.events.filter((event) => event.event_id === current.event_id)
      // A publication with repeated reference periods/revisions is ambiguous:
      // do not select one arbitrarily or count it multiple times.
      if (rows.length !== 1) { if (rows.length) excluded++; continue }
      const row = rows[0], delta = inspectorDelta(row)
      if (delta === null || !sameUnits(row, current)) { excluded++; continue }
      samples.push({ delta, at: release.releaseAt! })
    }
    return [current.value_id, { distribution: magnitudeDistribution(samples.map((sample) => sample.delta), inspectorDelta(current)),
      excluded, first: samples.length ? Math.min(...samples.map((sample) => sample.at)) : null,
      last: samples.length ? Math.max(...samples.map((sample) => sample.at)) : null }]
  }))
}
function sameUnits(a: EconomicCalendarEvent, b: EconomicCalendarEvent) {
  return a.unit === b.unit && a.multiplier === b.multiplier
}
