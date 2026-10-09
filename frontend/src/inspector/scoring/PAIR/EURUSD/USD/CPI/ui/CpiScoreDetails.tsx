import { memo } from 'react'
import { ScoringSection } from '../../../../../shared/ui/ScoringSection'
import type { assessCpiScoreV3 } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/CPI/assessment/cpi-score-v3'

import { formatScore as format } from '../../../../../shared/ui/format-score'
export type CpiAssessment = NonNullable<ReturnType<typeof assessCpiScoreV3>>
function CpiScoreDetailsComponent({ assessment, loading = false, coverageMissing = false, label = 'CPI v4 standalone' }: {
  assessment: CpiAssessment; loading?: boolean; coverageMissing?: boolean; label?: string
}) {
  return (
    <div className="inspector-cpi-release-details">
      <ScoringSection title="What drove the result"><div className="inspector-table-scroll"><table aria-label={`${label} component scores`}>
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
      </table></div></ScoringSection>


      {coverageMissing && <p>Partial calendar history; calibration uses the available observations.</p>}
    </div>
  )
}

export const CpiScoreDetails = memo(CpiScoreDetailsComponent)
