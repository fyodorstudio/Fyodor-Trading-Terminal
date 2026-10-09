import type { InspectorScoringProps } from '../../../../scoring-contracts'
import { assessEcbRateAction } from '../../../../../../scoring-system/PAIR/EURUSD/EUR/assessment/ecb-rate-action'
import { ScoringSection } from '../../../../shared/ui/ScoringSection'
export function EcbScore({release,now=0}:InspectorScoringProps){
  const score=assessEcbRateAction(release), eligible=release?.releaseAt!=null && release.releaseAt<=now
  return <section className="inspector-detail-overview inspector-scoring-view inspector-structured-score" aria-label="ECB numerical interpretation">
    <div className="inspector-release-score-summary"><strong className={`inspector-majority inspector-direction-${eligible?score?.direction:'uncomputed'}`}>{eligible?score?.label:'Uncomputed'}</strong>
      {eligible && score?.strength && <span>{score.strength} rate-action evidence</span>}</div>
    <small className="scoring-engine-version">ECB v1 · Numerical action</small>
    <p>{eligible?score?.explanation:'A verified, already published release is required.'}</p>
    <ScoringSection title="Decision & rate action"><div className="inspector-table-scroll"><table aria-label="ECB rate actions"><thead><tr><th>Rate</th><th>Actual</th><th>Change</th></tr></thead><tbody>{score?.readings.map(row=><tr key={row.id}><td>{row.label}</td><td>{eligible && row.actual!==null?`${row.actual}%`:'—'}</td><td>{eligible && row.delta!==null?`${row.delta} bp`:'—'}</td></tr>)}</tbody></table></div></ScoringSection>
    <ScoringSection title="How this scorer works" collapsible><p>The deposit facility rate determines the action; other policy rates provide context.</p></ScoringSection>
  </section>
}
