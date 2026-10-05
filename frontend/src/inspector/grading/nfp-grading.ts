import type { EconomicCalendarEvent } from '../calendar-event'
import type { InspectorRelease } from '../inspector-data'
import { gradeFamilyReading, tallyFamilyReadings } from './reading-grading'
export { gradeLabels, type ReadingGrade } from './reading-grading'

export const nfpGradingVersion = 'nfp-change-vs-previous-v2'
export const nfpReadingRules: Record<string, { name: string; definition: string }> = {
  '840030016': { name: 'Nonfarm Payrolls', definition: 'Net change in nonfarm payroll jobs.' },
  '840030015': { name: 'Unemployment Rate', definition: 'Unemployed people as a share of the labor force.' },
  '840030017': { name: 'Participation Rate', definition: 'Share of people aged 16+ working or seeking work.' },
  '840030018': { name: 'Average Hourly Earnings m/m', definition: 'Monthly growth in average hourly pay.' },
  '840030019': { name: 'Average Hourly Earnings y/y', definition: 'Annual growth in average hourly pay.' },
  '840030020': { name: 'Average Weekly Hours', definition: 'Average weekly hours worked by private-sector employees.' },
  '840030023': { name: 'Private Nonfarm Payrolls', definition: 'Net job change at private employers; part of total Nonfarm Payrolls.' },
  '840030022': { name: 'Government Payrolls', definition: 'Net job change at government employers; part of total Nonfarm Payrolls.' },
  '840030032': { name: 'Manufacturing Payrolls', definition: 'Net job change in manufacturing; part of private payrolls.' },
  '840030024': { name: 'U6 Unemployment Rate', definition: 'Broader labor underutilization, including involuntary part-time work and marginal attachment.' },
}
export const nfpReadingFamily = { familyId: 'jobs', country: 'US', currency: 'USD', readingRules: nfpReadingRules } as const

export function gradeNfpReading(event: EconomicCalendarEvent, familyId: string) { return gradeFamilyReading(event, familyId, nfpReadingFamily) }

export function tallyNfpRelease(release: InspectorRelease | null) { return tallyFamilyReadings(release, nfpReadingFamily, nfpGradingVersion) }
