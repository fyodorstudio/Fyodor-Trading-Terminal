import type { EconomicCalendarEvent } from '../calendar-event'
import { inspectorDelta } from '../inspector-data'
import { fomcDecisionId } from '../episodes/fomc-episodes'

export function gradeFedRateDecision(event: EconomicCalendarEvent, familyId: string) {
  if (familyId !== 'fomc' || event.event_id !== fomcDecisionId || event.country_code !== 'US' || event.currency !== 'USD') return null
  const delta = inspectorDelta(event)
  const grade = delta === null ? 'missing' : delta > 0 ? 'higher' : delta < 0 ? 'lower' : 'unchanged'
  return { grade, explanation: 'Fed rate Actual minus supplied Previous: positive = green, negative = red, zero or unavailable = gray. Displayed in basis points; Forecast and revised Previous are not used.' } as const
}
