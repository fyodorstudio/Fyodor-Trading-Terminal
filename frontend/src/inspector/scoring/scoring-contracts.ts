import type { ComponentType } from 'react'
import type { InspectorRelease } from '../inspector-data'
import type { FamilyMagnitudeHistory } from '../magnitude/useFamilyMagnitudeHistory'

export type InspectorScoringProps = { release: InspectorRelease | null; history: FamilyMagnitudeHistory }
export type InspectorScoringBinding = {
  pair: string; country: string; currency: 'USD' | 'EUR'; familyId: string
  matchesSymbol: (symbol: string) => boolean
  Component: ComponentType<InspectorScoringProps>
}
