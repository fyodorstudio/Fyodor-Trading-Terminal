import type { EconomicCalendarEvent } from '../../../../../../calendar-event'
import { groupInspectorReleases, inspectorDelta, type InspectorRelease } from '../../../../../../inspector-data'

export const cpiScoreV2Version = 'cpi-eurusd-level-trend-v2'
export const cpiV2HistoryStart = Date.UTC(2015, 0, 1)
export const cpiV2SeriesIds = ['840030005', '840030006', '840030008'] as const
export const cpiV2Reference = 0.20 // A prototype monthly reference, not the Fed's inflation target.
export const cpiV2MinimumHistory = 24
const signals = [
  { id: 'pressure', label: 'Core pressure', weight: 35,
    description: 'Latest three-month average of actual Core m/m minus the 0.20% monthly reference.' },
  { id: 'trend', label: 'Core trend', weight: 35,
    description: 'Latest three-month average of actual Core m/m minus the preceding rolling three-month average (overlapping windows).' },
  { id: 'annual', label: 'Core annual confirmation', weight: 20,
    description: 'Actual Core y/y minus supplied Previous Core y/y.' },
  { id: 'headline', label: 'Headline context', weight: 10,
    description: 'Actual Headline m/m minus the average actual Headline m/m of the preceding three reference months.' },
] as const
type SignalId = typeof signals[number]['id']
type Feature = { value: number | null; reason: string }
type Features = Record<SignalId, Feature>
type TimedEvent = EconomicCalendarEvent & { release_at: number }
const clean = (n: number) => Math.round(n * 1e12) / 1e12
const unavailable = (reason: string): Feature => ({ value: null, reason })
const feature = (value: number): Feature => ({ value: clean(value), reason: '' })

export function supportsCpiV2(release: InspectorRelease | null) {
  return !!release && release.familyId === 'us-cpi' && release.country === 'US' && release.currency === 'USD'
}
function observed(event: EconomicCalendarEvent): event is TimedEvent {
  return event.currency === 'USD' && event.country_code === 'US' && event.time_mode === 0 &&
    event.release_at !== null && Number.isFinite(event.release_at) && event.release_at >= cpiV2HistoryStart &&
    (!('availability' in event) || event.availability === 'observed')
}
function month(event: EconomicCalendarEvent) {
  if (!Number.isFinite(event.period_seconds) || event.period_seconds <= 0) return null
  const date = new Date(event.period_seconds * 1000)
  return Number.isFinite(date.getTime()) ? date.getUTCFullYear() * 12 + date.getUTCMonth() : null
}
function rate(event: EconomicCalendarEvent | undefined) {
  if (!event || event.unit !== 1 || event.multiplier !== 0 || event.actual === null || !Number.isFinite(event.actual)) return null
  const raw = event.actual_raw_scaled_1e6
  if (raw != null) {
    if (!/^[+-]?\d+$/.test(raw)) return null
    const value = Number(raw) / 1e6
    return Number.isFinite(value) ? value : null
  }
  return event.actual
}
function features(release: InspectorRelease, history: readonly TimedEvent[]): Features {
  const failed = (reason: string): Features => Object.fromEntries(signals.map((s) => [s.id, unavailable(reason)])) as Features
  if (release.timingUncertain || release.releaseAt === null || !Number.isFinite(release.releaseAt))
    return failed('A verified publication time is required.')
  const current = new Map<string, EconomicCalendarEvent>()
  for (const id of cpiV2SeriesIds) {
    const rows = release.events.filter((e) => e.event_id === id)
    if (rows.length !== 1) return failed(`Requires exactly one reading for series ${id}.`)
    const row = rows[0]
    if (!observed(row) || row.release_at !== release.releaseAt || rate(row) === null)
      return failed('Requires observed, finite US percentage readings at this publication time.')
    current.set(id, row)
  }
  const referenceMonth = month(current.get('840030006')!)
  if (referenceMonth === null || [...current.values()].some((e) => month(e) !== referenceMonth))
    return failed('The three required readings must share a valid reference month.')
  const publication = new Date(release.releaseAt)
  if (referenceMonth >= publication.getUTCFullYear() * 12 + publication.getUTCMonth())
    return failed('The reference month must precede the publication month.')
  // Take the last available publication for each reference month; duplicates at
  // that instant invalidate the month rather than falling back to an older value.
  function previousRate(id: string, reference: number) {
    const candidates = history.filter((e) => e.event_id === id && month(e) === reference && e.release_at < release.releaseAt!)
    if (!candidates.length) return null
    const latest = Math.max(...candidates.map((e) => e.release_at))
    const rows = candidates.filter((e) => e.release_at === latest)
    return rows.length === 1 ? rate(rows[0]) : null
  }
  const core = [rate(current.get('840030006')), ...[1, 2, 3].map((n) => previousRate('840030006', referenceMonth - n))]
  const headline = [1, 2, 3].map((n) => previousRate('840030005', referenceMonth - n))
  const missing = 'Requires usable actuals for consecutive reference months before this release.'
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
  const coreAverage = core.slice(0, 3).every((v) => v !== null) ? mean(core.slice(0, 3) as number[]) : null
  const annualDelta = inspectorDelta(current.get('840030008')!)
  return {
    pressure: coreAverage === null ? unavailable(missing) : feature(coreAverage - cpiV2Reference),
    trend: core.some((v) => v === null) ? unavailable(missing) : feature(mean(core.slice(0, 3) as number[]) - mean(core.slice(1) as number[])),
    annual: annualDelta === null ? unavailable('Core y/y Actual and supplied Previous are required.') : feature(annualDelta),
    headline: headline.some((v) => v === null) ? unavailable(missing) : feature(rate(current.get('840030005'))! - mean(headline as number[])),
  }
}
function quantile(sorted: readonly number[], fraction: number) {
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]
}

export function assessCpiScoreV2(release: InspectorRelease | null, events: readonly EconomicCalendarEvent[]) {
  if (!supportsCpiV2(release) || !release) return null
  // Never admit the selected release or later publications into calibration.
  // Identical inventory copies are deduplicated by value identity, not series.
  const seen = new Set<string>()
  const history = events.filter((e): e is TimedEvent => {
    if (!observed(e) || release.releaseAt === null || e.release_at >= release.releaseAt ||
      !cpiV2SeriesIds.includes(e.event_id as typeof cpiV2SeriesIds[number]) || seen.has(e.value_id)) return false
    seen.add(e.value_id)
    return true
  })
  const past = groupInspectorReleases(history).filter(supportsCpiV2).map((r) => features(r, history))
  const current = features(release, history)
  const readings = signals.map((signal) => {
    const samples = past.map((f) => f[signal.id].value).filter((n): n is number => n !== null)
    const magnitudes = samples.map(Math.abs).filter((n) => n > 0).sort((a, b) => a - b)
    // Non-decreasing limits intentionally permit tied percentiles. Equal source
    // values get equal magnitudes; some buckets can be empty in discrete data.
    const limits = magnitudes.length ? [quantile(magnitudes, 1 / 3), quantile(magnitudes, 2 / 3), quantile(magnitudes, .90)] : null
    const value = current[signal.id].value
    const reason = current[signal.id].reason || (samples.length < cpiV2MinimumHistory ?
      `Needs ${cpiV2MinimumHistory} earlier usable signals; found ${samples.length}.` : value !== 0 && !limits ?
        'Earlier signals are all zero; a nonzero magnitude cannot be calibrated.' : '')
    const points = value === null || reason ? null : value === 0 ? 0 : Math.sign(value) *
      (Math.abs(value) <= limits![0] ? 1 : Math.abs(value) <= limits![1] ? 2 : Math.abs(value) <= limits![2] ? 3 : 4)
    return { ...signal, value, points, contribution: points === null ? null : points * signal.weight / 100,
      size: points === null ? null : (['Unchanged', 'Small', 'Medium', 'Large', 'Extreme'] as const)[Math.abs(points)],
      limits, sampleCount: samples.length, reason }
  })
  const units = readings.every((r) => r.points !== null) ? readings.reduce((sum, r) => sum + r.points! * r.weight, 0) : null
  const total = units === null ? null : units / 100
  // Stable published priority prevents a Mixed label on exact cancellation.
  const tieBreak = units === 0 ? readings.find((r) => r.points !== 0) ?? null : null
  const deciding = units === 0 ? tieBreak?.points ?? 0 : units
  const direction = deciding === null || deciding === 0 ? 'uncomputed' : deciding > 0 ? 'short' : 'long'
  const label = direction === 'short' ? 'EURUSD Short' : direction === 'long' ? 'EURUSD Long' : 'Uncomputed'
  const driver = readings.filter((r) => r.contribution !== null && Math.sign(r.contribution) === Math.sign(deciding ?? 0))
    .sort((a, b) => Math.abs(b.contribution!) - Math.abs(a.contribution!))[0]
  const explanation = units === null ? readings.find((r) => r.points === null)!.reason :
    units === 0 ? tieBreak ? `Scores cancel; ${tieBreak.label.toLowerCase()} breaks the tie.` : 'All signals are zero; no directional evidence.' :
      driver ? `${driver.label}: ${driver.id === 'pressure' ? driver.value! < 0 ? 'recent core inflation is below the reference.' : 'recent core inflation is above the reference.' :
        driver.id === 'trend' ? driver.value! < 0 ? 'the core inflation trend is cooling.' : 'the core inflation trend is heating up.' :
          driver.id === 'annual' ? driver.value! < 0 ? 'annual core inflation is slowing.' : 'annual core inflation is accelerating.' :
            driver.value! < 0 ? 'headline inflation is below its recent pace.' : 'headline inflation is above its recent pace.'}` : ''
  return { readings, total, tieBreak, direction, label, explanation, version: cpiScoreV2Version }
}
