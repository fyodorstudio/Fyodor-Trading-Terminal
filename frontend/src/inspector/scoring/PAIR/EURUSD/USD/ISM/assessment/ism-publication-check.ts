import type { EconomicCalendarEvent } from '../../../../../../calendar-event'
import type { InspectorRelease } from '../../../../../../inspector-data'
import { ismServicesSeriesIds } from '../../ISM-SERVICES/assessment/ism-services-score'

export const ismCalendarSource = 'https://www.ismworld.org/supply-management-news-and-reports/reports/rob-report-calendar/'
// Verified official 2026 release calendar, checked 6 October 2026. Do not
// extrapolate holiday dates into other years or silently relocate broker rows.
const calendar2026 = {
  'ism-manufacturing': [5, 2, 2, 1, 1, 1, 1, 3, 1, 1, 2, 1],
  'ism-services': [7, 4, 4, 6, 5, 3, 6, 5, 3, 5, 4, 3],
} as const
export function expectedIsmPublication(at: number, family: string) {
  const date = new Date(at)
  if (date.getUTCFullYear() !== 2026 || !(family in calendar2026)) return null
  const month = date.getUTCMonth(), day = calendar2026[family as keyof typeof calendar2026][month]
  // 10:00 US Eastern; US DST in 2026 is March 8 through November 1.
  const midnight = Date.UTC(2026, month, day)
  const dst = midnight >= Date.UTC(2026, 2, 8) && midnight < Date.UTC(2026, 10, 1)
  return Date.UTC(2026, month, day, dst ? 14 : 15)
}
export function ismEarliestKnownTime(event: EconomicCalendarEvent) {
  if (event.release_at === null) return null
  return expectedIsmPublication(event.release_at, ismServicesSeriesIds.includes(event.event_id as typeof ismServicesSeriesIds[number]) ? 'ism-services' : 'ism-manufacturing')
}
export function ismPublicationIssue(release: InspectorRelease) {
  if (release.timingUncertain || release.releaseAt === null) return 'A verified broker publication time is required.'
  const expected = expectedIsmPublication(release.releaseAt, release.familyId)
  const date = new Date(release.releaseAt).toISOString().slice(0, 10)
  if (expected !== null && date !== new Date(expected).toISOString().slice(0, 10))
    return `Broker publication date ${date} differs from the verified ISM calendar date ${new Date(expected).toISOString().slice(0, 10)}. This sector is excluded from v2; stored timestamps are unchanged.`
  // Both reports publish on business days. This checks UTC daytime dates only.
  const day = new Date(release.releaseAt).getUTCDay()
  return day === 0 || day === 6 ? 'Broker publication is on a weekend. This sector is excluded from v2 pending timing verification.' : ''
}
