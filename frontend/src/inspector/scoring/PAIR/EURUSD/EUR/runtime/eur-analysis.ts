import type { EconomicCalendarEvent } from '../../../../../calendar-event'
import type { InspectorRelease } from '../../../../../inspector-data'
import type { MagnitudeSettings } from '../../../../../magnitude/settings/magnitude-settings-store'
import { assessEurScore } from '../assessment/eur-score'
export type EurAnalysisInput = { release: InspectorRelease; events: readonly EconomicCalendarEvent[]; settings: MagnitudeSettings }
export const calculateEurAnalysis = (input: EurAnalysisInput) => assessEurScore(input.release, input.events, input.settings)
