import { useEffect, useMemo, useState } from 'react'
import { chartEventCurrencies } from '../economic-calendar/forex/chart-event-scope'
import type { StoredCalendarEvent } from '../economic-calendar/storage/useStoredCalendar'
import { sameCalendarRows } from '../economic-calendar/storage/calendar-snapshot-identity'
import { useCalendarNow } from '../inspector/useCalendarNow'

export type RecentDays = 3 | 7 | 14 | 31
export type EventPanelMode = 'recent' | 'upcoming'
type Snapshot = { key: string; events: StoredCalendarEvent[]; error: string | null }
const empty: StoredCalendarEvent[] = []

function validRow(row: StoredCalendarEvent, from: number, to: number, currencies: readonly string[]) {
  return row && typeof row.value_id === 'string' && typeof row.name === 'string'
    && currencies.includes(row.currency) && typeof row.release_at === 'number'
    && Number.isFinite(row.release_at) && row.release_at >= from && row.release_at <= to
    && ['unit', 'multiplier', 'digits'].every(key => Number.isFinite(row[key as keyof StoredCalendarEvent]))
    && [row.actual, row.forecast, row.previous].every(value => value === null || typeof value === 'number' && Number.isFinite(value))
}

export function useRecentEvents(brokerId: string | null, symbol: string, days: RecentDays, mode: EventPanelMode) {
  // Mounted only while the panel is open. This clock never re-renders the chart.
  const now = Math.floor(useCalendarNow(0, 30_000))
  const currencies = chartEventCurrencies(symbol)
  const scope = currencies.join(',')
  const key = JSON.stringify([brokerId, scope, days, mode])
  const from = mode === 'upcoming' ? now + 1 : now - days * 86400000
  const to = mode === 'upcoming' ? now + days * 86400000 : now
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  useEffect(() => {
    if (!brokerId || !scope) return
    const abort = new AbortController()
    async function load() {
      try {
        const query = new URLSearchParams({ source_id: brokerId!, currencies: scope,
          from_utc_ms: String(from), to_utc_ms: String(to) })
        const response = await fetch(`/storage-api/recent-calendar?${query}`, { signal: abort.signal })
        if (!response.ok) throw new Error(`Events unavailable (HTTP ${response.status})`)
        const data = await response.json()
        if (abort.signal.aborted) return
        if (!data || data.source_id !== brokerId || data.from_utc_ms !== from || data.to_utc_ms !== to
          || !Array.isArray(data.currencies) || data.currencies.join(',') !== scope
          || typeof data.source_available !== 'boolean' || !Array.isArray(data.events)
          || !data.events.every((row: StoredCalendarEvent) => validRow(row, from, to, currencies)))
          throw new Error('Invalid events response')
        if (!data.source_available) throw new Error(`No stored calendar for ${brokerId}`)
        setSnapshot(old => ({ key, error: null,
          events: old?.key === key && sameCalendarRows(old.events, data.events) ? old.events : data.events }))
      } catch (error) {
        if (!abort.signal.aborted) setSnapshot(old => ({ key, events: old?.key === key ? old.events : empty,
          error: error instanceof Error ? error.message : 'Events unavailable' }))
      }
    }
    void load()
    return () => abort.abort()
  }, [brokerId, scope, key, from, to, currencies])
  const active = snapshot?.key === key ? snapshot : null
  const events = useMemo(() => (active?.events ?? empty)
    .filter(row => row.release_at !== null && row.release_at >= from && row.release_at <= to)
    .sort((a, b) => (mode === 'upcoming' ? a.release_at! - b.release_at! : b.release_at! - a.release_at!)
      || a.currency.localeCompare(b.currency) || a.value_id.localeCompare(b.value_id)),
  [active?.events, from, to, mode])
  return { events, now, currencies, loading: !!brokerId && !!scope && !active, error: active?.error }
}
