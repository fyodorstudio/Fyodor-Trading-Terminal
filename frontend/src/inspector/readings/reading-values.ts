import type { EconomicCalendarEvent } from '../../economic-calendar/contracts/calendar-event'
import { isPolicyRateDecision } from '../episodes/policy-episodes'

function inspectorDifference(event: EconomicCalendarEvent, comparator: 'previous' | 'forecast' | 'revised_previous'): number | null {
  const reference = event[comparator]
  if (event.actual === null || reference === null || !Number.isFinite(event.actual) || !Number.isFinite(reference)) return null
  const rawReference = event[`${comparator}_raw_scaled_1e6`]
  if (event.actual_raw_scaled_1e6 != null && rawReference != null) {
    if (!/^[+-]?\d+$/.test(event.actual_raw_scaled_1e6) || !/^[+-]?\d+$/.test(rawReference)) return null
    const difference = BigInt(event.actual_raw_scaled_1e6) - BigInt(rawReference)
    const number = Number(difference)
    return Number.isSafeInteger(number) ? number / 1_000_000 : null
  }
  const scale = 10 ** Math.min(6, Math.max(0, event.digits))
  const actual = Math.round(event.actual * scale), expected = Math.round(reference * scale)
  if (!Number.isSafeInteger(actual) || !Number.isSafeInteger(expected) || !Number.isSafeInteger(actual - expected)) return null
  return (actual - expected) / scale
}
export function inspectorDelta(event: EconomicCalendarEvent): number | null {
  return inspectorDifference(event, 'previous')
}
export function inspectorSurprise(event: EconomicCalendarEvent): number | null {
  return inspectorDifference(event, 'forecast')
}
// A populated revised field can simply repeat Previous. Share this gate across
// the reference label, revised delta and revised magnitude so they stay aligned.
export function hasRevisedPreviousChange(event: EconomicCalendarEvent): boolean {
  if (event.revised_previous === null || !Number.isFinite(event.revised_previous)) return false
  if (event.previous === null || !Number.isFinite(event.previous)) return true
  const previous = event.previous_raw_scaled_1e6, revised = event.revised_previous_raw_scaled_1e6
  if (previous != null && revised != null && /^[+-]?\d+$/.test(previous) && /^[+-]?\d+$/.test(revised)) {
    return BigInt(previous) !== BigInt(revised)
  }
  return event.previous !== event.revised_previous
}
export function inspectorRevisedDelta(event: EconomicCalendarEvent): number | null {
  return inspectorDifference(event, 'revised_previous')
}
export function inspectorValueUnit(event: EconomicCalendarEvent, delta = false): string {
  const isRate = delta && isPolicyRateDecision(event)
  return event.unit === 1 ? delta ? isRate ? ' bp' : ' pp' : '%' :
    event.unit === 3 ? ' h' : ({ 1: 'k', 2: 'M', 3: 'B', 4: 'T' } as Record<number, string>)[event.multiplier] ??
    (event.unit === 0 ? ' pts' : '')
}
export function formatInspectorValue(value: number | null, event: EconomicCalendarEvent, delta = false, maximumFractionDigits = 6): string {
  if (value === null || !Number.isFinite(value)) return '—'
  const isRate = delta && isPolicyRateDecision(event)
  const number = isRate ? value * 100 : value
  const text = number.toLocaleString(undefined, { maximumFractionDigits, signDisplay: delta ? 'exceptZero' : 'auto' })
  return `${text}${inspectorValueUnit(event, delta)}`
}
