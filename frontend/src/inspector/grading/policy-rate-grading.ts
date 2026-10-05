import type { EconomicCalendarEvent } from '../calendar-event'
import { inspectorDelta, inspectorSurprise } from '../inspector-data'
import { isPolicyRateDecision } from '../episodes/policy-episodes'

export function gradePolicyRateDecision(event: EconomicCalendarEvent, familyId: string, comparator: 'previous' | 'forecast' = 'previous') {
  if (!isPolicyRateDecision(event, familyId)) return null
  const delta = comparator === 'forecast' ? inspectorSurprise(event) : inspectorDelta(event)
  const grade = delta === null ? 'missing' : delta > 0 ? 'higher' : delta < 0 ? 'lower' : 'unchanged'
  const comparison = comparator === 'forecast' ? 'Forecast' : 'Previous'
  const usage = comparator === 'forecast' ? 'Informational only; does not affect A−P, magnitude or scoring.' : 'Forecast and revised Previous are not used.'
  return { grade, explanation: `Rate Actual minus supplied ${comparison}: positive = green, negative = red, zero or unavailable = gray. Displayed in basis points. ${usage}` } as const
}
