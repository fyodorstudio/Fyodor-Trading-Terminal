import type { InspectorRelease } from '../../../../../../inspector-data'
import { nativeNumber, observedReading } from '../../../../../shared/core/historical-release-signals'
export const fedSeriesIds = ['840050014', '840050002', '840050003', '840050018', '840050005', '840050006', '840050021', '840050022'] as const
export const supportsFedScore = (r: InspectorRelease | null) => !!r && ['fomc','fed-chair'].includes(r.familyId) && r.country === 'US' && r.currency === 'USD'
export function assessFedScore(release: InspectorRelease | null) {
  if (!release || !supportsFedScore(release)) return null
  const rows = release.events.filter(e => e.event_id === '840050014'), row = rows[0], at = release.releaseAt
  const valid = rows.length === 1 && at !== null && !release.timingUncertain && observedReading(row) && row.release_at === at && row.unit === 1 && row.multiplier === 0
  const actual = valid ? nativeNumber(row) : null
  const revised = !!row && (row.revised_previous != null || row.revised_previous_raw_scaled_1e6 != null)
  const previous = valid ? nativeNumber(row, revised ? 'revised_previous' : 'previous') : null
  const delta = actual !== null && previous !== null ? Math.round((actual - previous) * 100 * 1e9)/1e9 : null
  const direction = delta === null || delta === 0 ? 'uncomputed' : delta > 0 ? 'short' : 'long'
  const action = delta === null ? 'Policy content unavailable' : delta === 0 ? 'Rate hold' : delta > 0 ? 'Rate increase' : 'Rate reduction'
  return { action, actual, previous, delta, direction, label: direction === 'short' ? 'EURUSD Short' : direction === 'long' ? 'EURUSD Long' : 'Uncomputed',
    strength: direction === 'uncomputed' ? null : 'weak', explanation: delta === null ? 'The calendar records this event, but contains no usable policy decision or speech text.' :
      delta === 0 ? 'The rate is unchanged. A hold alone supplies no direction; statement changes and guidance are unavailable.' :
      `${action} supports ${delta > 0 ? 'USD strength' : 'USD weakness'} under the declared rate-action rule. Guidance could alter this interpretation.`,
    coverage: 'Statement, projections, press-conference answers and speech text are not stored by the calendar feed. No policy tone is inferred from event names.',
    version: 'fed-rate-action-v1' }
}
