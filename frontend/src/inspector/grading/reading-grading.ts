import type { EconomicCalendarEvent } from '../calendar-event'
import { inspectorDelta, type InspectorRelease } from '../inspector-data'

export type ReadingGrade = 'higher' | 'lower' | 'unchanged' | 'missing' | 'unrated'
export type ReadingRule = { name: string; definition: string }
export type ReadingFamily = { familyId: string; country: string; currency: 'USD' | 'EUR'; readingRules: Readonly<Record<string, ReadingRule>> }
export const gradeLabels: Record<ReadingGrade, string> = { higher: 'Higher', lower: 'Lower', unchanged: 'Unchanged', missing: 'Missing', unrated: 'Unrated' }
export function matchesReadingFamily(release: InspectorRelease | null, family: ReadingFamily): release is InspectorRelease {
  return !!release && release.familyId === family.familyId && release.country === family.country && release.currency === family.currency
}
export function gradeFamilyReading(event: EconomicCalendarEvent, familyId: string, family: ReadingFamily) {
  if (familyId !== family.familyId || event.currency !== family.currency || event.country_code !== family.country) return null
  const rule = family.readingRules[event.event_id]
  if (!rule) return { grade: 'unrated' as const, explanation: 'No grading rule is defined for this reading.' }
  const delta = inspectorDelta(event)
  const grade: ReadingGrade = delta === null ? 'missing' : delta === 0 ? 'unchanged' :
    delta > 0 ? 'higher' : 'lower'
  return { grade, explanation: `${rule.definition} Compared with supplied Previous: positive A−P = Higher; negative A−P = Lower; zero = Unchanged; unavailable delta = Missing. Labels describe the value change, independently of the signed USD score.` }
}
export function tallyFamilyReadings(release: InspectorRelease | null, family: ReadingFamily, version: string) {
  if (!matchesReadingFamily(release, family)) return null
  const counts: Record<ReadingGrade, number> = { higher: 0, lower: 0, unchanged: 0, missing: 0, unrated: 0 }
  for (const event of release.events) counts[gradeFamilyReading(event, release.familyId, family)?.grade ?? 'unrated']++
  return { counts, total: release.events.length, version }
}
