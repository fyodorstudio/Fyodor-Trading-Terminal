import '../../../../../shared/ui/release-score.css'
import type { InspectorScoringProps } from '../../../../../scoring-contracts'
import { assessFedScore } from '../../../../../../../scoring-system/PAIR/EURUSD/USD/FED/assessment/fed-score'
import { FedDecisionContext } from './FedDecisionContext'
import { FedRateAction } from './FedRateAction'
import { PublicationScoringLayout } from '../../../../../shared/ui/PublicationScoringLayout'
import { PublicationScoringContext } from '../../../../../shared/ui/PublicationScoringContext'
import { useContext } from 'react'
import { ScoringSurface } from '../../../../../shared/ui/scoring-surface'
export function FedScore({ release, ...props }: InspectorScoringProps) {
  const a = assessFedScore(release)
  const plain = useContext(ScoringSurface) === 'standalone'
  if (!a) return null
  if (release?.familyId === 'fomc') return <FedDecisionContext {...props} release={release} action={a} />
  if (plain) return <FedRateAction action={a} eligible={release?.releaseAt != null && !release.timingUncertain && release.releaseAt <= (props.now ?? 0)} />
  return <PublicationScoringLayout standalone={<FedRateAction action={a} eligible={release?.releaseAt != null && !release.timingUncertain && release.releaseAt <= (props.now ?? 0)} />}
    context={<PublicationScoringContext {...props} release={release} />} />
}
