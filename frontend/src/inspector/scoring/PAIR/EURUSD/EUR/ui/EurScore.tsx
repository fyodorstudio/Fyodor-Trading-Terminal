import { SignalCalibration } from '../../../../shared/ui/SignalCalibration'
import { ScoringSection, ScoringNotes } from '../../../../shared/ui/ScoringSection'
import type { InspectorScoringProps } from '../../../../scoring-contracts'
import { useEurAnalysis } from '../runtime/useEurAnalysis'
const format = (n: number | null) => n === null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: 3, signDisplay: 'exceptZero' })
export function EurScore(props: InspectorScoringProps) {
  const analysis = useEurAnalysis(props), score = analysis.result
  const ready = !analysis.loading && !analysis.error && score
  return <section className="inspector-detail-overview inspector-scoring-view inspector-structured-score" aria-label="EUR release interpretation">
    <div className="inspector-release-score-summary"><strong className={`inspector-majority inspector-direction-${ready ? score.direction : 'uncomputed'}`}>{ready ? score.label : 'Uncomputed'}</strong>
      {ready && score.strength && <span>{score.strength} evidence</span>}{ready && score.changeSize && <span>{score.changeSize}</span>}<small>EUR scoring v1 · Dataset only</small></div>
    <p>{analysis.loading ? 'Calculating EUR release interpretation…' : analysis.error ?? score?.explanation ?? 'No usable EUR assessment.'}</p>
    {analysis.storage.error && <p role="alert">{analysis.storage.error}</p>}
    {ready && <><p>{score.strengthReason}</p><ScoringSection title="What drove the result"><div className="inspector-table-scroll"><table aria-label="EUR component scores">
      <thead><tr><th>Signal</th><th>Reading</th><th>Weight</th><th>EUR contribution</th></tr></thead>
      <tbody>{score.readings.map(row => <tr key={row.id}><td title={row.description}>{row.label}</td>
        <td>{row.weight === 0 ? 'Supporting only' : row.points === null ? 'Unavailable' : row.points === 0 ? 'Unchanged' : `${row.points > 0 ? 'EUR supportive' : 'EUR adverse'} · ${row.size}`}
          {row.weight > 0 && row.reason && <small>{row.reason}</small>}</td><td>{row.weight}%</td><td>{row.weight === 0 ? '0' : format(row.contribution)}</td></tr>)}</tbody>
      <tfoot><tr><td colSpan={4}>EUR score {format(score.total)} · Positive → EURUSD Long · Negative → EURUSD Short</td></tr></tfoot></table></div></ScoringSection>
      <ScoringSection title="How this scorer works"><ScoringNotes items={[
        { label: 'Reference periods', content: <>Flash and final releases update the same reference period. A final's supplied Previous can refer to its flash reading; comparisons instead use the preceding distinct period known at publication. Calibration uses one latest earlier publication per reference period and excludes the current period. No forecast is used.</> },
        { label: 'Family voting rules', content: <>{score.policy.family.includes('inflation') ? 'Annual inflation is the voting anchor. Monthly readings and price indexes remain in the raw table; seasonal monthly changes and overlapping index levels receive no extra votes.' : score.policy.family.endsWith('pmi') ?
        'Composite activity replaces overlapping sector votes when present in this publication. Otherwise Services, then Manufacturing supplies one activity vote. A rebound below 50 remains contraction.' :
        'Quarterly readings compare with the preceding quarter; unemployment compares with the preceding month. A monthly unemployment publication votes alone; a quarterly employment publication uses 75% quarterly and 25% annual change. They have separate context slots, and overlapping employment readings do not add independent confirmation.'}</> }
      ]} /></ScoringSection>
    <SignalCalibration readings={score.readings.filter(r => r.weight > 0)} unit="pp" label="EUR signal calibration" />
      <ScoringSection title="Coverage & limits"><p>At least 24 earlier usable signals are required. Missing weights are not redistributed. Exact cancellation uses table order with Weak evidence; all-zero or missing directional facts stay Uncomputed. Positive scores describe EUR support under our rules, not a price prediction. Stored values may contain later revisions.</p></ScoringSection></>}
  </section>
}
