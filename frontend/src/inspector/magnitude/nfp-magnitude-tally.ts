import { gradeNfpReading } from '../grading/nfp-grading'
import type { InspectorRelease } from '../inspector-data'
import { isNfpRelease } from './nfp-magnitude-history'
import type { NfpMagnitudeHistory } from './useNfpMagnitudeHistory'

export const nfpMagnitudeSizes = ['Small', 'Medium', 'Large', 'Extreme'] as const
export type NfpMagnitudeSize = typeof nfpMagnitudeSizes[number]
const emptyCounts = () => ({ Small: 0, Medium: 0, Large: 0, Extreme: 0, Unclassified: 0 })

export function tallyNfpMagnitudes(release: InspectorRelease | null, rows: NfpMagnitudeHistory['rows']) {
  if (!isNfpRelease(release)) return null
  const counts = { good: emptyCounts(), bad: emptyCounts() }
  for (const event of release.events) {
    const grade = gradeNfpReading(event, release.familyId)?.grade
    if (grade !== 'good' && grade !== 'bad') continue
    const size = rows[event.value_id]?.distribution?.currentSize
    const bucket = nfpMagnitudeSizes.find((candidate) => candidate === size) ?? 'Unclassified'
    counts[grade][bucket]++
  }
  return counts
}
