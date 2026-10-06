import type { InspectorRelease } from '../../../../../inspector-data'
import { usableSignal, unavailableSignal, type HistoricalFeature, referenceMonth } from '../../../../shared/core/historical-release-signals'
import { eurPolicy } from '../policy/eur-policies'
import { eurEarlierValue, eurNative, eurReleaseMonth, eurReleaseUsable, type EurReading } from './eur-history'

export function eurFeatures(release: InspectorRelease, history: readonly EurReading[]): Record<string, HistoricalFeature> {
  const policy = eurPolicy(release.familyId)
  if (!policy) return {}
  const month = eurReleaseMonth(release, policy), at = release.releaseAt
  return Object.fromEntries(policy.signals.map(signal => {
    const rows = release.events.filter(e => e.event_id === signal.seriesId), row = rows[0]
    const actual = rows.length === 1 ? eurNative(row, signal) : null
    const published = at === null ? null : new Date(at).getUTCFullYear() * 12 + new Date(at).getUTCMonth()
    const ownPeriod = row ? referenceMonth(row) : null
    const validPeriod = month !== null && published !== null && ownPeriod === month && month <= published &&
      (signal.cadence === 1 ? published - month <= 2 : month % 3 === 0 && published - month <= 6)
    if (!eurReleaseUsable(release, policy) || !validPeriod || actual === null) return [signal.id,
      unavailableSignal('Requires one observed native reading with a consistent, recent reference period and verified publication time.')]
    const count = signal.mode === 'change' ? 1 : 3
    const prior = Array.from({ length: count }, (_, i) => eurEarlierValue(history, signal, month! - signal.cadence * (i + 1), at!))
    if (prior.some(v => v === null)) return [signal.id, unavailableSignal(`Requires ${count} consecutive earlier distinct reference periods; missing periods cannot be filled from Previous.`)]
    const values = prior as number[], mean = (a: number[]) => a.reduce((sum, n) => sum + n, 0) / a.length
    const baseline = signal.mode === 'change' ? values[0] : signal.mode === 'pmi' ? Math.max(50, mean(values)) : mean(values)
    const reading = signal.mode === 'trend' ? mean([actual, ...values.slice(0, 2)]) : actual
    const delta = signal.mode === 'pmi' && actual < 50 ? actual - 50 : (reading - baseline) * (signal.inverse ? -1 : 1)
    if (!Number.isFinite(delta)) return [signal.id, unavailableSignal('Derived comparison is not finite.')]
    return [signal.id, usableSignal(delta, { actual: reading, baseline: signal.mode === 'pmi' && actual < 50 ? 50 : baseline,
      actualLabel: signal.mode === 'trend' ? 'Latest three-period mean' : 'Actual',
      baselineLabel: signal.mode === 'pmi' && actual < 50 ? 'No-change level' : signal.mode === 'change' ?
        'Prior distinct reference period' : 'Prior three-period mean', unit: signal.unit })]
  }))
}
