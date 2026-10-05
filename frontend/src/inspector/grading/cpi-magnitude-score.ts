import type { EconomicCalendarEvent } from '../calendar-event'
import { inspectorDelta, type InspectorRelease } from '../inspector-data'
import { magnitudeSizeForValue } from '../magnitude/magnitude-distribution'
import type { FamilyMagnitudeHistory } from '../magnitude/useFamilyMagnitudeHistory'
import { cpiReadingFamily } from './cpi-grading'
import { matchesReadingFamily } from './reading-grading'

export const cpiScoreVersion = 'cpi-eurusd-signed-magnitude-v1'
export const cpiScoreColumns = [
  { size: 'Unchanged', points: 0 }, { size: 'Small', points: 1 }, { size: 'Medium', points: 2 },
  { size: 'Large', points: 3 }, { size: 'Extreme', points: 4 },
] as const
export const cpiScoreSeries = [
  { id: '840030005', label: 'Headline m/m', period: 'monthly' },
  { id: '840030006', label: 'Core m/m', period: 'monthly' },
  { id: '840030007', label: 'Headline y/y', period: 'annual' },
  { id: '840030008', label: 'Core y/y', period: 'annual' },
] as const
const tiePriority = ['840030006', '840030005', '840030008', '840030007']
type ScoreSize = typeof cpiScoreColumns[number]['size']
type ScoreStatus = 'scored' | 'undefined' | 'missing' | 'duplicate' | 'unavailable'
type ScoreReading = typeof cpiScoreSeries[number] & {
  event: EconomicCalendarEvent | null; size: ScoreSize | null; score: number | null; status: ScoreStatus; reason: string
}

export function formatCpiScore(score: number | null) {
  return score === null ? '—' : score > 0 ? `+${score}` : score < 0 ? `−${Math.abs(score)}` : '0'
}

export function assessCpiMagnitudeScore(release: InspectorRelease | null, history: FamilyMagnitudeHistory) {
  if (!matchesReadingFamily(release, cpiReadingFamily)) return null
  const readings = cpiScoreSeries.map((series): ScoreReading => {
    const matches = release.events.filter((event) => event.event_id === series.id)
    const event = matches.length === 1 ? matches[0] : null
    const unavailable = (status: Exclude<ScoreStatus, 'scored'>, reason: string): ScoreReading =>
      ({ ...series, event, size: null, score: null, status, reason })
    if (matches.length > 1) return unavailable('duplicate', 'Requires exactly one reading for this series.')
    if (!event) return unavailable('missing', 'This release does not contain the required reading.')
    if (event.currency !== cpiReadingFamily.currency || event.country_code !== cpiReadingFamily.country)
      return unavailable('unavailable', 'The reading must belong to US / USD CPI.')
    const delta = inspectorDelta(event)
    if (delta === null) return unavailable('missing', 'Actual or supplied Previous is unavailable.')
    if (event.unit !== 1 || event.multiplier !== 0) return unavailable('unavailable', 'This score requires an inflation rate expressed in percent.')
    const row = history.rows[event.value_id]
    if (row?.mode === 'undefined') return unavailable('undefined', 'Define this series’ magnitude mode in Scatter Plot.')
    if (!row) return unavailable('unavailable', history.message ?? 'Magnitude configuration is unavailable.')
    // Exact zero needs no historical threshold, but an Undefined mode stays Undefined.
    if (delta === 0) return { ...series, event, size: 'Unchanged', score: 0, status: 'scored', reason: 'Actual equals supplied Previous.' }
    // Custom limits remain usable without history. P95 needs an available baseline.
    if (row.mode === 'p95' && history.message) return unavailable('unavailable', history.error ?? history.message)
    if (!row.distribution) return unavailable('unavailable', 'No usable earlier baseline for the configured magnitude mode.')
    const size = magnitudeSizeForValue(row.distribution.limits, delta)
    const category = cpiScoreColumns.find((column) => column.size === size)
    if (!category) return unavailable('unavailable', 'Magnitude classification is unavailable.')
    const score = Math.sign(delta) * category.points
    return { ...series, event, size: category.size, score, status: 'scored',
      reason: `${score > 0 ? 'Bullish' : 'Bearish'} USD contribution: ${formatCpiScore(score)} (${category.size}). Series weight = 1.` }
  })
  const sum = (rows: ScoreReading[]) => rows.every((row) => row.score !== null) ? rows.reduce((total, row) => total + row.score!, 0) : null
  const monthly = sum(readings.filter((row) => row.period === 'monthly'))
  const annual = sum(readings.filter((row) => row.period === 'annual'))
  const total = sum(readings)
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
