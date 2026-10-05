import type { EconomicCalendarEvent } from '../calendar-event'
import { inspectorDelta, type InspectorRelease } from '../inspector-data'
import { magnitudeSizeForValue } from '../magnitude/magnitude-distribution'
import type { FamilyMagnitudeHistory } from '../magnitude/useFamilyMagnitudeHistory'

export const signedMagnitudeColumns = [
  { size: 'Unchanged', points: 0 }, { size: 'Small', points: 1 }, { size: 'Medium', points: 2 },
  { size: 'Large', points: 3 }, { size: 'Extreme', points: 4 },
] as const
export type SignedMagnitudeReading = {
  id: string; label: string; event: EconomicCalendarEvent | null
  size: typeof signedMagnitudeColumns[number]['size'] | null; score: number | null
  status: 'scored' | 'undefined' | 'missing' | 'duplicate' | 'unavailable'; reason: string
}
export function formatSignedMagnitudeScore(score: number | null) {
  return score === null ? '—' : score > 0 ? `+${score}` : score < 0 ? `−${Math.abs(score)}` : '0'
}
export function sumSignedMagnitudeScores(rows: readonly SignedMagnitudeReading[]) {
  return rows.every((row) => row.score !== null) ? rows.reduce((total, row) => total + row.score!, 0) : null
}
export function assessSignedMagnitudeReading<T extends { id: string; label: string }>(series: T,
  release: InspectorRelease, history: FamilyMagnitudeHistory, unit: number): T & SignedMagnitudeReading {
  const matches = release.events.filter((event) => event.event_id === series.id)
  const event = matches.length === 1 ? matches[0] : null
  const unavailable = (status: Exclude<SignedMagnitudeReading['status'], 'scored'>, reason: string): T & SignedMagnitudeReading =>
    ({ ...series, event, size: null, score: null, status, reason })
  if (matches.length > 1) return unavailable('duplicate', 'Requires exactly one reading for this series.')
  if (!event) return unavailable('missing', 'This release does not contain the required reading.')
  if (event.currency !== release.currency || event.country_code !== release.country)
    return unavailable('unavailable', 'The reading must match the release country and currency.')
  const delta = inspectorDelta(event)
  if (delta === null) return unavailable('missing', 'Actual or supplied Previous is unavailable.')
  if (event.unit !== unit || event.multiplier !== 0)
    return unavailable('unavailable', `This score requires ${unit === 1 ? 'a percentage rate' : 'an index in native points'}.`)
  const row = history.rows[event.value_id]
  if (row?.mode === 'undefined') return unavailable('undefined', 'Define this series’ magnitude mode in Scatter Plot.')
  if (!row) return unavailable('unavailable', history.message ?? 'Magnitude configuration is unavailable.')
  // Exact zero needs no historical threshold, but Undefined stays Undefined.
  if (delta === 0) return { ...series, event, size: 'Unchanged', score: 0, status: 'scored', reason: 'Actual equals supplied Previous.' }
  // Frozen manual limits classify a current reading independently of history.
  if (!row.distribution) return unavailable('unavailable', 'No usable dataset for the configured magnitude mode.')
  const size = magnitudeSizeForValue(row.distribution.limits, delta)
  const category = signedMagnitudeColumns.find((column) => column.size === size)
  if (!category) return unavailable('unavailable', 'Magnitude classification is unavailable.')
  const score = Math.sign(delta) * category.points
  return { ...series, event, size: category.size, score, status: 'scored',
    reason: `${score > 0 ? 'Positive' : 'Negative'} A−P: ${formatSignedMagnitudeScore(score)} (${category.size}). Series weight = 1.` }
}
