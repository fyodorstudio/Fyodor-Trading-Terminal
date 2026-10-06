import type { EconomicCalendarEvent } from '../../../../../../calendar-event'
import { groupInspectorReleases, inspectorDelta, type InspectorRelease } from '../../../../../../inspector-data'
import { magnitudeEvidence } from '../../../../../shared/core/magnitude-evidence'
import { calibrateHistoricalSignal, type HistoricalFeature, type SignalInputs } from '../../../../../shared/core/historical-release-signals'
import type { MagnitudeSettings } from '../../../../../../magnitude/settings/magnitude-settings-store'
import { priorReferenceRows } from '../../../../../shared/core/reference-history-index'

export const cpiScoreV3Version = 'cpi-eurusd-release-change-v3.1'
export const cpiV3HistoryStart = Date.UTC(2015, 0, 1)
export const cpiV3SeriesIds = ['840030005', '840030006', '840030008'] as const
export const cpiV3MinimumHistory = 24
// Keep v2's weights and supporting signals to isolate the new primary signal.
export const cpiV3Signals = [
  { id: 'fresh', label: 'Latest core pace', group: 'core-monthly', weight: 35,
    description: 'Actual Core m/m minus the average actual Core m/m of the preceding three reference months.' },
  { id: 'trend', label: 'Core trend', group: 'core-monthly', weight: 35,
    description: 'Latest rolling three-month Core m/m average minus the preceding rolling average (overlapping windows).' },
  { id: 'annual', label: 'Core annual confirmation', group: 'core-annual', weight: 20,
    description: 'Actual Core y/y minus supplied Previous Core y/y.' },
  { id: 'headline', label: 'Headline context', group: 'headline', weight: 10,
    description: 'Actual Headline m/m minus the average actual Headline m/m of the preceding three reference months.' },
] as const
const signals = cpiV3Signals
type SignalId = typeof signals[number]['id']
type Feature = HistoricalFeature
type Features = Record<SignalId, Feature>
type TimedEvent = EconomicCalendarEvent & { release_at: number }
const clean = (n: number) => Math.round(n * 1e12) / 1e12 || 0
const unavailable = (reason: string): Feature => ({ value: null, reason })
const feature = (value: number, inputs: SignalInputs): Feature => ({ value: clean(value), reason: '', inputs })

export function supportsCpiV3(release: InspectorRelease | null) {
  return !!release && release.familyId === 'us-cpi' && release.country === 'US' && release.currency === 'USD'
}
function observed(event: EconomicCalendarEvent): event is TimedEvent {
  return event.currency === 'USD' && event.country_code === 'US' && event.time_mode === 0 &&
    event.release_at !== null && Number.isFinite(event.release_at) && event.release_at >= cpiV3HistoryStart &&
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
export function cpiV3Features(release: InspectorRelease, history: readonly TimedEvent[]): Features {
  const failed = (reason: string): Features => Object.fromEntries(signals.map((s) => [s.id, unavailable(reason)])) as Features
  const at = release.releaseAt
  if (release.timingUncertain || at === null || !Number.isFinite(at)) return failed('A verified publication time is required.')
  const publication = new Date(at)
  const publicationMonth = publication.getUTCFullYear() * 12 + publication.getUTCMonth()
  const current = new Map<string, EconomicCalendarEvent>()
  const reasons = new Map<string, string>()
  for (const id of cpiV3SeriesIds) {
    const rows = release.events.filter((e) => e.event_id === id)
    const row = rows[0]
    const reference = row && month(row)
    const reason = rows.length !== 1 ? `Requires exactly one reading for series ${id}.` :
      !observed(row) || row.release_at !== at || rate(row) === null ? 'Requires an observed, finite US percentage reading at this publication time.' :
        reference === null || reference >= publicationMonth ? 'Requires a valid reference month before publication.' : ''
    if (reason) reasons.set(id, reason)
    else current.set(id, row)
  }
  // Do not aggregate otherwise valid rows describing different reference months.
  if (new Set([...current.values()].map(month)).size > 1) return failed('Usable current readings must share the same reference month.')
  function previousRate(id: string, reference: number) {
    const rows = priorReferenceRows(history, id, reference, at!)
    return rows.length === 1 ? rate(rows[0]) : null
  }
  const missing = 'Requires usable actuals for the preceding three consecutive reference months.'
  function monthly(id: string) {
    const row = current.get(id)
    if (!row) return { values: null, reason: reasons.get(id)! }
    const reference = month(row)!
    const values = [rate(row), ...[1, 2, 3].map((n) => previousRate(id, reference - n))]
    return values.some((v) => v === null) ? { values: null, reason: missing } : { values: values as number[], reason: '' }
  }
  const core = monthly('840030006'), headline = monthly('840030005')
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
  const annual = current.get('840030008')
  const annualDelta = annual ? inspectorDelta(annual) : null
  const inputs = (actual: number, baseline: number, actualLabel: string, baselineLabel: string): SignalInputs =>
    ({ actual, baseline, actualLabel, baselineLabel, unit: '%' })
  return {
    fresh: core.values ? feature(core.values[0] - mean(core.values.slice(1)), inputs(core.values[0], mean(core.values.slice(1)), 'Actual core m/m', 'Prior three-month average')) : unavailable(core.reason),
    trend: core.values ? feature(mean(core.values.slice(0, 3)) - mean(core.values.slice(1)), inputs(mean(core.values.slice(0, 3)), mean(core.values.slice(1)), 'Latest three-month average', 'Prior three-month average')) : unavailable(core.reason),
    annual: annualDelta === null ? unavailable(reasons.get('840030008') || 'Core y/y Actual and supplied Previous are required.') : feature(annualDelta, inputs(rate(annual)!, rate(annual)! - annualDelta, 'Actual core y/y', 'Supplied Previous core y/y')),
    headline: headline.values ? feature(headline.values[0] - mean(headline.values.slice(1)), inputs(headline.values[0], mean(headline.values.slice(1)), 'Actual headline m/m', 'Prior three-month average')) : unavailable(headline.reason),
  }
}

export function assessCpiScoreV3(release: InspectorRelease | null, events: readonly EconomicCalendarEvent[], settings: MagnitudeSettings = {}) {
  if (!supportsCpiV3(release) || !release) return null
  const seen = new Set<string>()
  const history = events.filter((e): e is TimedEvent => {
    if (!observed(e) || release.releaseAt === null || e.release_at >= release.releaseAt ||
      !cpiV3SeriesIds.includes(e.event_id as typeof cpiV3SeriesIds[number]) || seen.has(e.value_id)) return false
    seen.add(e.value_id)
    return true
  })
  const past = groupInspectorReleases(history).filter(supportsCpiV3).map((r) => cpiV3Features(r, history))
  const current = cpiV3Features(release, history)
  const readings = signals.map((signal) => {
    const samples = past.map((f) => f[signal.id].value).filter((n): n is number => n !== null)
    const calibrated = calibrateHistoricalSignal(current[signal.id], samples, settings[signal.id])
    return { ...signal, ...calibrated, contribution: calibrated.points === null ? null : calibrated.points * signal.weight / 100 }
  })
  const usable = readings.filter((r) => r.points !== null)
  // Require at least one usable core component; headline alone is insufficient.
  const hasCore = usable.some((r) => r.id !== 'headline')
  const units = hasCore ? usable.reduce((sum, r) => sum + r.points! * r.weight, 0) : null
  const total = units === null ? null : units / 100
  const tieBreak = units === 0 ? usable.find((r) => r.points !== 0) ?? null : null
  const deciding = units === 0 ? tieBreak?.points ?? 0 : units
  const direction = deciding === null || deciding === 0 ? 'uncomputed' : deciding > 0 ? 'short' : 'long'
  const label = direction === 'short' ? 'EURUSD Short' : direction === 'long' ? 'EURUSD Long' : 'Uncomputed'
  const evidence = magnitudeEvidence(readings, direction, !!tieBreak)
  const driver = usable.filter((r) => Math.sign(r.contribution!) === Math.sign(deciding ?? 0))
    .sort((a, b) => Math.abs(b.contribution!) - Math.abs(a.contribution!))[0]
  const explanation = !hasCore ? 'No usable core inflation component; headline alone cannot establish this bias.' :
    units === 0 ? tieBreak ? `Scores cancel; ${tieBreak.label.toLowerCase()} breaks the tie.` : 'Usable signals show no change; no directional evidence.' :
      driver ? driver.id === 'fresh' ? driver.value! < 0 ? 'The latest core inflation pace is below its recent average.' : 'The latest core inflation pace is above its recent average.' :
        driver.id === 'trend' ? driver.value! < 0 ? 'The recent core inflation trend is cooling.' : 'The recent core inflation trend is heating up.' :
          driver.id === 'annual' ? driver.value! < 0 ? 'Annual core inflation is slowing.' : 'Annual core inflation is accelerating.' :
            driver.value! < 0 ? 'Headline inflation is below its recent pace.' : 'Headline inflation is above its recent pace.' : ''
  return { readings, total, tieBreak, direction, label, explanation, ...evidence,
    version: cpiScoreV3Version }
}
