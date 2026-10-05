import type { InspectorRelease } from '../inspector-data'
import type { FamilyMagnitudeHistory } from '../magnitude/useFamilyMagnitudeHistory'
import { cpiReadingFamily } from './cpi-grading'
import { matchesReadingFamily } from './reading-grading'
import { assessSignedMagnitudeReading, sumSignedMagnitudeScores, formatSignedMagnitudeScore as formatCpiScore } from './signed-magnitude-score'
export { signedMagnitudeColumns as cpiScoreColumns, formatSignedMagnitudeScore as formatCpiScore } from './signed-magnitude-score'

export const cpiScoreVersion = 'cpi-eurusd-signed-magnitude-v1'
export const cpiScoreSeries = [
  { id: '840030005', label: 'Headline m/m', period: 'monthly' },
  { id: '840030006', label: 'Core m/m', period: 'monthly' },
  { id: '840030007', label: 'Headline y/y', period: 'annual' },
  { id: '840030008', label: 'Core y/y', period: 'annual' },
] as const
const tiePriority = ['840030006', '840030005', '840030008', '840030007']

export function assessCpiMagnitudeScore(release: InspectorRelease | null, history: FamilyMagnitudeHistory) {
  if (!matchesReadingFamily(release, cpiReadingFamily)) return null
  const readings = cpiScoreSeries.map((series) => {
    const reading = assessSignedMagnitudeReading(series, release, history, 1)
    return reading.status === 'scored' && reading.score !== 0 ? { ...reading,
      reason: `${reading.score! > 0 ? 'Bullish' : 'Bearish'} USD contribution: ${formatCpiScore(reading.score)} (${reading.size}). Series weight = 1.` } : reading
  })
  const monthly = sumSignedMagnitudeScores(readings.filter((row) => row.period === 'monthly'))
  const annual = sumSignedMagnitudeScores(readings.filter((row) => row.period === 'annual'))
  const total = sumSignedMagnitudeScores(readings)
  const tieBreak = total === 0 ? tiePriority.map((id) => readings.find((row) => row.id === id)!)
    .find((row) => row.score !== 0) ?? null : null
  const decidingScore = total === 0 ? tieBreak?.score ?? 0 : total
  const direction = decidingScore === null || decidingScore === 0 ? 'uncomputed' : decidingScore > 0 ? 'short' : 'long'
  const label = direction === 'short' ? 'EURUSD Short' : direction === 'long' ? 'EURUSD Long' : 'Uncomputed'
  const explanation = total === null ? 'All four primary readings need a usable score. Undefined, missing, duplicate or unavailable scores leave direction uncomputed.' :
    total === 0 ? tieBreak ? `USD total = 0. Tie-break: ${tieBreak.label} ${formatCpiScore(tieBreak.score)}. Priority: Core m/m, Headline m/m, Core y/y, Headline y/y.` :
      'All four readings are unchanged. No directional contribution; no prior direction is carried forward.' :
      `USD score ${formatCpiScore(total)}. Positive = EURUSD Short; negative = EURUSD Long. All series have weight 1. Magnitudes contribute 0–4 points.`
  return { readings, monthly, annual, total, tieBreak, direction, label, explanation, version: cpiScoreVersion }
}
