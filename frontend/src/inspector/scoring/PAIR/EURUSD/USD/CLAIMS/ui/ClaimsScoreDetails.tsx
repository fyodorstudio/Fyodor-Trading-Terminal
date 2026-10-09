import type { ClaimsStandaloneAssessment } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/CLAIMS/assessment/claims-standalone-score'
import { formatScore as format } from '../../../../../shared/ui/format-score'
import { useDisplayClock } from '../../../../../../../appearance/time-display/useDisplayClock'
import type { ReactNode } from 'react'

const counts = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 })

type Observation = ClaimsStandaloneAssessment['readings'][number]['observations'][number]

export function ClaimsScoreDetails({ assessment, result }: { assessment: ClaimsStandaloneAssessment | null; result?: ReactNode }) {
  const clock = useDisplayClock()
  const comparison = (value: number | undefined, label: string | undefined, observations: Observation[]) => <td title={label}>
    {value === undefined ? '—' : `${counts.format(value)}k`}
    {observations.map(o => <div className="inspector-claims-input" key={`${o.reference}/${o.sourceId}`}>
      <small title={o.sourceId}>{observations.length > 1 && `${o.value === null ? '—' : `${counts.format(o.value)}k`} · `}
        Week {new Date(o.reference * 1000).toISOString().slice(0, 10)} · {o.kind === 'revision' ? 'Revised' : 'Reported'}</small>
      <small>Published {clock.utc(o.publishedAt)} ({clock.zone})</small>
    </div>)}
  </td>
  return <div className="inspector-table-scroll"><table aria-label="Jobless Claims component scores" className="inspector-claims-table">
    {result && <caption className="inspector-claims-result">{result}</caption>}
    <colgroup><col style={{ width: '24%' }} /><col style={{ width: '24%' }} /><col style={{ width: '24%' }} /><col style={{ width: '12%' }} /><col style={{ width: '6%' }} /><col style={{ width: '10%' }} /></colgroup>
    <thead><tr><th>Signal</th><th>Current</th><th>Comparison</th><th>Reading</th><th>Weight</th><th>USD contribution</th></tr></thead>
    <tbody>{assessment?.readings.map(row => {
      const split = assessment.horizon === 'trend' && row.id === 'continuing-trend' ? 4 : 1
      return <tr key={row.id}>
      <td title={row.description}><strong>{row.label}</strong></td>
      {comparison(row.inputs?.actual, row.inputs?.actualLabel, row.observations.slice(0, split))}
      {comparison(row.inputs?.baseline, row.inputs?.baselineLabel, row.observations.slice(split))}
      <td title={row.reason || `${row.sampleCount} earlier usable comparisons`}>
        {row.points === null ? 'Unavailable' : row.points > 0 ? `Stronger · ${row.size}` : row.points < 0 ? `Weaker · ${row.size}` : 'Unchanged'}
      </td><td>{row.weight}%</td>
      <td className={row.contribution === null || row.contribution === 0 ? 'inspector-score-unchanged' : row.contribution > 0 ? 'inspector-score-positive' : 'inspector-score-negative'}>{format(row.contribution)}</td>
    </tr>})}</tbody>
    {!result && assessment && <tfoot><tr><td colSpan={6}>USD score {format(assessment.total)}</td></tr></tfoot>}
  </table></div>
}
