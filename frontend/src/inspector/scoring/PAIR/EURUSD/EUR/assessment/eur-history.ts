import type { EconomicCalendarEvent } from '../../../../../calendar-event'
import { inspectorEventChartTime, type InspectorRelease } from '../../../../../inspector-data'
import { nativeNumber, referenceMonth, signalHistoryStart } from '../../../../shared/core/historical-release-signals'
import { priorReferenceRows } from '../../../../shared/core/reference-history-index'
import type { EurSignal, EurPolicy } from '../policy/eur-policies'

export type EurReading = EconomicCalendarEvent & { release_at: number }
export function observedEur(e: EconomicCalendarEvent): e is EurReading {
  return e.currency === 'EUR' && ['EU', 'DE', 'FR'].includes(e.country_code) && e.time_mode === 0 &&
    e.release_at !== null && Number.isFinite(e.release_at) && e.release_at >= signalHistoryStart &&
    (!('availability' in e) || e.availability === 'observed')
}
export function eurNative(row: EconomicCalendarEvent | undefined, signal: EurSignal) {
  const value = nativeNumber(row)
  const country = signal.seriesId.startsWith('276') ? 'DE' : signal.seriesId.startsWith('250') ? 'FR' : 'EU'
  return row && row.currency === 'EUR' && row.country_code === country && row.unit === (signal.mode === 'pmi' ? 0 : 1) && row.multiplier === 0 && value !== null &&
    (signal.mode !== 'pmi' || value >= 0 && value <= 100) ? value : null
}
export function eurReleaseMonth(release: InspectorRelease, policy: EurPolicy) {
  const rows = release.events.filter(e => policy.signals.some(s => s.seriesId === e.event_id))
  const periods = new Set(rows.map(referenceMonth))
  return periods.size === 1 && !periods.has(null) ? [...periods][0]! : null
}
export function eurReleaseUsable(release: InspectorRelease, policy: EurPolicy) {
  return !release.timingUncertain && release.chartTime !== null && Number.isFinite(release.chartTime) && release.releaseAt !== null && Number.isFinite(release.releaseAt) &&
    release.events.every(e => inspectorEventChartTime(e) === release.chartTime && e.release_at === release.releaseAt && observedEur(e)) &&
    eurReleaseMonth(release, policy) !== null
}
export function eurEarlierValue(history: readonly EurReading[], signal: EurSignal, month: number, before: number) {
  const rows = priorReferenceRows(history, signal.seriesId, month, before)
  const row = rows[0], published = row ? new Date(row.release_at).getUTCFullYear() * 12 + new Date(row.release_at).getUTCMonth() : null
  const valid = published !== null && month <= published && (signal.cadence === 1 ? published - month <= 2 : month % 3 === 0 && published - month <= 6)
  return rows.length === 1 && valid ? eurNative(row, signal) : null
}
// Same-period final rows replace flash rows for historical calibration. Future
// finals cannot rewrite the comparison known at an earlier publication.
export function distinctEurCalibration(releases: readonly InspectorRelease[], policy: EurPolicy, before: number) {
  const periods = new Map<number, InspectorRelease[]>()
  for (const release of releases) {
    if (release.familyId !== policy.family || release.releaseAt === null || release.releaseAt >= before) continue
    const month = eurReleaseMonth(release, policy)
    if (month === null) continue
    const entries = periods.get(month) ?? [], latest = entries[0]?.releaseAt ?? -Infinity
    if (release.releaseAt > latest) periods.set(month, [release])
    else if (release.releaseAt === latest) entries.push(release)
  }
  return [...periods.values()].flatMap(rows => rows.length === 1 ? rows : [])
}

/** Shared scorer/Scatter population: one earlier publication per prior period. */
export function earlierEurSignalReleases(releases: readonly InspectorRelease[], policy: EurPolicy,
  signal: EurSignal, current: InspectorRelease) {
  const reference = eurReleaseMonth(current, policy)
  if (reference === null) return []
  const containingSignal = releases.filter(r => r.events.some(e => e.event_id === signal.seriesId))
  return distinctEurCalibration(containingSignal, policy, current.releaseAt ?? 0)
    .filter(r => eurReleaseMonth(r, policy)! < reference)
}
