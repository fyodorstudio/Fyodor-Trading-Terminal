import type { EconomicCalendarEvent } from '../calendar-event'
import { revisedFamilyComparison, type ReadingRule } from './reading-grading'

export const ppiGradingVersion = 'usd-ppi-change-vs-previous-v1'
const rate = 'Rate changes are measured in percentage points.'
export const ppiReadingRules: Record<string, ReadingRule> = {
  '840030001': { name: 'PPI m/m', definition: `Headline monthly producer-price inflation. ${rate}` },
  '840030002': { name: 'Core PPI m/m', definition: `Monthly producer-price inflation excluding food and energy. ${rate}` },
  '840030003': { name: 'PPI y/y', definition: `Headline annual producer-price inflation. ${rate}` },
  '840030004': { name: 'Core PPI y/y', definition: `Annual producer-price inflation excluding food and energy. ${rate}` },
}
export const ppiReadingFamily = { familyId: 'ppi', country: 'US', currency: 'USD', readingRules: ppiReadingRules } as const

export function ppiRevisedComparison(event: EconomicCalendarEvent, familyId: string) {
  return revisedFamilyComparison(event, familyId, ppiReadingFamily)
}
