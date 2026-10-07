import { SignalCalibration } from '../../../../../shared/ui/SignalCalibration'
import { ScoringSection, ScoringNotes } from '../../../../../shared/ui/ScoringSection'
import type { RetailAssessment } from '../assessment/retail-score'

const format = (n: number | null) => n === null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: 3, signDisplay: 'exceptZero' })
export function RetailScoreDetails({ assessment }: { assessment: RetailAssessment }) {
  return <>
    {assessment.strength && <p aria-label="Retail Sales evidence explanation">{assessment.strengthReason}</p>}
    {assessment.reduced && <p>Reduced data: {assessment.readings.filter(row => row.points !== null).length} of 3 components usable. Missing weights are not redistributed.</p>}
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
    <ScoringSection title="Supporting context · no additional vote"><ul aria-label="Retail Sales spending context">{assessment.supporting.map(row => <li key={row.id}>{row.label}: {row.text}</li>)}</ul></ScoringSection>
    <ScoringSection title="How this scorer works"><ScoringNotes items={[
        { label: 'Voting rules & revisions', content: <>Control-group pace has 60% of the vote, sales excluding autos and gas 25%, headline pace 15%. Each compares the latest monthly growth reading with the preceding three-month average. A supplied Revised Previous replaces the nearest month in that average. The comparison average is floored at zero so smaller sales losses still count as falling sales. Revisions affect the comparison, without a separate revision vote.</> },
        { label: 'Evidence groups', content: <>Control-group pace is one evidence group. Ex-autos-and-gas and headline share a breadth group. These sales aggregates overlap: evidence describes agreement, not independent confirmation or price probabilities. Core retail (ex autos) and annual headline sales provide context without extra votes.</> },
        { label: 'History & tie-break', content: <>Each component needs 24 earlier usable signals since January 2015. At least one calibrated control-group or ex-autos-and-gas component is required. Exact cancellation follows table order with weak evidence. All-zero or unavailable evidence stays Uncomputed.</> }
      ]} /></ScoringSection>
    <SignalCalibration readings={assessment.readings} unit="pp" label="Retail Sales signal calibration" />
    <ScoringSection title="Coverage & limits"><p>Retail sales measure nominal spending, not inflation-adjusted purchasing volume or all consumer services. This release-only prototype uses no forecasts, CPI, Fed decisions or price inputs. Stored readings may contain provider revisions. Scatter Plot → Scoring signal shows these exact components and configurable magnitudes; original Actual − Previous settings remain separate.</p></ScoringSection>
  </>
}
