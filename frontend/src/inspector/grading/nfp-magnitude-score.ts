import type { InspectorRelease } from '../inspector-data'
import type { FamilyMagnitudeHistory } from '../magnitude/useFamilyMagnitudeHistory'
import { nfpReadingFamily, nfpReadingRules } from './nfp-grading'
import { matchesReadingFamily } from './reading-grading'
import { assessSignedMagnitudeReading, formatSignedMagnitudeScore, sumSignedMagnitudeScores,
  type MagnitudeScoreUnit } from './signed-magnitude-score'

export const nfpScoreVersion = 'nfp-eurusd-primary-signed-magnitude-v1'
const payrollUnit: MagnitudeScoreUnit = { units: [0, 4], multiplier: 1, description: 'payrolls in thousands of jobs' }
const rateUnit: MagnitudeScoreUnit = { units: [1], multiplier: 0, description: 'a percentage rate' }
const hoursUnit: MagnitudeScoreUnit = { units: [3], multiplier: 0, description: 'weekly hours in native hours' }
export const nfpScoreSeries = [
  { id: '840030016', label: 'Nonfarm Payrolls', role: 'primary', unit: payrollUnit,
    description: 'Broad monthly job creation. Higher A−P contributes positive USD points.' },
  { id: '840030015', label: 'Unemployment Rate', role: 'primary', unit: rateUnit,
    description: 'Labor-market slack. Lower A−P contributes positive USD points.' },
  { id: '840030018', label: 'Earnings m/m', role: 'primary', unit: rateUnit,
    description: 'Latest monthly wage-growth momentum. Higher A−P contributes positive USD points.' },
  { id: '840030019', label: 'Earnings y/y', role: 'supporting', unit: rateUnit,
    description: 'Annual wage trend. Excluded from the total to avoid a second wage contribution.' },
  { id: '840030017', label: 'Participation Rate', role: 'supporting', unit: rateUnit,
    description: 'Helps explain unemployment changes. Its direction alone is ambiguous; excluded from the total.' },
  { id: '840030020', label: 'Weekly Hours', role: 'supporting', unit: hoursUnit,
    description: 'Labor usage beyond job counts. Supporting corroboration; excluded from the total.' },
  { id: '840030023', label: 'Private Payrolls', role: 'supporting', unit: payrollUnit,
    description: 'Private hiring within total payrolls. Excluded from the total to avoid counting it again.' },
  { id: '840030022', label: 'Government Payrolls', role: 'supporting', unit: payrollUnit,
    description: 'Government hiring within total payrolls. Excluded from the total to avoid counting it again.' },
  { id: '840030032', label: 'Manufacturing Payrolls', role: 'supporting', unit: payrollUnit,
    description: 'Sector detail within private and total payrolls. Excluded from the total to avoid counting it again.' },
  { id: '840030024', label: 'U6 Unemployment', role: 'supporting', unit: rateUnit,
    description: 'Broader labor underutilization. Overlaps with unemployment; excluded from the total.' },
] as const
const tiePriority = ['840030016', '840030015', '840030018']

export function assessNfpMagnitudeScore(release: InspectorRelease | null, history: FamilyMagnitudeHistory) {
  if (!matchesReadingFamily(release, nfpReadingFamily)) return null
  const readings = nfpScoreSeries.map((series) => {
    const reading = assessSignedMagnitudeReading(series, release, history, series.unit, nfpReadingRules[series.id].goodWhen)
    if (reading.status !== 'scored' || reading.score === 0) return reading
    const meaning = series.role === 'primary' ? 'USD contribution' : 'Supporting convention points; excluded from USD total'
    return { ...reading, reason: `${meaning}: ${formatSignedMagnitudeScore(reading.score)} (${reading.size}). ${series.description}` }
  })
  const primary = readings.filter((row) => row.role === 'primary')
  const supporting = readings.filter((row) => row.role === 'supporting')
  const total = sumSignedMagnitudeScores(primary)
  const tieBreak = total === 0 ? tiePriority.map((id) => primary.find((row) => row.id === id)!)
    .find((row) => row.score !== 0) ?? null : null
  const decidingScore = total === 0 ? tieBreak?.score ?? 0 : total
  const direction = decidingScore === null || decidingScore === 0 ? 'uncomputed' : decidingScore > 0 ? 'short' : 'long'
  const label = direction === 'short' ? 'EURUSD Short' : direction === 'long' ? 'EURUSD Long' : 'Uncomputed'
  const explanation = total === null ? 'All three primary readings need usable scores. Undefined, missing, duplicate or unavailable primary scores leave direction uncomputed. Supporting readings do not gate direction.' :
    total === 0 ? tieBreak ? `USD total = 0. Tie-break: ${tieBreak.label} ${formatSignedMagnitudeScore(tieBreak.score)}. Priority: Nonfarm Payrolls, Unemployment Rate, Earnings m/m.` :
      'All three primary readings are unchanged. No directional contribution; no prior direction is carried forward.' :
      `USD score ${formatSignedMagnitudeScore(total)}. Positive = EURUSD Short; negative = EURUSD Long. Payrolls, Unemployment and Earnings m/m each have weight 1 and contribute 0–4 magnitude points. Supporting readings are excluded.`
  return { primary, supporting, total, tieBreak, direction, label, explanation, version: nfpScoreVersion }
}
