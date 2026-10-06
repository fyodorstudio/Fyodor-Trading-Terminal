import type { InspectorRelease } from '../../../../../../inspector-data'
import type { TimedReading } from '../../../../../shared/core/historical-release-signals'
import { claimsCurrentReadings } from './claims-features'
import { claimsCount, priorClaimsWeekValues } from './claims-weekly-history'

// Describe only revisions the calendar supplies. No annual-revision date list,
// common-vintage history, hiring inference or extra directional vote is invented.
export function claimsRevisionContext(release: InspectorRelease, history: readonly TimedReading[]) {
  const rows = [...claimsCurrentReadings(release).current.values()]
  return rows.flatMap(row => {
    const supplied = row.revised_previous != null || row.revised_previous_raw_scaled_1e6 != null
    if (!supplied) return []
    const revised = claimsCount(row, 'revised_previous'), stored = priorClaimsWeekValues(history, row, 1)[0]
    return revised === null || stored === null || revised === stored ? [] : [{ seriesId: row.event_id,
      label: row.name, revised, stored, delta: Math.round((revised - stored) * 1e9) / 1e9 }]
  })
}
