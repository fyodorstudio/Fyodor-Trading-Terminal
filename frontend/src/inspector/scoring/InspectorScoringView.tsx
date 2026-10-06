import { PublicationContext } from '../../usd-context/ui/PublicationContext'
import type { InspectorScoringBinding, InspectorScoringProps } from './scoring-contracts'

export function InspectorScoringView({ binding, ...props }: InspectorScoringProps & { binding: InspectorScoringBinding }) {
  const Component = binding.Component
  if (binding.fullView) return <div className="inspector-publication-score"><Component {...props} />{props.release && !binding.includesContext && <PublicationContext release={props.release} brokerId={props.brokerId}
    events={props.events} now={props.now} timeDisplay={props.timeDisplay} />}</div>
  return <div className="inspector-detail-overview inspector-scoring-view" aria-label="Release magnitude summaries">
    <Component {...props} />
  </div>
}
