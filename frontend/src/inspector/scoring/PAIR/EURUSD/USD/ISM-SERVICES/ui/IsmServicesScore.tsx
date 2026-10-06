import { useMemo } from 'react'
import type { InspectorScoringProps } from '../../../../../scoring-contracts'
import { useStoredCalendar } from '../../../../../../useStoredCalendar'
import { signalHistoryStart } from '../../../../../shared/core/historical-release-signals'
import { ismServicesSignalSettings } from '../../../../../shared/core/signal-magnitude-settings'
import { assessIsmServicesScore, ismServicesSeriesIds } from '../assessment/ism-services-score'

const format = (value: number | null) => value === null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 3, signDisplay: 'exceptZero' })
const scope = { currency: 'USD' as const, eventIds: ismServicesSeriesIds }

export function IsmServicesScore({ release, brokerId, events = [] }: InspectorScoringProps) {
  const at = release?.releaseAt ?? null
  const range = useMemo(() => at === null ? null : ({ from: signalHistoryStart - 2 * 86400000, to: at + 2 * 86400000 }), [at])
  const storage = useStoredCalendar(brokerId, range, !!range, scope)
  const history = brokerId ? storage.events : events
  const settings = ismServicesSignalSettings.useSettings()
  const assessment = useMemo(() => assessIsmServicesScore(release, history, settings), [release, history, settings])
  if (!assessment) return null
  const loading = storage.loading
  const direction = loading ? 'uncomputed' : assessment.direction
  const coverageMissing = Object.values(storage.coverage).some((coverage) => coverage.missing.length > 0)
  return <div className="inspector-detail-overview inspector-scoring-view inspector-ism-services-v1" aria-label="ISM Services scoring system">
    <div className="inspector-ism-services-v1-summary">
      <strong className={`inspector-majority inspector-direction-${direction}`} aria-label="ISM Services pair direction">{loading ? 'Uncomputed' : assessment.label}</strong>
      {!loading && assessment.strength && <span aria-label="ISM Services evidence strength">{assessment.strength} evidence</span>}
      {!loading && assessment.direction !== 'uncomputed' && assessment.changeSize && <span aria-label="ISM Services change size">{assessment.changeSize}</span>}
      <span>{loading ? 'Loading earlier ISM Services releases…' : assessment.explanation}</span>
      <small>Scoring system v1 · Experimental</small>
    </div>
    {storage.error && <p role="alert">ISM Services history: {storage.error}</p>}
    {!loading && assessment.strength && <p aria-label="ISM Services evidence explanation">{assessment.strengthReason}</p>}
    {!loading && assessment.reduced && <p>Reduced data: {assessment.readings.filter((row) => row.points !== null).length} of 4 components usable. Missing components do not vote.</p>}
    <div className="inspector-table-scroll"><table aria-label="ISM Services component scores">
      <thead><tr><th>Signal</th><th>Reading</th><th>Weight</th><th>USD contribution</th></tr></thead>
      <tbody>{assessment.readings.map((row) => <tr key={row.id}>
        <td title={row.description}>{row.label}</td>
        <td title={`${format(row.value)} index points · ${row.sampleCount} earlier usable signals`}>
          {loading ? 'Loading' : row.points === null ? 'Unavailable' : `${row.points > 0 ? 'Above comparison pace' : row.points < 0 ? 'Below comparison pace' : 'At comparison pace'} · ${row.size}`}
          {!loading && <small>{row.state}</small>}
          {!loading && row.reason && <small>{row.reason}</small>}
        </td>
        <td>{row.weight}%</td>
        <td className={row.contribution === null || row.contribution === 0 ? 'inspector-score-unchanged' :
          row.contribution > 0 ? 'inspector-score-positive' : 'inspector-score-negative'}>{loading ? '—' : format(row.contribution)}</td>
      </tr>)}</tbody>
      <tfoot><tr><td colSpan={4}>USD score {loading ? '—' : format(assessment.total)} · Positive → EURUSD Short · Negative → EURUSD Long</td></tr>
        {!loading && assessment.tieBreak && <tr><td colSpan={4}>Tie-break: {assessment.tieBreak.label} · weak evidence</td></tr>}</tfoot>
    </table></div>
    {!loading && <p aria-label="ISM Services headline context">{assessment.headlineContext}</p>}
    <p>New orders has 35% of the vote, business activity 25%, employment 25%, and prices paid 15%. Each compares its latest index with the higher of 50 and its preceding three-month average, including the release’s revised preceding month when supplied. A rebound that stays below 50 still indicates a decrease. A reading above 50 can indicate continued growth while cooling from its recent pace.</p>
    <p>The headline PMI combines business activity, new orders, employment and supplier deliveries. It is context only, to avoid counting constituents twice. Supplier deliveries is unavailable in this family and is not inferred from the composite. Prices paid describes surveyed input-price pressure, not a CPI inflation rate; it receives a smaller policy-pressure vote.</p>
    <p>Orders and activity share one demand evidence group; employment and prices each have their own group. Strength describes agreement across available groups, not independent confirmations, price probabilities or the size of a price move.</p>
    <p>Each component uses its own earlier history since January 2015, with at least 24 usable signals. Missing weights are not redistributed. Exact cancellation follows the table order. At least one usable demand component is required; absent directional evidence remains Uncomputed.</p>
    <ul>{assessment.readings.map((row) => <li key={row.id}>{row.label}: {format(row.value)} index points · N = {row.sampleCount} ·
      {row.limits ? ` ${row.magnitudeMode === 'custom' ? 'manual override' : 'automatic'} boundaries ${row.limits.map((value) => value.toLocaleString(undefined, { maximumFractionDigits: 6 })).join(' / ')} index points` : ' boundaries unavailable'}
    </li>)}</ul>
    <p>This interprets ISM Services alone without forecasts, other releases or price inputs. Weights and the comparison floor are prototype interpretation rules. Stored readings may include provider revisions. Scatter Plot → Scoring signal shows these components and their configurable magnitude boundaries. Original A−P settings remain separate.</p>
    {coverageMissing && <p>Partial calendar coverage; earlier calibration uses the available observations.</p>}
  </div>
}
