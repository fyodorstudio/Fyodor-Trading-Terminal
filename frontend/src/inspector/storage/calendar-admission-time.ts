import type { EconomicCalendarEvent } from '../calendar-event'

// The model changes when a real publication crosses the clock, not on each tick.
export function calendarAdmissionTime(events: readonly EconomicCalendarEvent[], now: number) {
  return events.reduce((last, event) => event.release_at !== null && event.release_at <= now ? Math.max(last, event.release_at) : last, 0)
}
