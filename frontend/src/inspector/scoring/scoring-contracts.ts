import type { ComponentType } from 'react'
import type { InspectorRelease } from '../inspector-data'
import type { FamilyMagnitudeHistory } from '../magnitude/useFamilyMagnitudeHistory'
import type { EconomicCalendarEvent } from '../calendar-event'

export type InspectorScoringProps = { release: InspectorRelease | null; history: FamilyMagnitudeHistory;
  brokerId?: string | null; events?: EconomicCalendarEvent[] }
export type InspectorScoringBinding = {
  pair: string; country: string; currency: 'USD' | 'EUR'; familyId: string
  matchesSymbol: (symbol: string) => boolean
  Component: ComponentType<InspectorScoringProps>
  fullView?: boolean
}
