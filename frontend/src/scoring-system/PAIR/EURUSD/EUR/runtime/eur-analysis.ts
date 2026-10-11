import type { EconomicCalendarEvent } from '../../../../../economic-calendar/contracts/calendar-event'
import type { InspectorRelease } from '../../../../../economic-calendar/releases/release'
import type { MagnitudeSettings } from '../../../../../inspector/magnitude/settings/magnitude-settings-store'
import { assessEurScore } from '../assessment/eur-score'
export type EurAnalysisInput = { release: InspectorRelease; events: readonly EconomicCalendarEvent[]; settings: MagnitudeSettings }
export const calculateEurAnalysis = (input: EurAnalysisInput) => assessEurScore(input.release, input.events, input.settings)
