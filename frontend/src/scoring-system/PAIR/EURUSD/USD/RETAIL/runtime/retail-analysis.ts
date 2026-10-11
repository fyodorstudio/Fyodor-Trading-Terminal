import type { EconomicCalendarEvent } from '../../../../../../economic-calendar/contracts/calendar-event'
import type { InspectorRelease } from '../../../../../../economic-calendar/releases/release'
import type { MagnitudeSettings } from '../../../../../../inspector/magnitude/settings/magnitude-settings-store'
import { assessRetailScore } from '../assessment/retail-score'

export type RetailAnalysisInput = { release: InspectorRelease; events: readonly EconomicCalendarEvent[]; settings: MagnitudeSettings }
export const calculateRetailAnalysis = ({ release, events, settings }: RetailAnalysisInput) => assessRetailScore(release, events, settings)
