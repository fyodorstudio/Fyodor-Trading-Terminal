import type { assessCpiScoreV3 } from '../assessment/cpi-score-v3'

const format = (value: number | null) => value === null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 3, signDisplay: 'exceptZero' })
export type CpiAssessment = NonNullable<ReturnType<typeof assessCpiScoreV3>>
export function CpiScoreDetails({ assessment, loading = false, coverageMissing = false, label = 'CPI v3' }: {
  assessment: CpiAssessment; loading?: boolean; coverageMissing?: boolean; label?: string
}) {
  return (
    <div className="inspector-cpi-v3-details">
      <div className="inspector-table-scroll"><table aria-label={`${label} component scores`}>
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
        {row.limits ? ` ${row.magnitudeMode === 'custom' ? 'manual override' : 'automatic'} boundaries ${row.limits.map((n) => n.toLocaleString(undefined, { maximumFractionDigits: 6 })).join(' / ')} pp` : ' boundaries unavailable'}
      </li>)}</ul>
      <p>This bias interprets CPI alone, without forecasts or price inputs. It does not predict the release candle or later price moves. Stored historical readings may include provider revisions. Scatter Plot → Scoring signal shows these inputs and lets you apply component magnitude overrides. Original A−P boundaries remain separate.</p>
      {coverageMissing && <p>Partial calendar coverage; earlier calibration uses the available observations.</p>}
    </div>
  )
}
