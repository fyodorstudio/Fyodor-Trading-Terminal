import type { EconomicCalendarEvent } from '../../../../../inspector/calendar-event'
import type { InspectorRelease } from '../../../../../inspector/inspector-data'
import type { MagnitudeSettings } from '../../../../../inspector/magnitude/settings/magnitude-settings-store'
import { assessEurScore } from '../assessment/eur-score'
export type EurAnalysisInput = { release: InspectorRelease; events: readonly EconomicCalendarEvent[]; settings: MagnitudeSettings }
export const calculateEurAnalysis = (input: EurAnalysisInput) => assessEurScore(input.release, input.events, input.settings)
