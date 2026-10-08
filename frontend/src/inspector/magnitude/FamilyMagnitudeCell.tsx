import type { EconomicCalendarEvent } from '../calendar-event'
import { useDisplayClock } from '../../appearance/time-display/useDisplayClock'
import { formatInspectorValue } from '../inspector-data'
import type { ReadingGrade } from '../grading/reading-grading'
import { MagnitudeHistogram } from './MagnitudeHistogram'
import type { FamilyMagnitudeHistory } from './useFamilyMagnitudeHistory'
import { magnitudeSizeForValue } from './magnitude-distribution'

export function FamilyMagnitudeCell({ event, history, grade, showHistogram = true, secondaryComparison, deltaScale = 1 }: {
  event: EconomicCalendarEvent; history: FamilyMagnitudeHistory; grade: ReadingGrade; showHistogram?: boolean; deltaScale?: number
  secondaryComparison?: { label: string; delta: number | null; grade: ReadingGrade } | null
}) {
  const clock = useDisplayClock()
  const row = history.rows[event.value_id]
  const cellClass = `inspector-magnitude-cell${showHistogram ? '' : ' inspector-magnitude-only'}`
  if (row?.mode === 'undefined') return <td className={cellClass} aria-label="Magnitude undefined" />
  const formatValue = (value: number) => formatInspectorValue(value / deltaScale, event, true, 2)
  const date = (at: number | null) => at === null ? '—' : clock.date(at)
  const context = `Dataset includes all usable released readings since January 1, 2015, including this release and newer releases through now. ` +
    'Stored values can include later corrections. Position shows signed A−P; color describes Higher/Lower versus Previous, independently of the signed USD score.'
  const historyDetails = [{ label: 'Earlier / All', value: `${row?.earlierCount ?? 0} / ${row?.count ?? 0}` },
    { label: `Observed dates (${clock.zone})`, value: `${date(row?.first ?? null)}–${date(row?.last ?? null)}` },
    ...(row?.excluded ? [{ label: 'Excluded publications', value: String(row.excluded) }] : []),
    ...(history.partial ? [{ label: 'Coverage', value: `Partial ${event.currency} history` }] : [])]
  return <td className={cellClass}>
    {history.message ? <span className="inspector-magnitude-status" title={history.error ?? history.message}>{history.message}</span> :
      row?.distribution ? showHistogram ? <MagnitudeHistogram distribution={row.distribution} formatValue={formatValue} label={event.name} context={context}
        historyDetails={historyDetails} earlierCount={row.earlierCount} tone={grade} /> :
        <strong className={`magnitude-size inspector-grade-${grade}`} aria-label={`${event.name} magnitude: ${row.distribution.currentSize}`}>
          {row.distribution.currentSize}</strong> :
        <span className="inspector-magnitude-status" title={context}>No usable dataset readings</span>}
    {!history.message && row?.distribution && secondaryComparison &&
      <div className={`inspector-secondary-reading inspector-grade-${secondaryComparison.grade}`}
        title="Uses the same frozen series boundaries. Histogram and dataset counts use supplied Previous only.">
        {secondaryComparison.label}: {magnitudeSizeForValue(row.distribution.limits, secondaryComparison.delta === null ? null : secondaryComparison.delta * deltaScale)}</div>}
    {!history.message && row?.distribution && history.partial && <small>Partial history</small>}
  </td>
}
