import { PublicationScoringLayout } from './shared/ui/PublicationScoringLayout'
import { ScoringSurface } from './shared/ui/scoring-surface'
import { PublicationScoringContext } from './shared/ui/PublicationScoringContext'
import type { InspectorScoringBinding, InspectorScoringProps } from './scoring-contracts'
import { ismSourceRelease } from '../episodes/ism-episodes'
import { memo } from 'react'
import { PmiEpisodeScore } from './PAIR/EURUSD/EUR/ui/PmiEpisodeScore'

function InspectorScoringViewComponent({ surface = 'standalone', ...props }: InspectorScoringProps & {
  binding: InspectorScoringBinding; surface?: 'standalone' | 'context' | 'both'
}) {
  return <ScoringSurface value={surface}><ScoringContent {...props} surface={surface} /></ScoringSurface>
}
function ScoringContent({ binding, surface, ...props }: InspectorScoringProps & { binding: InspectorScoringBinding; surface: 'standalone' | 'context' | 'both' }) {
  const Component = binding.Component
  if (binding.currency === 'USD' && surface === 'standalone') return <section className="inspector-table-score" aria-label="Standalone Scoring"><Component {...props} /></section>
  if (props.release?.pmiPublications) return <PmiEpisodeScore {...props} />
  if (binding.includesContext) return <Component {...props} />
  const contextRelease = ismSourceRelease(props.release, null, props.now ?? 0)
  return <PublicationScoringLayout standalone={<Component {...props} />} context={<PublicationScoringContext {...props} release={contextRelease} />} />
}
export const InspectorScoringView = memo(InspectorScoringViewComponent)
