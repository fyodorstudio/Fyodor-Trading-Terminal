import { gradeFamilyReading, matchesReadingFamily } from '../grading/reading-grading'
import type { InspectorRelease } from '../inspector-data'
import type { MagnitudeFamily } from './magnitude-families'
import type { FamilyMagnitudeHistory } from './useFamilyMagnitudeHistory'

export const magnitudeSizes = ['Small', 'Medium', 'Large', 'Extreme'] as const
const emptyCounts = () => ({ Small: 0, Medium: 0, Large: 0, Extreme: 0, Unclassified: 0 })
export function tallyFamilyMagnitudes(release: InspectorRelease | null, rows: FamilyMagnitudeHistory['rows'], family: MagnitudeFamily) {
  if (!matchesReadingFamily(release, family)) return null
  const counts = { higher: emptyCounts(), lower: emptyCounts() }
  for (const event of release.events) {
    const grade = gradeFamilyReading(event, release.familyId, family)?.grade
    if (grade !== 'higher' && grade !== 'lower') continue
    const size = rows[event.value_id]?.distribution?.currentSize
    const bucket = magnitudeSizes.find((candidate) => candidate === size) ?? 'Unclassified'
    counts[grade][bucket]++
  }
  return counts
}
