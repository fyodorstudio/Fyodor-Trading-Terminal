import { nfpMagnitudeFamily } from '../../../../../inspector/magnitude/magnitude-families'
import type { StoredCalendarEvent } from '../../../../../inspector/useStoredCalendar'
import { familyScatterModel } from '../../../../inspection/family-scatter-model'
import type { NfpMagnitudeSettings } from './magnitude/nfp-magnitude-settings'

export function nfpScatterModel(events: StoredCalendarEvent[], now: number, seriesId: string,
  selectedReleaseId: string | null, settings: NfpMagnitudeSettings = {}) {
  return familyScatterModel(events, now, seriesId, selectedReleaseId, nfpMagnitudeFamily, settings)
}
