import { ScoringSection } from '../../../../../shared/ui/ScoringSection'
import type { RetailAssessment } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/RETAIL/assessment/retail-score'

import { formatScore as format } from '../../../../../shared/ui/format-score'
export function RetailScoreDetails({ assessment }: { assessment: RetailAssessment }) {
  return <>
    {assessment.strength && <p aria-label="Retail Sales evidence explanation">{assessment.strengthReason}</p>}
    {assessment.reduced && <p>Reduced data: {assessment.readings.filter(row => row.points !== null).length} of 3 components usable.</p>}
    <ScoringSection title="What drove the result"><div className="inspector-table-scroll"><table aria-label="Retail Sales component scores">
      <thead><tr><th>Signal</th><th>Reading</th><th>Weight</th><th>USD contribution</th></tr></thead>
      <tbody>{assessment.readings.map(row => <tr key={row.id}>
        <td title={row.description}>{row.label}</td>
        <td title={`${format(row.value)} pp · ${row.sampleCount} earlier usable signals`}>
          {row.points === null ? 'Unavailable' : row.points > 0 ? `Stronger · ${row.size}` : row.points < 0 ? `Weaker · ${row.size}` : 'Unchanged'}
          {row.reason && <small>{row.reason}</small>}
        </td>
        <td>{row.weight}%</td>
        <td className={row.contribution === null || row.contribution === 0 ? 'inspector-score-unchanged' :
          row.contribution > 0 ? 'inspector-score-positive' : 'inspector-score-negative'}>{format(row.contribution)}</td>
      </tr>)}</tbody>
      <tfoot><tr><td colSpan={4}>USD score {format(assessment.total)} · Positive → EURUSD Short · Negative → EURUSD Long</td></tr>
        {assessment.tieBreak && <tr><td colSpan={4}>Tie-break: {assessment.tieBreak.label} · weak evidence</td></tr>}</tfoot>
    </table></div></ScoringSection>
    <ScoringSection title="Supporting context" collapsible><ul aria-label="Retail Sales spending context">{assessment.supporting.map(row => <li key={row.id}>{row.label}: {row.text}</li>)}</ul></ScoringSection>


    <p>Retail sales measure nominal spending, not inflation-adjusted volume.</p>
  </>
}
