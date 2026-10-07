import type { EconomicCalendarEvent } from '../calendar-event'

const clocks = new WeakMap<readonly EconomicCalendarEvent[], number[]>()
// Inventories are immutable snapshots. Index publication times once, then admit
// them with a binary lookup rather than scan years of rows on every hover/tick.
export function calendarAdmissionTime(events: readonly EconomicCalendarEvent[], now: number) {
  if (Number.isNaN(now)) return 0
  let times = clocks.get(events)
  if (!times) {
    times = [...new Set(events.flatMap(event => event.release_at !== null && event.release_at > 0 ? [event.release_at] : []))].sort((a, b) => a - b)
    clocks.set(events, times)
  }
  let lo = 0, hi = times.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (times[mid] <= now) lo = mid + 1; else hi = mid }
  return times[lo - 1] ?? 0
}
