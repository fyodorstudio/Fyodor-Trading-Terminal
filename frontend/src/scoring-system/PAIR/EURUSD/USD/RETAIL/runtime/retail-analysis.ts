import type { EconomicCalendarEvent } from '../../../../../../inspector/calendar-event'
import type { InspectorRelease } from '../../../../../../inspector/inspector-data'
import type { MagnitudeSettings } from '../../../../../../inspector/magnitude/settings/magnitude-settings-store'
import { assessRetailScore } from '../assessment/retail-score'

export type RetailAnalysisInput = { release: InspectorRelease; events: readonly EconomicCalendarEvent[]; settings: MagnitudeSettings }
export const calculateRetailAnalysis = ({ release, events, settings }: RetailAnalysisInput) => assessRetailScore(release, events, settings)
