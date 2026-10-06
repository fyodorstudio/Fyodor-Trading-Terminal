import type { InspectorRelease } from '../../../../../../inspector-data'
import { observedReading, usableSignal, unavailableSignal, type TimedReading, type HistoricalFeature } from '../../../../../shared/core/historical-release-signals'
import { claimsSignals, type ClaimsSignalId } from '../policy/claims-policy'
import { claimsCount, claimsReference, claimsWeekSeconds, priorClaimsWeeks, validClaimsReference } from './claims-weekly-history'

export const supportsClaimsScore = (release: InspectorRelease | null) =>
  !!release && release.familyId === 'claims' && release.country === 'US' && release.currency === 'USD'

export function claimsCurrentReadings(release: InspectorRelease) {
  const current = new Map<string, TimedReading>(), reasons = new Map<string, string>()
  for (const signal of claimsSignals) {
    const rows = release.events.filter(e => e.event_id === signal.seriesId), row = rows[0]
    const reason = release.timingUncertain || release.releaseAt === null || !Number.isFinite(release.releaseAt) ?
      'A verified publication time is required.' : rows.length !== 1 ? 'Requires exactly one reading for this series.' :
        !observedReading(row) || row.release_at !== release.releaseAt ? 'Requires an observed US reading at this publication time.' :
          claimsCount(row) === null ? 'Requires nonnegative claims in the expected native count unit.' :
            !validClaimsReference(row) ? 'Requires a recent weekly reference date before publication.' : ''
    if (reason) reasons.set(signal.seriesId, reason)
    else current.set(signal.seriesId, row as TimedReading)
  }
  const initial = current.get('840140001'), average = current.get('840140003'), continuing = current.get('840140002')
  if (initial && average && claimsReference(initial) !== claimsReference(average)) {
    for (const id of ['840140001', '840140003']) {
      current.delete(id); reasons.set(id, 'Initial claims and its reported average must share the same reference week.')
    }
  }
  const anchor = current.get('840140001') ?? current.get('840140003')
  if (anchor && continuing && claimsReference(continuing)! !== claimsReference(anchor)! - claimsWeekSeconds) {
    current.delete('840140002'); reasons.set('840140002', 'Continuing claims must refer to one week before initial claims.')
  }
  return { current, reasons }
}

export function claimsFeatures(release: InspectorRelease, history: readonly TimedReading[]): Record<ClaimsSignalId, HistoricalFeature> {
  const { current, reasons } = claimsCurrentReadings(release)
  const mean = (values: number[]) => values.reduce((sum, n) => sum + n, 0) / values.length
  return Object.fromEntries(claimsSignals.map(signal => {
    const row = current.get(signal.seriesId)
    let feature: HistoricalFeature
    if (!row) feature = unavailableSignal(reasons.get(signal.seriesId)!)
    else {
      const preceding = priorClaimsWeeks(history, row, signal.id === 'continuing-pressure' ? 7 : 4)
      const supplied = signal.id !== 'initial-trend' && (row.revised_previous != null || row.revised_previous_raw_scaled_1e6 != null)
      const revised = supplied ? claimsCount(row, 'revised_previous') : null
      if (!preceding) feature = unavailableSignal(`Requires ${signal.id === 'continuing-pressure' ? 'seven' : 'four'} consecutive preceding reference weeks; gaps cannot be filled from Previous.`)
      else if (supplied && revised === null) feature = unavailableSignal('Supplied Revised Previous must be a nonnegative native claims reading.')
      else {
        const comparison = supplied ? [revised!, ...preceding.slice(1)] : preceding
        const baseline = signal.id === 'initial-trend' ? preceding[3] : signal.id === 'continuing-pressure' ? mean(comparison.slice(3, 7)) : mean(comparison)
        const actual = signal.id === 'continuing-pressure' ? mean([claimsCount(row)!, ...comparison.slice(0, 3)]) : claimsCount(row)!
        feature = usableSignal(baseline - actual, { actual, baseline,
          actualLabel: signal.id === 'continuing-pressure' ? `Latest four-week mean${supplied ? ' (nearest revised)' : ''}` : `Actual ${signal.label}`,
          baselineLabel: signal.id === 'initial-trend' ? 'Reported four-week average four weeks earlier' :
            signal.id === 'continuing-pressure' ? 'Previous four-week mean' : `Preceding four weekly readings${supplied ? ' (nearest revised)' : ''}`,
          unit: 'k claims' })
      }
    }
    return [signal.id, feature]
  })) as Record<ClaimsSignalId, HistoricalFeature>
}
