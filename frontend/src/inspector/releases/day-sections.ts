import type { InspectorDaySection, InspectorRelease } from '../../economic-calendar/releases/release'
import { inspectorCategories, inspectorFamilyById } from '../catalog/inspector-families'
import { isInspectorCommentary } from './group-releases'

export function groupDaySections(publications: InspectorRelease[]): InspectorDaySection[] {
  const sections = new Map<string, InspectorDaySection>()
  for (const publication of publications) {
    const family = inspectorFamilyById.get(publication.familyId)!
    const id = family.category
    let section = sections.get(id)
    if (!section) {
      section = { id, label: inspectorCategories.find(category => category.id === id)!.label, publications: [], releaseCount: 0 }
      sections.set(id, section)
    }
    section.publications.push(publication)
  }
  for (const section of sections.values()) {
    // Numerical variants at the same verified family clock are one publication.
    // Distinct speakers, unknown hours and later publications retain identities.
    section.releaseCount = new Set(section.publications.map(publication => publication.events.every(isInspectorCommentary) ||
      publication.timingUncertain || inspectorFamilyById.get(publication.familyId)?.catchAll ?
      publication.id : JSON.stringify([publication.country, publication.familyId, publication.releaseAt]))).size
  }
  return inspectorCategories.flatMap(category => sections.has(category.id) ? [sections.get(category.id)!] : [])
}
