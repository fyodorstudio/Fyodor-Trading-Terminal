import type { InspectorRelease } from '../../../../../../inspector-data'
import type { FamilyMagnitudeHistory } from '../../../../../../magnitude/useFamilyMagnitudeHistory'
import { cpiReadingFamily } from '../../../../../../grading/cpi-grading'
import { matchesReadingFamily } from '../../../../../../grading/reading-grading'
import { assessSignedMagnitudeReading, sumSignedMagnitudeScores } from '../../../../../shared/core/signed-magnitude-score'

export const cpiIndexScoreVersion = 'cpi-index-signed-magnitude-v1'
export const cpiIndexScoreSeries = [
  { id: '840030035', label: 'Headline adjusted', adjustment: 'adjusted' },
  { id: '840030010', label: 'Core adjusted', adjustment: 'adjusted' },
  { id: '840030009', label: 'Headline n.s.a.', adjustment: 'nsa' },
  { id: '840030036', label: 'Core n.s.a.', adjustment: 'nsa' },
] as const

export function assessCpiIndexMagnitudeScore(release: InspectorRelease | null, history: FamilyMagnitudeHistory) {
  if (!matchesReadingFamily(release, cpiReadingFamily)) return null
  const readings = cpiIndexScoreSeries.map((series) => assessSignedMagnitudeReading(series, release, history, 0))
  return { readings, adjusted: sumSignedMagnitudeScores(readings.filter((row) => row.adjustment === 'adjusted')),
    nsa: sumSignedMagnitudeScores(readings.filter((row) => row.adjustment === 'nsa')), version: cpiIndexScoreVersion }
}
