import { cpiMagnitudeFamily } from '../../../../../inspector/magnitude/magnitude-families'
import type { MagnitudeSettings } from '../../../../../inspector/magnitude/settings/magnitude-settings-store'
import type { StoredCalendarEvent } from '../../../../../inspector/useStoredCalendar'
import { familyScatterModel } from '../../../../inspection/family-scatter-model'

export function cpiScatterModel(events: StoredCalendarEvent[], now: number, seriesId: string,
  selectedReleaseId: string | null, settings: MagnitudeSettings = {}) {
  return familyScatterModel(events, now, seriesId, selectedReleaseId, cpiMagnitudeFamily, settings)
}
