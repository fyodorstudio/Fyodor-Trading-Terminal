import { useEffect, useState } from 'react'
import type { StoredCalendarEvent } from '../../economic-calendar/storage/useStoredCalendar'
import { sameCalendarRows } from '../../economic-calendar/storage/calendar-snapshot-identity'
import { validAlertDayResponse, type AlertDaySnapshot } from '../model/alert-day-snapshot'

const empty: StoredCalendarEvent[] = []
export function useAlertDay(sourceId: string, date: string) {
  const key = `${sourceId}:${date}`
  const [state, setState] = useState<{ key: string; data: AlertDaySnapshot | null; error: string | null }>({ key, data: null, error: null })
  useEffect(() => {
    const abort = new AbortController(); let timer: number | undefined, revision = ''
    async function pollAlertDay() {
      try {
        const query = new URLSearchParams({ source_id: sourceId, date })
        if (revision) query.set('after_revision', revision)
        const response = await fetch(`/storage-api/alert-calendar?${query}`, { signal: abort.signal })
        if (!response.ok) throw new Error(response.status === 404 ? 'Update calendar storage to load the date-based Alert.' : `Calendar unavailable (HTTP ${response.status})`)
        const data: unknown = await response.json()
        if (abort.signal.aborted) return
        if (!validAlertDayResponse(data, sourceId, date, revision)) throw new Error('Invalid date calendar response')
        revision = data.revision
        setState(old => {
          if ('unchanged' in data && data.unchanged) return old.key === key ? old.error ? { ...old, error: null } : old : { key, data: null, error: 'Calendar snapshot missing; retrying' }
          if (!('events' in data)) return old
          const events = old.key === key && old.data && sameCalendarRows(old.data.events, data.events) ? old.data.events : data.events
          return { key, data: { ...data, events }, error: null }
        })
      } catch (error) {
        if (!abort.signal.aborted) setState(old => ({ key, data: old.key === key ? old.data : null, error: error instanceof Error ? error.message : 'Calendar unavailable' }))
      } finally { if (!abort.signal.aborted) timer = window.setTimeout(pollAlertDay, 2000) }
    }
    void pollAlertDay()
    return () => { abort.abort(); window.clearTimeout(timer) }
  }, [key, sourceId, date])
  const data = state.key === key ? state.data : null
  return { events: data?.events ?? empty, source: data?.source ?? null, coverage: data?.coverage,
    loading: !data && !(state.key === key && state.error), error: state.key === key ? state.error : null }
}
