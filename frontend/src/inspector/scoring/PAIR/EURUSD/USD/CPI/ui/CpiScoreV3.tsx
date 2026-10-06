import { useMemo } from 'react'
import type { EconomicCalendarEvent } from '../../../../../../calendar-event'
import type { InspectorRelease } from '../../../../../../inspector-data'
import { useStoredCalendar } from '../../../../../../useStoredCalendar'
import { assessCpiScoreV3, cpiV3HistoryStart, cpiV3SeriesIds } from '../assessment/cpi-score-v3'

const format = (value: number | null) => value === null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 3, signDisplay: 'exceptZero' })
const scope = { currency: 'USD' as const, eventIds: cpiV3SeriesIds }

export function CpiScoreV3({ release, brokerId, events }: {
  release: InspectorRelease; brokerId?: string | null; events: EconomicCalendarEvent[]
}) {
  const at = release.releaseAt
  const range = useMemo(() => at === null ? null : ({ from: cpiV3HistoryStart - 2 * 86400000, to: at + 2 * 86400000 }), [at])
  const storage = useStoredCalendar(brokerId, range, !!range, scope)
  const history = brokerId ? storage.events : events
  const assessment = useMemo(() => assessCpiScoreV3(release, history), [release, history])
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
    <div className="inspector-cpi-v3-details">
      <div className="inspector-table-scroll"><table aria-label="CPI v3 component scores">
        <thead><tr><th>Signal</th><th>Reading</th><th>Weight</th><th>USD contribution</th></tr></thead>
        <tbody>{assessment.readings.map((row) => <tr key={row.id}>
          <td title={row.description}>{row.label}</td>
          <td title={`${format(row.value)} pp · ${row.sampleCount} earlier usable signals`}>
            {loading ? 'Loading' : row.points === null ? 'Unavailable' : row.points > 0 ? `Heating · ${row.size}` : row.points < 0 ? `Cooling · ${row.size}` : 'Unchanged'}
            {!loading && row.reason && <small>{row.reason}</small>}
          </td>
          <td>{row.weight}%</td>
          <td className={row.contribution === null || row.contribution === 0 ? 'inspector-score-unchanged' :
            row.contribution > 0 ? 'inspector-score-positive' : 'inspector-score-negative'}>{loading ? '—' : format(row.contribution)}</td>
        </tr>)}</tbody>
        <tfoot><tr><td colSpan={4}>USD score {loading ? '—' : format(assessment.total)} · Positive → EURUSD Short · Negative → EURUSD Long</td></tr>
          {!loading && assessment.tieBreak && <tr><td colSpan={4}>Tie-break: {assessment.tieBreak.label} · weak evidence</td></tr>}</tfoot>
      </table></div>
      <p>The latest core pace gets the first vote: is it hotter or cooler than the preceding three months? The rolling core trend and annual core change support it. Headline has a smaller vote. Inflation levels do not automatically add a directional vote.</p>
      <p>Conflicting readings still produce one weighted bias. Evidence strength describes agreement; the overlapping core monthly signals count as one group when assessing confirmation. Change size describes the average historical magnitude of usable signals, separately from agreement. Neither describes a probability or size of a price move.</p>
      <p>Magnitude points (0–4) use each component’s earlier history since January 2015, with at least 24 usable observations. Weights remain 35 / 35 / 20 / 10. Exact cancellation follows latest core pace, core trend, annual core, then headline. The two core monthly signals overlap and are related.</p>
      <ul>{assessment.readings.map((row) => <li key={row.id}>{row.label}: {format(row.value)} pp · N = {row.sampleCount} ·
        {row.limits ? ` boundaries ${row.limits.map((n) => n.toLocaleString(undefined, { maximumFractionDigits: 6 })).join(' / ')} pp` : ' boundaries unavailable'}
      </li>)}</ul>
      <p>This bias interprets CPI alone, without forecasts or price inputs. It does not predict the release candle or later price moves. Stored historical readings may include provider revisions. Your original Scatter Plot boundaries remain separate.</p>
      {coverageMissing && <p>Partial calendar coverage; earlier calibration uses the available observations.</p>}
    </div>
  </div>
}
