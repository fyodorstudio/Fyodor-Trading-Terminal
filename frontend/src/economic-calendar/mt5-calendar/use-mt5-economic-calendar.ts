import { useEffect, useRef, useState } from 'react'
import { bridgeRequest } from '../../system-connectivity/bridge-status/bridge-client'
import { useActivityLog } from '../../system-observability/activity-log/use-activity-log'
import type { CalendarSourceHealth } from '../../system-connectivity/bridge-status/bridge-contract'
import type { EconomicCalendarEvent, EconomicCalendarResponse } from './calendar-contract'

export type Mt5EconomicCalendar = {
  events: EconomicCalendarEvent[]
  source: CalendarSourceHealth | null
  error: string | null
}

export function useMt5EconomicCalendar(
  reachable: boolean,
  healthSource: CalendarSourceHealth | null,
  enabled: boolean,
): Mt5EconomicCalendar {
  const { appendActivity } = useActivityLog()
  const [snapshot, setSnapshot] = useState<EconomicCalendarResponse | null>(null)
  const [failure, setFailure] = useState<{ instanceId: string | null; message: string } | null>(null)
  const previousStatus = useRef<CalendarSourceHealth['status'] | null>(null)
  const calendarRevision = healthSource?.last_update_at === null || healthSource?.last_update_at === undefined
    ? null
    : `${healthSource.instance_id}:${healthSource.last_update_at}:${healthSource.event_count}`

  useEffect(() => {
    const status = healthSource?.status ?? null
    if (status === previousStatus.current) return
    if (status === 'live') {
      appendActivity('Calendar', 'Calendar feed live', `${healthSource?.event_count ?? 0} MT5 events`, { severity: 'success' })
    } else if (status === 'stale' && previousStatus.current === 'live') {
      appendActivity('Calendar', 'Calendar publisher stale', 'No publisher heartbeat for more than 30 seconds', { severity: 'warning' })
    }
    previousStatus.current = status
  }, [appendActivity, healthSource?.event_count, healthSource?.status])

  useEffect(() => {
    if (!reachable || !enabled || calendarRevision === null) return
    let disposed = false
    const controller = new AbortController()

    const loadRevision = async () => {
      try {
        const response = await bridgeRequest<EconomicCalendarResponse>('/calendar', controller.signal)
        if (disposed) return
        setSnapshot(response)
        setFailure(null)
      } catch (requestError) {
        if (disposed || (requestError instanceof DOMException && requestError.name === 'AbortError')) return
        setFailure({ instanceId: healthSource?.instance_id ?? null,
          message: requestError instanceof Error ? requestError.message : 'Calendar request failed' })
      }
    }

    void loadRevision()
    return () => {
      disposed = true
      controller.abort()
    }
  }, [calendarRevision, enabled, reachable, healthSource?.instance_id])

  return reachable
    ? {
        events: enabled && calendarRevision !== null && snapshot?.source.instance_id === healthSource?.instance_id ? snapshot?.events ?? [] : [],
        source: healthSource,
        error: calendarRevision !== null && failure?.instanceId === healthSource?.instance_id ? failure?.message ?? null : null,
      }
    : { events: [], source: null, error: null }
}
