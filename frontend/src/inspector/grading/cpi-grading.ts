import type { EconomicCalendarEvent } from '../calendar-event'
import type { InspectorRelease } from '../inspector-data'
import { gradeFamilyReading, tallyFamilyReadings, type ReadingRule } from './reading-grading'

export const cpiGradingVersion = 'usd-cpi-vs-previous-v1'
const rate = 'Increase in the inflation rate versus Previous is classified as Good for USD pressure under the chosen higher-inflation convention.'
const index = 'Increase in the price index versus Previous is classified as Good for USD pressure; the delta is index points, not a change in the inflation rate.'
export const cpiReadingRules: Record<string, ReadingRule> = {
  '840030005': { name: 'CPI m/m', goodWhen: 'higher', definition: `Headline monthly inflation. ${rate}` },
  '840030006': { name: 'Core CPI m/m', goodWhen: 'higher', definition: `Monthly inflation excluding food and energy. ${rate}` },
  '840030007': { name: 'CPI y/y', goodWhen: 'higher', definition: `Headline annual inflation. ${rate}` },
  '840030008': { name: 'Core CPI y/y', goodWhen: 'higher', definition: `Annual inflation excluding food and energy. ${rate}` },
  '840030009': { name: 'CPI n.s.a.', goodWhen: 'higher', definition: `Unadjusted headline price index. ${index}` },
  '840030010': { name: 'Core CPI', goodWhen: 'higher', definition: `Adjusted core price index. ${index}` },
  '840030033': { name: 'CPI n.s.a. m/m', goodWhen: 'higher', definition: `Unadjusted headline monthly inflation. ${rate}` },
  '840030034': { name: 'Core CPI n.s.a. m/m', goodWhen: 'higher', definition: `Unadjusted core monthly inflation. ${rate}` },
  '840030035': { name: 'CPI', goodWhen: 'higher', definition: `Adjusted headline price index. ${index}` },
  '840030036': { name: 'Core CPI n.s.a.', goodWhen: 'higher', definition: `Unadjusted core price index. ${index}` },
}
export const cpiReadingFamily = { familyId: 'us-cpi', country: 'US', currency: 'USD', readingRules: cpiReadingRules } as const
export function gradeCpiReading(event: EconomicCalendarEvent, familyId: string) { return gradeFamilyReading(event, familyId, cpiReadingFamily) }
export function tallyCpiRelease(release: InspectorRelease | null) { return tallyFamilyReadings(release, cpiReadingFamily, cpiGradingVersion) }
