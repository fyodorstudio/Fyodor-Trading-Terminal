import { eurCalendarFamilies } from './EUR'
import { usdCalendarFamilies } from './USD'
import { gbpCalendarFamilies } from './GBP'
import { audCalendarFamilies } from './AUD'
import { nzdCalendarFamilies } from './NZD'
import { cadCalendarFamilies } from './CAD'
import { chfCalendarFamilies } from './CHF'
import { jpyCalendarFamilies } from './JPY'
import { completeCalendarCatalog } from './complete-catalog'

// Source-ID catalog: admission never falls back to names or importance labels.
export const eventFamilyOptions = completeCalendarCatalog([
  ...eurCalendarFamilies,
  ...usdCalendarFamilies,
  ...gbpCalendarFamilies,
  ...audCalendarFamilies,
  ...nzdCalendarFamilies,
  ...cadCalendarFamilies,
  ...chfCalendarFamilies,
  ...jpyCalendarFamilies,
])

export type CalendarFamilyId = typeof eventFamilyOptions[number]['id']
