import { PublicationScoringLayout } from './shared/ui/PublicationScoringLayout'
import { PublicationScoringContext } from './shared/ui/PublicationScoringContext'
import type { InspectorScoringBinding, InspectorScoringProps } from './scoring-contracts'

export function InspectorScoringView({ binding, ...props }: InspectorScoringProps & { binding: InspectorScoringBinding }) {
  const Component = binding.Component
  if (binding.includesContext) return <Component {...props} />
  return <PublicationScoringLayout standalone={<Component {...props} />} context={<PublicationScoringContext {...props} />} />
}
