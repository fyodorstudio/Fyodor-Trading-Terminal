import { memo, useMemo, useState, type ReactNode } from 'react'
import { HighlightCard } from '../alert/highlights/HighlightList'
import { useHighlights } from '../alert/highlights/useHighlights'
import { readAlertPreferences, saveAlertPreferences, readHighlightVisibility, saveHighlightVisibility, type HighlightVisibility } from '../alert/model/alert-preferences'
import { majorCurrencies } from '../economic-calendar/forex/currencies'
import { displayDateKey } from '../economic-calendar/time/calendar-display-range'
import type { InspectorRelease } from '../economic-calendar/releases/release'
import { useExternalSources } from '../external-sources/useExternalSources'
import { useExternalPin } from '../external-sources/useExternalPin'
import type { ExternalDateSort } from '../external-sources/external-schedule'
import { CalendarBoundary, CalendarClock } from '../inspector/CalendarClock'
import { ExternalHighlightCard } from './ExternalHighlightCard'
import { EventAlarmButton } from './EventAlarmButton'
import { jakartaDisplay } from './alarm-time'
import type { useAlarms } from './useAlarms'

export const HighlightDock = memo(function HighlightDock({ brokerId, alarms, renderHeader, onPrepareResearch }: {
  brokerId: string | null; alarms: ReturnType<typeof useAlarms>; onPrepareResearch?: (release: InspectorRelease) => void
  renderHeader: (controls: ReactNode, currencies: ReactNode) => ReactNode
}) {
  const [preferences, setPreferences] = useState(readAlertPreferences)
  const [visibility, setVisibility] = useState(readHighlightVisibility)
  const [order, setOrder] = useState<ExternalDateSort>(() => {
    try { const value = localStorage.getItem('fyodor.highlight.date-sort.v1'); return value === 'earliest' || value === 'latest' ? value : 'upcoming' } catch { return 'upcoming' }
  })
  const highlights = useHighlights(brokerId, 2000, visibility === 'archived' ? 'archived' : 'active')
  const external = useExternalSources('all', 'all')
  const pins = useExternalPin(external.refresh)
  const [now, setNow] = useState(Date.now)
  const times = useMemo(() => [...highlights.items.flatMap(item => item.events.flatMap(event =>
    event.time_mode === 0 && event.release_at !== null ? [event.release_at, event.release_at + 1] : [])),
    ...external.items.flatMap(item => item.event_at ? [Date.parse(item.event_at), Date.parse(item.event_at) + 1] : [])], [highlights.items, external.items])
  const rows = useMemo(() => {
    const currency = preferences.currency
    const calendar = highlights.items.filter(item => currency === 'all' || item.currency === currency).map(item => {
      const future = item.events.filter(event => event.time_mode === 0 && event.release_at !== null && event.release_at > now).map(event => event.release_at!)
      const at = future.length ? Math.min(...future) : item.release_at
      return { key: `mt5:${item.id}`, source: 'mt5' as const, item, at,
        date: at !== null ? displayDateKey(at, jakartaDisplay) : item.server_time === null ? null : new Date(item.server_time * 1000).toISOString().slice(0, 10) }
    })
    const outside = external.items.filter(item => item.archived === (visibility === 'archived') && (currency === 'all' || item.currencies.includes(currency))).map(item => {
      const at = item.event_at ? Date.parse(item.event_at) : null
      return { key: `external:${item.key}`, source: 'external' as const, item, at, date: at !== null ? displayDateKey(at, jakartaDisplay) : item.event_date }
    })
    const today = displayDateKey(now, jakartaDisplay)
    return [...calendar, ...outside].sort((a, b) => {
      if (!a.date || !b.date) return a.date ? -1 : b.date ? 1 : a.key.localeCompare(b.key)
      const futureA = a.at !== null ? a.at >= now : a.date >= today, futureB = b.at !== null ? b.at >= now : b.date >= today
      if (order === 'upcoming' && futureA !== futureB) return futureA ? -1 : 1
      const comparison = a.date.localeCompare(b.date) || (a.at !== null && b.at !== null ? a.at - b.at : a.at === null ? b.at === null ? 0 : -1 : 1)
      return ((order === 'latest' || order === 'upcoming' && !futureA) ? -comparison : comparison) || a.key.localeCompare(b.key)
    })
  }, [highlights.items, external.items, preferences.currency, visibility, order, now])
  return <CalendarClock><CalendarBoundary times={times} onBoundary={setNow} timeDisplay={jakartaDisplay} />
  <section className="alert-dock highlight-dock" aria-label="Highlight">
    {renderHeader(<>
      <label>Show: <select aria-label="Highlight view" value={visibility} onChange={event => {
        const next = event.target.value as HighlightVisibility; setVisibility(next); saveHighlightVisibility(next)
      }}><option value="active">Active</option><option value="archived">Archived</option></select></label>
      <label>Date <select aria-label="Sort Highlight by date" value={order} onChange={event => {
        const next = event.target.value as ExternalDateSort; setOrder(next)
        try { localStorage.setItem('fyodor.highlight.date-sort.v1', next) } catch { /* Retain session order. */ }
      }}><option value="upcoming">Upcoming first</option><option value="earliest">Earliest first</option><option value="latest">Latest first</option></select></label>
    </>, <nav className="events-currency-buttons" aria-label="Highlight currency">{(['all', ...majorCurrencies] as const).map(currency =>
      <button type="button" key={currency} aria-pressed={preferences.currency === currency} onClick={() => {
        const next = { ...preferences, currency }; setPreferences(next); saveAlertPreferences(next)
      }}>{currency === 'all' ? 'All' : currency}</button>)}</nav>)}
    <>
      {highlights.error && <p role="status">MT5 Calendar: {highlights.error}</p>}
      {highlights.offline && <p role="status">MT5 publisher offline · stored values may be stale</p>}
      {!brokerId && <p role="status">Connect calendar storage to load MT5 pins.</p>}
      {external.error && <p role="status">External Source: {external.error}</p>}
      {pins.error && <p role="status">{pins.error}</p>}
      {external.loading && <p role="status">Loading External Source pins…</p>}
      {!rows.length && !external.loading && <p>{visibility === 'archived' ? 'No archived Highlights for this currency.' : 'Pin events from MT5 Calendar or External Source to keep them here.'}</p>}
      <div className="highlight-list unified-highlight-list" aria-label="Highlighted releases">{rows.map(row => row.source === 'mt5' ?
        <HighlightCard key={row.key} item={row.item} now={now} timeDisplay={jakartaDisplay} sourceLabel="MT5 Calendar"
          archive={highlights.archive} restore={highlights.restore} busy={highlights.busy} onPrepareResearch={onPrepareResearch}
          alarm={<EventAlarmButton alarms={alarms} source="highlight" reference={row.item.id} broker={row.item.source_id} title={row.item.label} now={now} archived={!!row.item.archived_utc} />} /> :
        <ExternalHighlightCard key={row.key} item={row.item} now={now} busy={pins.busy} changePin={pins.changePin}
          alarm={<EventAlarmButton alarms={alarms} source="external" reference={row.item.key} title={row.item.title} now={now} archived={row.item.archived} />} />)}</div>
    </>
  </section></CalendarClock>
})
