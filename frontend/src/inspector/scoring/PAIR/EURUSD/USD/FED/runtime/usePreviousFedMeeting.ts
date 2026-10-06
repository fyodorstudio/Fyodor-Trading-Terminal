import { useMemo } from 'react'
import type { EconomicCalendarEvent } from '../../../../../../calendar-event'
import type { InspectorRelease } from '../../../../../../inspector-data'
import { useStoredCalendar } from '../../../../../../useStoredCalendar'
import { previousFedMeeting } from '../assessment/fed-context'

const scope = { currency: 'USD' as const, eventIds: ['840050014'] }
const empty: EconomicCalendarEvent[] = []
export function usePreviousFedMeeting(release: InspectorRelease, brokerId: string | null, events = empty) {
  const at = release.releaseAt
  const range = useMemo(() => at === null ? null : ({ from: at - 370 * 86400000, to: at + 2 * 86400000 }), [at])
  const storage = useStoredCalendar(brokerId, range, !!range, scope)
  const history = brokerId ? storage.events : events
  const previous = useMemo(() => previousFedMeeting(release, history), [release, history])
  return { previous, storage }
}
