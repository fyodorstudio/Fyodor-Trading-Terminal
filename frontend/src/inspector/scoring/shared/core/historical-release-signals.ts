import type { EconomicCalendarEvent } from '../../../calendar-event'
import type { InspectorRelease } from '../../../inspector-data'
import { validMagnitudeLimits, type MagnitudeLimits } from '../../../magnitude/magnitude-distribution'

export type SignalInputs = { actual: number; baseline: number; actualLabel: string; baselineLabel: string; unit: string }
export type HistoricalFeature = { value: number | null; reason: string; inputs?: SignalInputs }
export type TimedReading = EconomicCalendarEvent & { release_at: number }
export type NativeSeries = { id: string; units: readonly number[]; multiplier: number }
export const signalHistoryStart = Date.UTC(2015, 0, 1)
export const minimumSignalHistory = 24
export const cleanSignal = (n: number) => Math.round(n * 1e12) / 1e12 || 0
export const unavailableSignal = (reason: string): HistoricalFeature => ({ value: null, reason })
export const usableSignal = (value: number, inputs?: SignalInputs): HistoricalFeature => ({ value: cleanSignal(value), reason: '', inputs })

export function observedReading(e: EconomicCalendarEvent): e is TimedReading {
  return e.currency === 'USD' && e.country_code === 'US' && e.time_mode === 0 && e.release_at !== null &&
    Number.isFinite(e.release_at) && e.release_at >= signalHistoryStart &&
    (!('availability' in e) || e.availability === 'observed')
}
export function referenceMonth(e: EconomicCalendarEvent) {
  if (!Number.isFinite(e.period_seconds) || e.period_seconds <= 0) return null
  const date = new Date(e.period_seconds * 1000)
  return Number.isFinite(date.getTime()) ? date.getUTCFullYear() * 12 + date.getUTCMonth() : null
}
export function nativeNumber(e: EconomicCalendarEvent | undefined, field: 'actual' | 'previous' | 'revised_previous' = 'actual') {
  if (!e || e[field] === null || !Number.isFinite(e[field])) return null
  const raw = e[`${field}_raw_scaled_1e6`]
  if (raw != null) {
    if (!/^[+-]?\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) return null
    return Number(raw) / 1e6
  }
  return e[field]
}
export function earlierSignalReadings(release: InspectorRelease, events: readonly EconomicCalendarEvent[], ids: readonly string[]) {
  const seen = new Set<string>()
  return events.filter((e): e is TimedReading => {
    if (!observedReading(e) || release.releaseAt === null || e.release_at >= release.releaseAt ||
      !ids.includes(e.event_id) || seen.has(e.value_id)) return false
    seen.add(e.value_id)
    return true
  })
}

export function releaseSignalContext(release: InspectorRelease, history: readonly TimedReading[],
  series: readonly NativeSeries[], scoringIds: readonly string[]) {
  const current = new Map<string, EconomicCalendarEvent>(), reasons = new Map<string, string>()
  const at = release.releaseAt
  const validTime = !release.timingUncertain && at !== null && Number.isFinite(at)
  const date = new Date(at ?? 0), publicationMonth = date.getUTCFullYear() * 12 + date.getUTCMonth()
  for (const rule of series) {
    const rows = release.events.filter((e) => e.event_id === rule.id), e = rows[0]
    const reference = e && referenceMonth(e)
    const reason = !validTime ? 'A verified publication time is required.' : rows.length !== 1 ?
      `Requires exactly one reading for series ${rule.id}.` : !observedReading(e) || e.release_at !== at ?
        'Requires an observed US reading at this publication time.' : !rule.units.includes(e.unit) || e.multiplier !== rule.multiplier || nativeNumber(e) === null ?
          'Requires a finite reading in the expected native unit.' : reference === null || reference >= publicationMonth ?
            'Requires a valid reference month before publication.' : ''
    if (reason) reasons.set(rule.id, reason)
    else current.set(rule.id, e)
  }
  const scoringMonths = new Set(scoringIds.flatMap((id) => current.has(id) ? [referenceMonth(current.get(id)!)] : []))
  if (scoringMonths.size > 1) {
    for (const rule of series) reasons.set(rule.id, 'Usable scoring readings must share the same reference month.')
    current.clear()
  } else if (scoringMonths.size === 1) {
    const anchor = [...scoringMonths][0]
    for (const [id, e] of current) if (referenceMonth(e) !== anchor) {
      current.delete(id); reasons.set(id, 'Supporting reading has a different reference month.')
    }
  }
  function previousActual(id: string, reference: number) {
    const rule = series.find((s) => s.id === id)!
    const candidates = history.filter((e) => e.event_id === id && referenceMonth(e) === reference && e.release_at < at!)
    if (!candidates.length) return null
    const latest = Math.max(...candidates.map((e) => e.release_at))
    const rows = candidates.filter((e) => e.release_at === latest), e = rows[0]
    const publication = new Date(latest)
    return rows.length !== 1 || !rule.units.includes(e.unit) || e.multiplier !== rule.multiplier ||
      reference >= publication.getUTCFullYear() * 12 + publication.getUTCMonth() ? null : nativeNumber(e)
  }
  function recent(id: string) {
    const e = current.get(id)
    if (!e) return null
    const values = [1, 2, 3].map((n) => previousActual(id, referenceMonth(e)! - n))
    return values.some((n) => n === null) ? null : values as number[]
  }
  function delta(id: string) {
    const e = current.get(id), actual = nativeNumber(e), previous = nativeNumber(e, 'previous')
    return actual === null || previous === null ? null : cleanSignal(actual - previous)
  }
  return { current, reasons, recent, delta }
}

export function calibrateHistoricalSignal(feature: HistoricalFeature, samples: readonly number[], manualLimits?: MagnitudeLimits) {
  if (manualLimits && !validMagnitudeLimits(manualLimits)) throw new RangeError('Use 0 < Small < Medium < Large')
  const magnitudes = samples.map(Math.abs).filter((n) => n > 0).sort((a, b) => a - b)
  const quantile = (fraction: number) => magnitudes[Math.max(0, Math.ceil(magnitudes.length * fraction) - 1)]
  const automaticLimits: MagnitudeLimits | null = magnitudes.length ? [quantile(1 / 3), quantile(2 / 3), quantile(.90)] : null
  const limits = manualLimits ?? automaticLimits
  const { value } = feature
  const reason = feature.reason || (samples.length < minimumSignalHistory ?
    `Needs ${minimumSignalHistory} earlier usable signals; found ${samples.length}.` : value !== 0 && !limits ?
      'Earlier signals are all zero; a nonzero magnitude cannot be calibrated.' : '')
  const points = value === null || reason ? null : value === 0 ? 0 : Math.sign(value) *
    (Math.abs(value) <= limits![0] ? 1 : Math.abs(value) <= limits![1] ? 2 : Math.abs(value) <= limits![2] ? 3 : 4)
  return { ...feature, value, reason, points, limits, automaticLimits, magnitudeMode: manualLimits ? 'custom' as const : 'automatic' as const, sampleCount: samples.length,
    size: points === null ? null : (['Unchanged', 'Small', 'Medium', 'Large', 'Extreme'] as const)[Math.abs(points)] }
}
