import type { EconomicCalendarEvent } from '../calendar-event'
import { inspectorDelta, inspectorRevisedDelta, type InspectorRelease } from '../inspector-data'

export type ReadingGrade = 'higher' | 'lower' | 'unchanged' | 'missing' | 'unrated'
export type ReadingRule = { name: string; definition: string }
export type ReadingFamily = { familyId: string; country: string; currency: 'USD' | 'EUR'; readingRules: Readonly<Record<string, ReadingRule>> }
export const gradeLabels: Record<ReadingGrade, string> = { higher: 'Higher', lower: 'Lower', unchanged: 'Unchanged', missing: 'Missing', unrated: 'Unrated' }
export function matchesReadingFamily(release: InspectorRelease | null, family: ReadingFamily): release is InspectorRelease {
  return !!release && release.familyId === family.familyId && release.country === family.country && release.currency === family.currency
}
export function gradeFamilyReading(event: EconomicCalendarEvent, familyId: string, family: ReadingFamily, comparator: 'previous' | 'revised_previous' = 'previous') {
  if (familyId !== family.familyId || event.currency !== family.currency || event.country_code !== family.country) return null
  const rule = family.readingRules[event.event_id]
  if (!rule) return { grade: 'unrated' as const, explanation: 'No grading rule is defined for this reading.' }
  const delta = comparator === 'revised_previous' ? inspectorRevisedDelta(event) : inspectorDelta(event)
  const grade: ReadingGrade = delta === null ? 'missing' : delta === 0 ? 'unchanged' :
    delta > 0 ? 'higher' : 'lower'
  const comparison = comparator === 'revised_previous' ? 'supplied Revised Previous' : 'supplied Previous'
  const label = comparator === 'revised_previous' ? 'A−RevP' : 'A−P'
  return { grade, explanation: `${rule.definition} Compared with ${comparison}: positive ${label} = Higher; negative ${label} = Lower; zero = Unchanged; unavailable delta = Missing. Labels describe the value change, independently of the signed USD score.` }
}
export function revisedFamilyComparison(event: EconomicCalendarEvent, familyId: string, family: ReadingFamily | null) {
  if (!family || familyId !== family.familyId || event.country_code !== family.country || event.currency !== family.currency ||
    !Object.hasOwn(family.readingRules, event.event_id) || event.revised_previous === null || !Number.isFinite(event.revised_previous)) return null
  return { label: 'A−RevP', delta: inspectorRevisedDelta(event), ...gradeFamilyReading(event, familyId, family, 'revised_previous')! }
}
export function tallyFamilyReadings(release: InspectorRelease | null, family: ReadingFamily, version: string) {
  if (!matchesReadingFamily(release, family)) return null
  const counts: Record<ReadingGrade, number> = { higher: 0, lower: 0, unchanged: 0, missing: 0, unrated: 0 }
  for (const event of release.events) counts[gradeFamilyReading(event, release.familyId, family)?.grade ?? 'unrated']++
  return { counts, total: release.events.length, version }
}
