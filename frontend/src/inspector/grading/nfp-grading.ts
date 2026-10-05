import type { EconomicCalendarEvent } from '../calendar-event'
import type { InspectorRelease } from '../inspector-data'
import { gradeFamilyReading, tallyFamilyReadings } from './reading-grading'
export { gradeLabels, type ReadingGrade } from './reading-grading'

export const nfpGradingVersion = 'nfp-vs-previous-v1'
export const nfpMajorityVersion = 'nfp-eurusd-majority-v1'
export const nfpReadingRules: Record<string, { name: string; goodWhen: 'higher' | 'lower'; definition: string }> = {
  '840030016': { name: 'Nonfarm Payrolls', goodWhen: 'higher', definition: 'Net change in nonfarm payroll jobs.' },
  '840030015': { name: 'Unemployment Rate', goodWhen: 'lower', definition: 'Unemployed people as a share of the labor force.' },
  '840030017': { name: 'Participation Rate', goodWhen: 'higher', definition: 'Share of people aged 16+ working or seeking work. Higher = Good is a simplified convention.' },
  '840030018': { name: 'Average Hourly Earnings m/m', goodWhen: 'higher', definition: 'Monthly growth in average hourly pay.' },
  '840030019': { name: 'Average Hourly Earnings y/y', goodWhen: 'higher', definition: 'Annual growth in average hourly pay.' },
  '840030020': { name: 'Average Weekly Hours', goodWhen: 'higher', definition: 'Average weekly hours worked by private-sector employees.' },
  '840030023': { name: 'Private Nonfarm Payrolls', goodWhen: 'higher', definition: 'Net job change at private employers; part of total Nonfarm Payrolls.' },
  '840030022': { name: 'Government Payrolls', goodWhen: 'higher', definition: 'Net job change at government employers; part of total Nonfarm Payrolls.' },
  '840030032': { name: 'Manufacturing Payrolls', goodWhen: 'higher', definition: 'Net job change in manufacturing; part of private payrolls.' },
  '840030024': { name: 'U6 Unemployment Rate', goodWhen: 'lower', definition: 'Broader labor underutilization, including involuntary part-time work and marginal attachment.' },
}
export const nfpReadingFamily = { familyId: 'jobs', country: 'US', currency: 'USD', readingRules: nfpReadingRules } as const

export function gradeNfpReading(event: EconomicCalendarEvent, familyId: string) { return gradeFamilyReading(event, familyId, nfpReadingFamily) }

export function tallyNfpRelease(release: InspectorRelease | null) { return tallyFamilyReadings(release, nfpReadingFamily, nfpGradingVersion) }

export function assessNfpMajority(release: InspectorRelease | null) {
  const tally = tallyNfpRelease(release)
  if (!tally || !release) return null
  const requiredIds = Object.keys(nfpReadingRules)
  const complete = release.events.length === requiredIds.length && requiredIds.every((id) =>
    release.events.filter((event) => event.event_id === id).length === 1) &&
    tally.counts.missing === 0 && tally.counts.unrated === 0
  const direction = !complete ? 'incomplete' : tally.counts.good > tally.counts.bad ? 'short' :
    tally.counts.bad > tally.counts.good ? 'long' : 'neutral'
  const labels = { short: 'EURUSD Short', long: 'EURUSD Long', neutral: 'EURUSD Neutral', incomplete: 'Incomplete' }
  return { direction, label: labels[direction], version: nfpMajorityVersion,
    explanation: complete
      ? `${tally.counts.good} Good versus ${tally.counts.bad} Bad. More Good = EURUSD Short; more Bad = EURUSD Long; equal = Neutral. Unchanged does not vote. Experimental NFP majority rule versus supplied Previous.`
      : 'Requires exactly one usable Actual/Previous reading for each of the ten defined NFP series. Absent, missing, unrated or repeated series make the direction Incomplete.' }
}
