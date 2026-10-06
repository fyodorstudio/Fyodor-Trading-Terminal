import type { InspectorScoringProps } from '../../scoring-contracts'
import type { MagnitudeSettings } from '../../../magnitude/settings/magnitude-settings-store'
import { assessGdpScore } from '../../PAIR/EURUSD/USD/GDP/assessment/gdp-score'
import { assessPpiScore } from '../../PAIR/EURUSD/USD/PPI/assessment/ppi-score'
export type ExpandedReleaseInput = { release: NonNullable<InspectorScoringProps['release']>; events: NonNullable<InspectorScoringProps['events']>; settings: MagnitudeSettings }
export function calculateExpandedRelease({ release, events, settings }: ExpandedReleaseInput) {
  return release.familyId === 'gdp' ? assessGdpScore(release, events, settings) : assessPpiScore(release, events, settings)
}
