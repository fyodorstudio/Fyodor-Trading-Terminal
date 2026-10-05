import type { EconomicCalendarEvent } from '../calendar-event'
import { inspectorDelta, type InspectorRelease } from '../inspector-data'

export type ReadingGrade = 'good' | 'bad' | 'unchanged' | 'missing' | 'unrated'
export type ReadingRule = { name: string; goodWhen: 'higher' | 'lower'; definition: string }
export type ReadingFamily = { familyId: string; country: string; currency: 'USD' | 'EUR'; readingRules: Readonly<Record<string, ReadingRule>> }
export const gradeLabels: Record<ReadingGrade, string> = { good: 'Good', bad: 'Bad', unchanged: 'Unchanged', missing: 'Missing', unrated: 'Unrated' }
export function matchesReadingFamily(release: InspectorRelease | null, family: ReadingFamily): release is InspectorRelease {
  return !!release && release.familyId === family.familyId && release.country === family.country && release.currency === family.currency
}
export function gradeFamilyReading(event: EconomicCalendarEvent, familyId: string, family: ReadingFamily) {
  if (familyId !== family.familyId || event.currency !== family.currency || event.country_code !== family.country) return null
  const rule = family.readingRules[event.event_id]
  if (!rule) return { grade: 'unrated' as const, explanation: 'No grading rule is defined for this reading.' }
  const delta = inspectorDelta(event)
  const grade: ReadingGrade = delta === null ? 'missing' : delta === 0 ? 'unchanged' :
    (delta > 0) === (rule.goodWhen === 'higher') ? 'good' : 'bad'
  return { grade, explanation: `${rule.definition} Compared with supplied Previous: ${rule.goodWhen} = Good; ${rule.goodWhen === 'higher' ? 'lower' : 'higher'} = Bad. Zero = Unchanged; unavailable delta = Missing. A chosen ${family.currency}-pressure convention, not a price prediction.` }
}
export function tallyFamilyReadings(release: InspectorRelease | null, family: ReadingFamily, version: string) {
  if (!matchesReadingFamily(release, family)) return null
  const counts: Record<ReadingGrade, number> = { good: 0, bad: 0, unchanged: 0, missing: 0, unrated: 0 }
  for (const event of release.events) counts[gradeFamilyReading(event, release.familyId, family)?.grade ?? 'unrated']++
  return { counts, total: release.events.length, version }
}
