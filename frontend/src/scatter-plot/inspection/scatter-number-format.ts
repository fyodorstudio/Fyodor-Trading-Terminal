import type { EconomicCalendarEvent } from '../../inspector/calendar-event'
import { inspectorValueUnit } from '../../inspector/inspector-data'
import { isPolicyRateDecision } from '../../inspector/episodes/policy-episodes'

const formats = new Map<string, Intl.NumberFormat>()

// Scatter labels share a small set of precisions; reuse the locale formatter
// rather than constructing one for every historical reading and pointer move.
export function scatterNumber(value: number | null, digits = 6, signed = false): string {
  if (value === null) return '—'
  const key = `${digits}/${signed}`
  let format = formats.get(key)
  if (!format) {
    format = new Intl.NumberFormat(undefined, { maximumFractionDigits: digits, signDisplay: signed ? 'exceptZero' : 'auto' })
    formats.set(key, format)
  }
  return format.format(value)
}

export function scatterReading(value: number | null, event: EconomicCalendarEvent, delta = false, digits = 6): string {
  if (value === null || !Number.isFinite(value)) return '—'
  const number = delta && isPolicyRateDecision(event) ? value * 100 : value
  return `${scatterNumber(number, digits, delta)}${inspectorValueUnit(event, delta)}`
}
