import type { EconomicCalendarEvent } from '../contracts/calendar-event'
import type { CalendarFamilyId } from '../catalog'
import type { MajorCurrency } from '../forex/currencies'

export type InspectorRelease = {
  id: string
  familyId: CalendarFamilyId
  label: string
  currency: MajorCurrency
  country: string
  releaseAt: number | null
  chartTime: number | null
  serverTime: number
  timingUncertain: boolean
  events: EconomicCalendarEvent[]
  pmiPublications?: InspectorRelease[]
  // Display-only day/currency selection; preserve individual publications.
  daily?: { date: string; endChartTime: number | null; publications: InspectorRelease[]; sections: InspectorDaySection[] }
}

export type InspectorDaySection = { id: string; label: string; publications: InspectorRelease[]; releaseCount: number }
