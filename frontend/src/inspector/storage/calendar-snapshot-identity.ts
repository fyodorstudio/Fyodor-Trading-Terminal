import type { StoredCalendarEvent } from '../useStoredCalendar'

// Storage revisions include unrelated feeds. Keep identical calendar rows stable
// so health/price updates do not invalidate calibrated history and chart models.
export function sameCalendarRows(a: readonly StoredCalendarEvent[], b: readonly StoredCalendarEvent[]) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const keys = Object.keys(a[i]) as (keyof StoredCalendarEvent)[]
    if (keys.length !== Object.keys(b[i]).length || keys.some((key) => a[i][key] !== b[i][key])) return false
  }
  return true
}
