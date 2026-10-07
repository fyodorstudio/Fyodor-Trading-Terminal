import { SignalCalibration } from '../../../../../shared/ui/SignalCalibration'
import { ScoringSection, ScoringNotes } from '../../../../../shared/ui/ScoringSection'
import type { ClaimsAssessment } from '../assessment/claims-score'

const format = (n: number | null) => n === null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: 3, signDisplay: 'exceptZero' })
export function ClaimsScoreDetails({ assessment }: { assessment: ClaimsAssessment }) {
  return <>
    {assessment.strength && <p aria-label="Jobless Claims evidence explanation">{assessment.strengthReason}</p>}
    {assessment.reduced && <p>Reduced data: {assessment.readings.filter(row => row.points !== null).length} of 3 components usable. Missing weights are not redistributed.</p>}
    <ScoringSection title="What drove the result"><div className="inspector-table-scroll"><table aria-label="Jobless Claims component scores">
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
    </table></div></ScoringSection>
    <ScoringSection title="How this scorer works"><ScoringNotes items={[
        { label: 'Voting rules', content: <>Underlying initial-claims trend has 45% of the vote, continuing-claims trend 40%, and the latest initial claims 15%. Easing claims pressure supports USD under this release-only rule; increasing pressure weighs on USD. A weekly move without either underlying trend changing carries weak evidence.</> },
        { label: 'Trend comparisons', content: <>The reported four-week initial-claims average is compared with the reported average four weeks earlier. Continuing claims compares the latest four-week mean with the preceding four-week mean. These trend windows do not overlap. The latest initial reading is compared with its preceding four weekly readings.</> },
        { label: 'Revision handling', content: <>For continuing claims and the latest initial reading, a supplied Revised Previous replaces the nearest earlier week. It does not replace the older four-week average used by the initial trend. Revisions have no separate vote. Continuing claims normally refer to one week before initial claims; each uses its own weekly history. All comparisons are in thousands of claims.</> }
      ]} /></ScoringSection>
    {!!assessment.revisions.length && <ScoringSection title="Revision notice"><p aria-label="Claims revision consistency">The supplied prior differs from the stored earlier publication: {assessment.revisions.map(r => `${r.label} ${format(r.delta)}k`).join('; ')}. Only the nearest revised week is available. Older comparison weeks retain their stored readings; the dataset cannot establish a complete common-vintage history. This notice adds no vote.</p></ScoringSection>}
    <ScoringSection title="Level context · no additional vote">
    <ul aria-label="Jobless Claims level context">{assessment.levels.map(level => <li key={level.id}>
      {level.label}: {level.state === 'elevated' ? 'Elevated relative to its own preceding year' : level.state === 'low' ?
        'Low relative to its own preceding year' : level.state === 'typical' ? 'Within its usual recent range' : 'Unavailable'}. {level.explanation}
    </li>)}</ul>
    <p>The usual range is the middle half of usable readings within the preceding 52 weeks, with at least 40 required. Partial history is disclosed; missing weeks are not filled or replaced with older readings. This separates improving pressure from already low levels; it does not define a universal healthy labor market or add another score.</p>
    </ScoringSection>
    <ScoringSection title="Evidence & coverage"><ScoringNotes items={[
        { label: 'Evidence groups', content: <>Initial claims and its overlapping average share one evidence group. Continuing claims is another group, but benefit eligibility and exhaustion can affect it: it is not a direct measure of hiring or total unemployment. Evidence describes agreement within this release, not price-move strength or probability.</> },
        { label: 'History & missing data', content: <>Each component needs 24 earlier usable signals since January 2015. Exact cancellation follows table order with weak evidence. All-zero or unavailable evidence stays Uncomputed. Missing weeks are not skipped or filled from Previous.</> }
      ]} /></ScoringSection>
    <SignalCalibration readings={assessment.readings} unit="k claims" label="Jobless Claims signal calibration" />
    <ScoringSection title="Scope & tools"><p>This release-only prototype uses no forecasts, prices or other event families. Stored readings may include provider revisions. Scatter Plot → Scoring signal shows these exact components and configurable magnitudes. A positive scoring signal means fewer claims; the original Actual − Previous view retains its original direction and settings.</p></ScoringSection>
  </>
}
