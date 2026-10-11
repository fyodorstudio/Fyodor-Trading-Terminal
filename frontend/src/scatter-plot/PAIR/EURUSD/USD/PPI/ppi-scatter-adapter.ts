import { ppiMagnitudeFamily } from '../../../../../inspector/magnitude/magnitude-families'
import type { MagnitudeSettings } from '../../../../../inspector/magnitude/settings/magnitude-settings-store'
import type { StoredCalendarEvent } from '../../../../../economic-calendar/storage/useStoredCalendar'
import { familyScatterModel } from '../../../../inspection/family-scatter-model'

export function ppiScatterModel(events: StoredCalendarEvent[], now: number, seriesId: string,
  selectedReleaseId: string | null, settings: MagnitudeSettings = {}) {
  return familyScatterModel(events, now, seriesId, selectedReleaseId, ppiMagnitudeFamily, settings)
}
