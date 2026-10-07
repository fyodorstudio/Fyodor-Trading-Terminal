import type { InspectorScoringProps } from '../../../../scoring-contracts'
import { assessEcbRateAction } from '../assessment/ecb-rate-action'
export function EcbScore({release,now=0}:InspectorScoringProps){
  const score=assessEcbRateAction(release), eligible=release?.releaseAt!=null && release.releaseAt<=now
  return <section className="inspector-detail-overview inspector-scoring-view inspector-structured-score" aria-label="ECB numerical interpretation">
    <div className="inspector-release-score-summary"><strong className={`inspector-majority inspector-direction-${eligible?score?.direction:'uncomputed'}`}>{eligible?score?.label:'Uncomputed'}</strong>
      {eligible && score?.strength && <span>{score.strength} rate-action evidence</span>}<small>ECB v1 · Numerical action</small></div>
    <p>{eligible?score?.explanation:'A verified, already published release is required.'}</p><p><strong>{eligible?score?.action:'Action unavailable'}</strong></p>
    <div className="inspector-table-scroll"><table aria-label="ECB rate actions"><thead><tr><th>Rate</th><th>Actual</th><th>Change</th></tr></thead><tbody>{score?.readings.map(row=><tr key={row.id}><td>{row.label}</td><td>{eligible && row.actual!==null?`${row.actual}%`:'—'}</td><td>{eligible && row.delta!==null?`${row.delta} bp`:'—'}</td></tr>)}</tbody></table></div>
    <p>Deposit facility anchors the action; overlapping policy rates do not cast three independent votes. A hold adds no vote and never renews macro evidence. Statement and press-conference rows have no numerical content in the dataset. Select EUR vs USD in the context column or Raycaster to show relative economic context alongside releases.</p>
  </section>
}
