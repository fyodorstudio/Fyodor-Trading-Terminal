import { CpiIndexMagnitudeTable } from './CpiIndexMagnitudeTable'
import { CpiMagnitudeScoreTable } from './CpiMagnitudeScoreTable'
import type { InspectorScoringProps } from '../../../../../scoring-contracts'

export function CpiMagnitudeScoreTables(props: InspectorScoringProps) {
  return <><CpiIndexMagnitudeTable {...props} /><CpiMagnitudeScoreTable {...props} /></>
}
