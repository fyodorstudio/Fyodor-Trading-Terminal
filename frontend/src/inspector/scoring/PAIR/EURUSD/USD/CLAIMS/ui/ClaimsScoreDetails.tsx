import type { ClaimsAssessment } from '../assessment/claims-score'

const format = (n: number | null) => n === null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: 3, signDisplay: 'exceptZero' })
export function ClaimsScoreDetails({ assessment }: { assessment: ClaimsAssessment }) {
  return <>
    {assessment.strength && <p aria-label="Jobless Claims evidence explanation">{assessment.strengthReason}</p>}
    {assessment.reduced && <p>Reduced data: {assessment.readings.filter(row => row.points !== null).length} of 3 components usable. Missing weights are not redistributed.</p>}
    <div className="inspector-table-scroll"><table aria-label="Jobless Claims component scores">
      <thead><tr><th>Signal</th><th>Reading</th><th>Weight</th><th>USD contribution</th></tr></thead>
      <tbody>{assessment.readings.map(row => <tr key={row.id}>
        <td title={row.description}>{row.label}</td>
        <td title={`${format(row.value)} k claims · ${row.sampleCount} earlier usable signals`}>
          {row.points === null ? 'Unavailable' : row.points > 0 ? `Stronger · ${row.size}` : row.points < 0 ? `Weaker · ${row.size}` : 'Unchanged'}
          {row.reason && <small>{row.reason}</small>}
        </td>
        <td>{row.weight}%</td>
        <td className={row.contribution === null || row.contribution === 0 ? 'inspector-score-unchanged' :
          row.contribution > 0 ? 'inspector-score-positive' : 'inspector-score-negative'}>{format(row.contribution)}</td>
      </tr>)}</tbody>
      <tfoot><tr><td colSpan={4}>USD score {format(assessment.total)} · Positive → EURUSD Short · Negative → EURUSD Long</td></tr>
        {assessment.tieBreak && <tr><td colSpan={4}>Tie-break: {assessment.tieBreak.label} · weak evidence</td></tr>}</tfoot>
    </table></div>
    <p>Fewer claims than the recent comparison support USD; more claims weigh on USD. This describes changing pressure relative to recent history, without a fixed healthy/unhealthy threshold. The reported four-week initial-claims average has 50% of the vote, continuing claims 30%, and the latest initial claims 20%.</p>
    <p>Each reading is compared with the mean of its four preceding consecutive reference weeks. For the smoothed component, those are four earlier reported four-week averages. A supplied Revised Previous replaces the nearest prior reading. Revisions have no separate vote. Continuing claims normally refer to one week before initial claims; each uses its own weekly history. All comparisons are in thousands of claims.</p>
    <p>Initial claims and its overlapping average share one evidence group. Continuing claims is another group, but benefit eligibility and exhaustion can affect it: it is not a direct measure of hiring or total unemployment. Evidence describes agreement within this release, not price-move strength or probability.</p>
    <p>Each component needs 24 earlier usable signals since January 2015. Exact cancellation follows table order with weak evidence. All-zero or unavailable evidence stays Uncomputed. Missing weeks are not skipped or filled from Previous.</p>
    <ul>{assessment.readings.map(row => <li key={row.id}>{row.label}: {format(row.value)} k claims · N = {row.sampleCount} ·
      {row.limits ? ` ${row.magnitudeMode === 'custom' ? 'manual override' : 'automatic'} boundaries ${row.limits.map(n => n.toLocaleString(undefined, { maximumFractionDigits: 6 })).join(' / ')} k claims` : ' boundaries unavailable'}
    </li>)}</ul>
    <p>This release-only prototype uses no forecasts, prices or other event families. Stored readings may include provider revisions. Scatter Plot → Scoring signal shows these exact components and configurable magnitudes. A positive scoring signal means fewer claims; the original Actual − Previous view retains its original direction and settings.</p>
  </>
}
