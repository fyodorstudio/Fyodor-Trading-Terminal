import { PublicationScoringLayout } from './shared/ui/PublicationScoringLayout'
import { PublicationScoringContext } from './shared/ui/PublicationScoringContext'
import type { InspectorScoringBinding, InspectorScoringProps } from './scoring-contracts'
import { ismSourceRelease } from '../episodes/ism-episodes'
import { memo } from 'react'
import { PmiEpisodeScore } from './PAIR/EURUSD/EUR/ui/PmiEpisodeScore'

function InspectorScoringViewComponent({ binding, ...props }: InspectorScoringProps & { binding: InspectorScoringBinding }) {
  const Component = binding.Component
  if (props.release?.pmiPublications) return <PmiEpisodeScore {...props} />
  if (binding.includesContext) return <Component {...props} />
  const contextRelease = ismSourceRelease(props.release, null, props.now ?? 0)
  return <PublicationScoringLayout standalone={<Component {...props} />} context={<PublicationScoringContext {...props} release={contextRelease} />} />
}
export const InspectorScoringView = memo(InspectorScoringViewComponent)
