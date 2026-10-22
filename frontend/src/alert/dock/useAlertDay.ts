import { useEffect, useState } from 'react'
import type { StoredCalendarEvent } from '../../economic-calendar/storage/useStoredCalendar'
import { sameCalendarRows } from '../../economic-calendar/storage/calendar-snapshot-identity'

type DaySnapshot = { source_id: string; date: string; revision: string; events: StoredCalendarEvent[];
  source: { publisher_status: string } | null; coverage: Record<string, { missing: number[][] }> }
const empty: StoredCalendarEvent[] = []
export function useAlertDay(sourceId: string, date: string) {
  const key = `${sourceId}:${date}`
  const [state, setState] = useState<{ key: string; data: DaySnapshot | null; error: string | null }>({ key, data: null, error: null })
  useEffect(() => {
    const abort = new AbortController(); let timer: number | undefined, revision = ''
    async function pollAlertDay() {
      try {
        const query = new URLSearchParams({ source_id: sourceId, date })
        if (revision) query.set('after_revision', revision)
        const response = await fetch(`/storage-api/alert-calendar?${query}`, { signal: abort.signal })
        if (!response.ok) throw new Error(response.status === 404 ? 'Update calendar storage to load the date-based Alert.' : `Calendar unavailable (HTTP ${response.status})`)
        const data = await response.json()
        if (abort.signal.aborted) return
        if (data.source_id !== sourceId || data.date !== date || typeof data.revision !== 'string'
          || !data.unchanged && (!Array.isArray(data.events) || data.events.some((event: StoredCalendarEvent) => !event || typeof event.value_id !== 'string'
            || ![event.actual, event.forecast, event.previous, event.revised_previous, event.release_at].every(value => value === null || Number.isFinite(value))))) throw new Error('Invalid date calendar response')
        revision = data.revision
        setState(old => {
          if (data.unchanged) return old.key === key ? old.error ? { ...old, error: null } : old : { key, data: null, error: 'Calendar snapshot missing; retrying' }
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
