import '../../../../../shared/ui/release-score.css'
import type { InspectorScoringProps } from '../../../../../scoring-contracts'
import { assessFedScore } from '../assessment/fed-score'
import { FedDecisionContext } from './FedDecisionContext'
export function FedScore({ release, ...props }: InspectorScoringProps) {
  const a = assessFedScore(release)
  if (!a) return null
  if (release?.familyId === 'fomc') return <FedDecisionContext {...props} release={release} action={a} />
  return <div className="inspector-detail-overview inspector-scoring-view inspector-structured-score" aria-label="Fed policy interpretation">
    <div className="inspector-release-score-summary"><strong className={`inspector-majority inspector-direction-${a.direction}`}>{a.label}</strong>{a.strength && <span>{a.strength} rate-action evidence</span>}<strong>{a.action}</strong><small>Rate-action v1 · Partial policy coverage</small></div>
    <p>{a.explanation}</p>
    {a.delta !== null && <p>Rate {a.actual}% · Previous {a.previous}% · Action {a.delta > 0 ? '+' : ''}{a.delta} bp.</p>}
    <p>{a.coverage}</p>
    <p>The combined economic context below interprets the available inflation, labor and activity releases. It describes the background to this event; it cannot claim what the Fed communicated. Rate actions are not added as another macro vote until guidance has a supported data source.</p>
  </div>
}
