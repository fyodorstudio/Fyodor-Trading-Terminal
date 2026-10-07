import { useEffect, useMemo, useState } from 'react'
import type { EconomicCalendarEvent } from './calendar-event'
import type { CalendarDisplayRange } from './calendar-display-range'
import { sameCalendarRows } from './storage/calendar-snapshot-identity'

export type StoredCalendarEvent = EconomicCalendarEvent & {
  chart_time_seconds: number | null
  availability: 'observed' | 'not-returned-by-latest-query'
}
type Coverage = Record<string, { missing: number[][] }>
type StorageSource = { id: string; publisher_status: string; server_now: number; instance_id: string | null;
  coverage?: Record<string, { covered: number[][]; missing: number[][] }> }
type Health = { revision: number; sources: StorageSource[]; collector_error: string | null }
type Page = { source_id: string; revision: number; timestamp_convention: string; time_basis: string; events: StoredCalendarEvent[];
  event_ids?: string[] | null;
  coverage: Coverage; next_cursor: { after_time: number; after_id: string } | null }
type Snapshot = { key: string; events: StoredCalendarEvent[]; coverage: Coverage; loading: boolean;
  error: string | null; source: StorageSource | null; collectorError: string | null }
const noStoredEvents: StoredCalendarEvent[] = []
const noCoverage: Coverage = {}

export function useStoredCalendar(brokerId: string | null | undefined, range: CalendarDisplayRange | null, enabled: boolean,
  scope?: { currency?: 'EUR' | 'USD'; eventIds?: readonly string[] }) {
  const from = range ? Math.floor(range.from / 1000) : null
  const to = range ? Math.ceil(range.to / 1000) : null
  const currency = scope?.currency
  const eventIds = scope?.eventIds ? [...new Set(scope.eventIds)].sort().join(',') : null
  const key = JSON.stringify([brokerId, from, to, currency, eventIds])
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  useEffect(() => {
    if (!enabled || !brokerId || from === null || to === null) return
    const controller = new AbortController()
    let cancelled = false
    let timer: number | undefined
    let revision: number | null = null
    let coverageSignature: string | undefined
    const current = () => !cancelled
    async function get<T>(path: string): Promise<T> {
      const response = await fetch(`/storage-api${path}`, { signal: controller.signal })
      if (!response.ok) throw new Error(`Calendar storage returned HTTP ${response.status}`)
      return response.json() as Promise<T>
    }
    async function poll() {
      try {
        const health = await get<Health>('/health')
        if (!current()) return
        const source = health.sources.find((item) => item.id === brokerId) ?? null
        if (!source) throw new Error(`No stored calendar for ${brokerId}. Start Publisher V2 or import its inventory.`)
        const currentCoverage = JSON.stringify(source.coverage)
        if (health.revision === revision && currentCoverage === coverageSignature) {
          if (current()) setSnapshot((old) => old?.key === key ? { ...old, source, collectorError: health.collector_error, error: null } : old)
          return
        }
        // Every page must belong to the same database revision. A moving
        // backfill cannot splice different snapshots into one release table.
        for (let attempt = 0; attempt < 3; attempt++) {
          const events: StoredCalendarEvent[] = []
          let cursor: Page['next_cursor'] = null
          let pageRevision: number | null = null
          let coverage: Coverage = {}
          let changed = false
          const visited = new Set<string>()
          do {
            const params = new URLSearchParams({ source_id: brokerId!, from_server_seconds: String(from),
              to_server_seconds: String(to), limit: '5000', time_basis: 'chart' })
            if (currency) params.set('currency', currency)
            if (eventIds) params.set('event_ids', eventIds)
            if (cursor) { params.set('after_time', String(cursor.after_time)); params.set('after_id', cursor.after_id) }
            const page = await get<Page>(`/calendar?${params}`)
            if (!current()) return
            if (page.time_basis !== 'chart') throw new Error('Restart calendar storage to enable historical chart timing.')
            if (eventIds && page.event_ids?.slice().sort().join(',') !== eventIds)
              throw new Error('Restart calendar storage to enable series-filtered history.')
            if (page.source_id !== brokerId || page.timestamp_convention !== 'trade_server_time' || !Number.isSafeInteger(page.revision))
              throw new Error('Calendar storage returned an incompatible response')
            if (pageRevision !== null && pageRevision !== page.revision) { changed = true; break }
            pageRevision = page.revision
            events.push(...page.events)
            coverage = page.coverage
            cursor = page.next_cursor
            if (cursor) {
              const identity = JSON.stringify(cursor)
              if (visited.has(identity)) throw new Error('Calendar storage repeated its page cursor')
              visited.add(identity)
            }
          } while (cursor)
          if (changed) continue
          revision = pageRevision
          coverageSignature = currentCoverage
          if (current()) setSnapshot((old) => ({ key, events: old?.key === key && sameCalendarRows(old.events, events) ? old.events : events,
            coverage, loading: false, error: null, source, collectorError: health.collector_error }))
          return
        }
        throw new Error('Calendar changed during paging; retrying shortly')
      } catch (error) {
        if (current()) setSnapshot((old) => ({ key, events: old?.key === key ? old.events : [],
          coverage: old?.key === key ? old.coverage : {}, source: old?.key === key ? old.source : null,
          collectorError: old?.key === key ? old.collectorError : null, loading: false,
          error: error instanceof Error ? error.message : 'Calendar storage unavailable' }))
      } finally {
        if (current()) timer = window.setTimeout(poll, 10_000)
      }
    }
    void poll()
    return () => { cancelled = true; controller.abort(); window.clearTimeout(timer) }
  }, [enabled, brokerId, from, to, key, currency, eventIds])
  const active = enabled && brokerId && snapshot?.key === key ? snapshot : null
  const loading = Boolean(enabled && brokerId && range && (!active || active.loading))
  return useMemo(() => ({ events: active?.events ?? noStoredEvents, coverage: active?.coverage ?? noCoverage, source: active?.source ?? null,
    loading, error: active?.error ?? null, collectorError: active?.collectorError ?? null }), [active, loading])
}
