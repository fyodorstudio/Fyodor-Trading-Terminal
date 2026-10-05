import type { EconomicCalendarEvent } from '../calendar-event'
import type { InspectorRelease } from '../inspector-data'
import { matchesReadingFamily } from '../grading/reading-grading'
import type { StoredCalendarEvent } from '../useStoredCalendar'
import type { NfpMagnitudeSettings } from './nfp-magnitude-settings'
import { nfpMagnitudeFamily } from './magnitude-families'
import { familyHistoryReleases, familyMagnitudeHistory, familyMagnitudeSamples } from './family-magnitude-history'

export const nfpHistoryStart = nfpMagnitudeFamily.historyStart
export const nfpHistoryScope = nfpMagnitudeFamily.historyScope
export function isNfpRelease(release: InspectorRelease | null): release is InspectorRelease {
  return matchesReadingFamily(release, nfpMagnitudeFamily)
}
export function nfpMagnitudeHistory(events: StoredCalendarEvent[], selected: InspectorRelease | null, settings: NfpMagnitudeSettings = {}, now = Date.now()) {
  return familyMagnitudeHistory(events, selected, nfpMagnitudeFamily, settings, now)
}
export function nfpHistoryReleases(events: StoredCalendarEvent[], before: number) {
  return familyHistoryReleases(events, before, nfpMagnitudeFamily)
}
export function nfpMagnitudeSamples(releases: readonly InspectorRelease[], current: EconomicCalendarEvent) {
  return familyMagnitudeSamples(releases, current)
}
