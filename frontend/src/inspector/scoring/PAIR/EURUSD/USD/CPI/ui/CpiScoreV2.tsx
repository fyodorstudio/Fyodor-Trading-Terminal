import { useMemo } from 'react'
import type { EconomicCalendarEvent } from '../../../../../../calendar-event'
import type { InspectorRelease } from '../../../../../../inspector-data'
import { useStoredCalendar } from '../../../../../../useStoredCalendar'
import { assessCpiScoreV2, cpiV2HistoryStart, cpiV2SeriesIds } from '../assessment/cpi-score-v2'

const format = (value: number | null) => value === null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 3, signDisplay: 'exceptZero' })
const scope = { currency: 'USD' as const, eventIds: cpiV2SeriesIds }

export function CpiScoreV2({ release, brokerId, events }: {
  release: InspectorRelease; brokerId?: string | null; events: EconomicCalendarEvent[]
}) {
  const at = release.releaseAt
  // The storage endpoint uses chart time. Two days of padding cover broker
  // offsets; assessment still admits only publications strictly before `at`.
  const range = useMemo(() => at === null ? null : ({ from: cpiV2HistoryStart - 2 * 86400000, to: at + 2 * 86400000 }), [at])
  const storage = useStoredCalendar(brokerId, range, !!range, scope)
  const history = brokerId ? storage.events : events
  const assessment = useMemo(() => assessCpiScoreV2(release, history), [release, history])
  if (!assessment) return null
  const loading = storage.loading
  const direction = loading ? 'uncomputed' : assessment.direction
  const coverageMissing = Object.values(storage.coverage).some((coverage) => coverage.missing.length > 0)
  return <div className="inspector-detail-overview inspector-scoring-view inspector-cpi-v2" aria-label="CPI scoring system v2">
    <div className="inspector-cpi-v2-summary">
      <strong className={`inspector-majority inspector-direction-${direction}`} aria-label="CPI v2 pair direction">
        {loading ? 'Uncomputed' : assessment.label}
      </strong>
      <span>{loading ? 'Loading earlier CPI releases…' : assessment.explanation}</span>
      <small>Scoring system v2 · Experimental</small>
    </div>
    {storage.error && <p role="alert">CPI history: {storage.error}</p>}
    <div className="inspector-cpi-v2-details">
      <div className="inspector-table-scroll"><table aria-label="CPI v2 component scores">
        <thead><tr><th>Signal</th><th>Magnitude</th><th>Weight</th><th>USD contribution</th></tr></thead>
        <tbody>{assessment.readings.map((row) => <tr key={row.id}>
          <td title={row.description}>{row.label}</td>
          <td title={row.reason || `${format(row.value)} pp · ${row.sampleCount} earlier usable signals`}>
            {loading ? 'Loading' : row.size ?? 'Unavailable'}
          </td>
          <td>{row.weight}%</td>
          <td className={row.contribution === null || row.contribution === 0 ? 'inspector-score-unchanged' :
            row.contribution > 0 ? 'inspector-score-positive' : 'inspector-score-negative'}>{loading ? '—' : format(row.contribution)}</td>
        </tr>)}</tbody>
        <tfoot><tr><td colSpan={4}>USD score {loading ? '—' : format(assessment.total)} · Positive → EURUSD Short · Negative → EURUSD Long</td></tr>
          {!loading && assessment.tieBreak && <tr><td colSpan={4}>Tie-break: {assessment.tieBreak.label}</td></tr>}</tfoot>
      </table></div>
      <p>Core pressure uses a 0.20% monthly reference. Core trend compares overlapping three-month averages. Annual core confirms the change; headline has a smaller vote.</p>
      <p>Each signal contributes signed magnitude points (0–4), multiplied by its weight. V2 uses its own earlier history since January 2015, with at least 24 usable signals per component; your Scatter Plot boundaries still apply to the original scorer.</p>
      <p>Small / Medium / Large boundaries are the 33⅓ / 66⅔ / 90 percentiles of earlier nonzero absolute signals. Tied boundaries may leave a bucket empty. Exact cancellation follows core pressure, core trend, annual core, then headline.</p>
      <ul>{assessment.readings.map((row) => <li key={row.id}>{row.label}: {format(row.value)} pp · N = {row.sampleCount} ·
        {row.limits ? ` boundaries ${row.limits.map((n) => n.toLocaleString(undefined, { maximumFractionDigits: 6 })).join(' / ')} pp` : ' boundaries unavailable'}
        {row.reason && ` · ${row.reason}`}</li>)}</ul>
      <p>This is a CPI-only bias using stored readings, without forecasts. Historical values may include revisions retained by the provider. It does not combine NFP or predict the duration of a price move.</p>
      {coverageMissing && <p>Partial calendar coverage; the score uses the available earlier signals.</p>}
    </div>
  </div>
}
