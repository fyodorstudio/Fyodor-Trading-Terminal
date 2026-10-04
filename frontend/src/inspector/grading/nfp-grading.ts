import type { EconomicCalendarEvent } from '../../economic-calendar/mt5-calendar/calendar-contract'
import { inspectorDelta, type InspectorRelease } from '../inspector-data'

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
export type ReadingGrade = 'good' | 'bad' | 'unchanged' | 'missing' | 'unrated'
export const gradeLabels: Record<ReadingGrade, string> = { good: 'Good', bad: 'Bad', unchanged: 'Unchanged', missing: 'Missing', unrated: 'Unrated' }

export function gradeNfpReading(event: EconomicCalendarEvent, familyId: string): { grade: ReadingGrade; explanation: string } | null {
  if (familyId !== 'jobs' || event.currency !== 'USD' || event.country_code !== 'US') return null
  const rule = nfpReadingRules[event.event_id]
  if (!rule) return { grade: 'unrated', explanation: 'No grading rule is defined for this reading.' }
  const delta = inspectorDelta(event)
  const grade: ReadingGrade = delta === null ? 'missing' : delta === 0 ? 'unchanged' :
    (delta > 0) === (rule.goodWhen === 'higher') ? 'good' : 'bad'
  return { grade, explanation: `${rule.definition} Compared with supplied Previous: ${rule.goodWhen} = Good; ${rule.goodWhen === 'higher' ? 'lower' : 'higher'} = Bad. Zero = Unchanged; unavailable delta = Missing. A rule-based reading comparison, not a USD price prediction.` }
}

export function tallyNfpRelease(release: InspectorRelease | null) {
  if (!release || release.familyId !== 'jobs' || release.currency !== 'USD' || release.country !== 'US') return null
  const counts: Record<ReadingGrade, number> = { good: 0, bad: 0, unchanged: 0, missing: 0, unrated: 0 }
  for (const event of release.events) counts[gradeNfpReading(event, release.familyId)?.grade ?? 'unrated']++
  return { counts, total: release.events.length, version: nfpGradingVersion }
}

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
