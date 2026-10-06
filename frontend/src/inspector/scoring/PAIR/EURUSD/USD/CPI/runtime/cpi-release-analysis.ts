import type { InspectorRelease } from '../../../../../../inspector-data'
import type { EconomicCalendarEvent } from '../../../../../../calendar-event'
import type { MagnitudeSettings } from '../../../../../../magnitude/settings/magnitude-settings-store'
import { assessCpiScoreV3 } from '../assessment/cpi-score-v3'

export type CpiReleaseInput = { release: InspectorRelease; events: readonly EconomicCalendarEvent[]; settings: MagnitudeSettings }
export const calculateCpiRelease = ({ release, events, settings }: CpiReleaseInput) => assessCpiScoreV3(release, events, settings)
