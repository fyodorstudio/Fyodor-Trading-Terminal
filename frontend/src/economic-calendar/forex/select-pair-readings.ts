import type { EconomicCalendarEvent } from '../contracts/calendar-event'
import { sameCalendarRows } from '../storage/calendar-snapshot-identity'

// Each Inspector owns this cache; unrelated currency updates keep prepared data stable.
export function createInspectorReadingSelector(currencies: readonly string[]) {
  let previous: EconomicCalendarEvent[] = []
  return (rows: EconomicCalendarEvent[]) => {
    const next = rows.filter(event => currencies.includes(event.currency))
    if (!sameCalendarRows(previous, next)) previous = next
    return previous
  }
}
