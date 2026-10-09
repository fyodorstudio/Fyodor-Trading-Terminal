import { cleanSignal, nativeNumber, observedReading, referenceMonth, unavailableSignal, usableSignal, hasSuppliedRevision,
  type TimedReading } from '../../../../../shared/core/historical-release-signals'
import { priorReferenceRows } from '../../../../../shared/core/reference-history-index'
import type { EconomicCalendarEvent } from '../../../../../../inspector/calendar-event'

/** Never treat a skipped reference month or a newly supplied intervening month as a revision. */
export function monthlyComparison(row: EconomicCalendarEvent | undefined, history: readonly TimedReading[], inverse = false) {
  const actual = nativeNumber(row), previous = nativeNumber(row, 'previous'), revised = nativeNumber(row, 'revised_previous')
  const reference = row && referenceMonth(row)
  if (!row || actual === null || reference == null || row.release_at === null)
    return unavailableSignal('Actual and a verified reference month are required.')
  if (hasSuppliedRevision(row) && revised === null) return unavailableSignal('The supplied revision is invalid; a stale Previous is not substituted.')
  const baseline = hasSuppliedRevision(row) ? revised : previous
  if (baseline === null) return unavailableSignal('A usable supplied Previous or Revised Previous is required.')
  const prior = priorReferenceRows(history, row.event_id, reference - 1, row.release_at)
  if (prior.length !== 1 || !observedReading(prior[0]) || prior[0].unit !== row.unit || prior[0].multiplier !== row.multiplier || nativeNumber(prior[0]) === null)
    return unavailableSignal('No unique observed preceding reference month. A supplied prior after a gap cannot establish a comparable monthly change.')
  return usableSignal(cleanSignal((actual - baseline) * (inverse ? -1 : 1)), {
    actual, baseline, actualLabel: 'Actual', baselineLabel: revised === null ? 'Supplied Previous · preceding reference month' : 'Revised Previous · preceding reference month',
    unit: row.unit === 3 ? 'hours' : '%',
  })
}
