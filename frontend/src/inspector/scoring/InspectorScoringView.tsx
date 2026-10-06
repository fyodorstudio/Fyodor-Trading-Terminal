import type { InspectorScoringBinding, InspectorScoringProps } from './scoring-contracts'

export function InspectorScoringView({ binding, ...props }: InspectorScoringProps & { binding: InspectorScoringBinding }) {
  const Component = binding.Component
  if (binding.fullView) return <Component {...props} />
  return <div className="inspector-detail-overview inspector-scoring-view" aria-label="Release magnitude summaries">
    <Component {...props} />
  </div>
}
