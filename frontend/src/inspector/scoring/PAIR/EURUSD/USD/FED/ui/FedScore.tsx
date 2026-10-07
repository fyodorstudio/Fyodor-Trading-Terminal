import '../../../../../shared/ui/release-score.css'
import type { InspectorScoringProps } from '../../../../../scoring-contracts'
import { assessFedScore } from '../assessment/fed-score'
import { FedDecisionContext } from './FedDecisionContext'
import { FedRateAction } from './FedRateAction'
import { PublicationScoringLayout } from '../../../../../shared/ui/PublicationScoringLayout'
import { PublicationScoringContext } from '../../../../../shared/ui/PublicationScoringContext'
export function FedScore({ release, ...props }: InspectorScoringProps) {
  const a = assessFedScore(release)
  if (!a) return null
  if (release?.familyId === 'fomc') return <FedDecisionContext {...props} release={release} action={a} />
  return <PublicationScoringLayout standalone={<FedRateAction action={a} eligible={release?.releaseAt != null && !release.timingUncertain && release.releaseAt <= (props.now ?? 0)} />}
    context={<PublicationScoringContext {...props} release={release} />} />
}
