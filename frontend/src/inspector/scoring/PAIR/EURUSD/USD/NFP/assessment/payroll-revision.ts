import type { EconomicCalendarEvent } from '../../../../../../calendar-event'
import { nativeNumber, observedReading, referenceMonth, unavailableSignal, usableSignal,
  type TimedReading } from '../../../../../shared/core/historical-release-signals'
import { priorReferenceRows } from '../../../../../shared/core/reference-history-index'

// A broker's revised_previous field can contain a newly published intervening
// month after a skipped report. Never subtract different months as a revision.
export function payrollRevisionFeature(payroll: EconomicCalendarEvent | undefined, history: readonly TimedReading[]) {
  const revised = nativeNumber(payroll, 'revised_previous'), previous = nativeNumber(payroll, 'previous')
  if (!payroll || revised === null || previous === null) {
    return unavailableSignal('Supplied prior and Previous payrolls are required.')
  }
  const month = referenceMonth(payroll)
  if (month === null || payroll.release_at === null) return unavailableSignal('A verified payroll reference month and publication time are required.')
  const rows = priorReferenceRows(history, payroll.event_id, month - 1, payroll.release_at)
  const prior = rows[0]
  if (rows.length !== 1 || !observedReading(prior) || prior.unit !== payroll.unit ||
    prior.multiplier !== payroll.multiplier || nativeNumber(prior) === null) {
    return unavailableSignal('No unique earlier publication for the preceding reference month. The provider prior may be a new intervening month, so it cannot be scored as a revision.')
  }
  return usableSignal(revised - previous, { actual: revised, baseline: previous,
    actualLabel: 'Provider prior', baselineLabel: 'Supplied Previous', unit: 'thousand jobs' })
}
