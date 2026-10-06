import { useMemo } from 'react'
import type { EconomicCalendarEvent } from '../../../../../../calendar-event'
import type { InspectorRelease } from '../../../../../../inspector-data'
import { useStoredCalendar } from '../../../../../../useStoredCalendar'
import { assessCpiScoreV3, cpiV3HistoryStart, cpiV3SeriesIds } from '../assessment/cpi-score-v3'
import { cpiSignalSettings } from '../../../../../shared/core/signal-magnitude-settings'

import { CpiScoreDetails } from './CpiScoreDetails'
const scope = { currency: 'USD' as const, eventIds: cpiV3SeriesIds }

export function CpiScoreV3({ release, brokerId, events }: {
  release: InspectorRelease; brokerId?: string | null; events: EconomicCalendarEvent[]
}) {
  const at = release.releaseAt
  const range = useMemo(() => at === null ? null : ({ from: cpiV3HistoryStart - 2 * 86400000, to: at + 2 * 86400000 }), [at])
  const storage = useStoredCalendar(brokerId, range, !!range, scope)
  const history = brokerId ? storage.events : events
  const settings = cpiSignalSettings.useSettings()
  const assessment = useMemo(() => assessCpiScoreV3(release, history, settings), [release, history, settings])
  if (!assessment) return null
  const loading = storage.loading
  const direction = loading ? 'uncomputed' : assessment.direction
  const coverageMissing = Object.values(storage.coverage).some((coverage) => coverage.missing.length > 0)
  return <div className="inspector-detail-overview inspector-scoring-view inspector-cpi-v3" aria-label="CPI scoring system v3">
    <div className="inspector-cpi-v3-summary">
      <strong className={`inspector-majority inspector-direction-${direction}`} aria-label="CPI v3 pair direction">
        {loading ? 'Uncomputed' : assessment.label}
      </strong>
      {!loading && assessment.strength && <span aria-label="CPI v3 evidence strength">{assessment.strength} evidence</span>}
      {!loading && assessment.direction !== 'uncomputed' && assessment.changeSize && <span aria-label="CPI v3 change size">{assessment.changeSize}</span>}
      <span>{loading ? 'Loading earlier CPI releases…' : assessment.explanation}</span>
      <small>Scoring system v3 · Experimental</small>
    </div>
    {storage.error && <p role="alert">CPI history: {storage.error}</p>}
    {!loading && assessment.strength && <p aria-label="CPI v3 evidence explanation">{assessment.strengthReason}</p>}
    {!loading && assessment.reduced && <p>Reduced data: {assessment.readings.filter((r) => r.points !== null).length} of 4 components usable. Missing components do not vote.</p>}
    <CpiScoreDetails assessment={assessment} loading={loading} coverageMissing={coverageMissing} />
  </div>
}
