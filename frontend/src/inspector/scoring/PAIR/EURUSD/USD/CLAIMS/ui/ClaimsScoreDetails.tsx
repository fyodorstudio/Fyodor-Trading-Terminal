import type { ClaimsStandaloneAssessment } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/CLAIMS/assessment/claims-standalone-score'
import { formatScore as format } from '../../../../../shared/ui/format-score'
import { useDisplayClock } from '../../../../../../../appearance/time-display/useDisplayClock'

const counts = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 })

export function ClaimsScoreDetails({ assessment }: { assessment: ClaimsStandaloneAssessment }) {
  const clock = useDisplayClock()
  return <><div className="inspector-table-scroll"><table aria-label="Jobless Claims component scores">
    <thead><tr><th>Signal</th><th>Current</th><th>Comparison</th><th>Reading</th><th>Weight</th><th>USD contribution</th></tr></thead>
    <tbody>{assessment.readings.map(row => <tr key={row.id}>
      <td title={row.description}>{row.label}</td>
      <td title={row.inputs?.actualLabel}>{!row.inputs ? '—' : `${counts.format(row.inputs.actual)}k`}</td>
      <td title={row.inputs?.baselineLabel}>{!row.inputs ? '—' : `${counts.format(row.inputs.baseline)}k`}</td>
      <td title={row.reason || `${row.sampleCount} earlier usable comparisons`}>
        {row.points === null ? 'Unavailable' : row.points > 0 ? `Stronger · ${row.size}` : row.points < 0 ? `Weaker · ${row.size}` : 'Unchanged'}
      </td><td>{row.weight}%</td>
      <td className={row.contribution === null || row.contribution === 0 ? 'inspector-score-unchanged' : row.contribution > 0 ? 'inspector-score-positive' : 'inspector-score-negative'}>{format(row.contribution)}</td>
    </tr>)}</tbody><tfoot><tr><td colSpan={6}>USD score {format(assessment.total)}</td></tr></tfoot>
  </table></div>
    <div className="inspector-table-scroll"><table aria-label="Claims comparison provenance">
      <thead><tr><th>Component</th><th>Reference week</th><th>Claims (k)</th><th>Reading</th><th>Published ({clock.zone})</th></tr></thead>
      <tbody>{assessment.readings.flatMap(row => row.observations.map((o, index) => <tr key={`${row.id}/${index}`}>
        <td>{row.label}</td><td>{new Date(o.reference * 1000).toISOString().slice(0, 10)}</td><td>{o.value === null ? '—' : counts.format(o.value)}</td>
        <td title={o.sourceId}>{o.kind === 'revision' ? 'Revised' : 'Reported'}</td><td>{clock.utc(o.publishedAt)}</td>
      </tr>))}</tbody>
    </table></div>
  </>
}
