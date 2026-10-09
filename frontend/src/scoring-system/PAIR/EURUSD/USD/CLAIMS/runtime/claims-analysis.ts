import type { EconomicCalendarEvent } from '../../../../../../inspector/calendar-event'
import type { InspectorRelease } from '../../../../../../inspector/inspector-data'
import type { MagnitudeSettings } from '../../../../../../inspector/magnitude/settings/magnitude-settings-store'
import { assessClaimsScore } from '../assessment/claims-score'

export type ClaimsAnalysisInput = { release: InspectorRelease; events: readonly EconomicCalendarEvent[]; settings: MagnitudeSettings }
export const calculateClaimsAnalysis = ({ release, events, settings }: ClaimsAnalysisInput) => assessClaimsScore(release, events, settings)
