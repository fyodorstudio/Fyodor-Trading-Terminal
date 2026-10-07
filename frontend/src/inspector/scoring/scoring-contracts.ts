import type { ComponentType } from 'react'
import type { InspectorRelease } from '../inspector-data'
import type { TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import type { EconomicCalendarEvent } from '../calendar-event'

export type InspectorScoringProps = { release: InspectorRelease | null;
  brokerId?: string | null; events?: EconomicCalendarEvent[]; now?: number; timeDisplay?: TimeDisplayPreference;
  onOpenScatter?: (release: InspectorRelease) => void }
export type InspectorScoringBinding = {
  pair: string; country: string; currency: 'USD' | 'EUR'; familyId: string
  matchesSymbol: (symbol: string) => boolean
  Component: ComponentType<InspectorScoringProps>
  versionLabel: string
  // Component already owns the shared standalone/publication layout (Fed/CPI).
  includesContext?: boolean
}
