import type { EconomicCalendarEvent } from '../calendar-event'
import { formatInspectorValue } from '../inspector-data'
import type { ReadingGrade } from '../grading/reading-grading'
import { MagnitudeHistogram } from './MagnitudeHistogram'
import type { FamilyMagnitudeHistory } from './useFamilyMagnitudeHistory'

export function FamilyMagnitudeCell({ event, history, grade }: {
  event: EconomicCalendarEvent; history: FamilyMagnitudeHistory; grade: ReadingGrade
}) {
  const row = history.rows[event.value_id]
  if (row?.mode === 'undefined') return <td className="inspector-magnitude-cell" aria-label="Magnitude undefined" />
  const formatValue = (value: number) => formatInspectorValue(value, event, true, 2)
  const date = (at: number | null) => at === null ? '—' : new Date(at).toISOString().slice(0, 10)
  const context = `Dataset includes all usable released readings since January 1, 2015, including this release and newer releases through now. ` +
    'Stored values can include later corrections. Position shows signed A−P; color follows the existing reading grade.'
  const historyDetails = [{ label: 'Earlier / All', value: `${row?.earlierCount ?? 0} / ${row?.count ?? 0}` },
    { label: 'Observed dates (UTC)', value: `${date(row?.first ?? null)}–${date(row?.last ?? null)}` },
    ...(row?.excluded ? [{ label: 'Excluded publications', value: String(row.excluded) }] : []),
    ...(history.partial ? [{ label: 'Coverage', value: `Partial ${event.currency} history` }] : [])]
  return <td className="inspector-magnitude-cell">
    {history.message ? <span className="inspector-magnitude-status" title={history.error ?? history.message}>{history.message}</span> :
      row?.distribution ? <MagnitudeHistogram distribution={row.distribution} formatValue={formatValue} label={event.name} context={context}
        historyDetails={historyDetails} earlierCount={row.earlierCount} tone={grade} /> :
        <span className="inspector-magnitude-status" title={context}>No usable dataset readings</span>}
    {!history.message && row?.distribution && history.partial && <small>Partial history</small>}
  </td>
}
