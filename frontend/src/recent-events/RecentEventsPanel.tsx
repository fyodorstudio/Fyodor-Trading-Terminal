import { memo, useEffect, useRef, useState } from 'react'
import { useDisplayClock } from '../appearance/time-display/useDisplayClock'
import { formatInspectorValue } from '../inspector/readings/reading-values'
import { useRecentEvents, type RecentDays, type EventPanelMode } from './useRecentEvents'
import './recent-events.css'

function age(at: number, now: number, upcoming: boolean) {
  const minutes = Math.max(0, Math.floor((upcoming ? at - now : now - at) / 60000))
  return minutes < 1 ? upcoming ? '<1m' : 'now' : minutes < 60 ? `${minutes}m` : minutes < 1440 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 1440)}d`
}

export const RecentEventsPanel = memo(function RecentEventsPanel({ brokerId, symbol, onClose }: {
  brokerId: string | null; symbol: string; onClose: () => void
}) {
  const [days, setDays] = useState<RecentDays>(3)
  const [mode, setMode] = useState<EventPanelMode>('upcoming')
  const upcoming = mode === 'upcoming'
  const { events, now, currencies, loading, error } = useRecentEvents(brokerId, symbol, days, mode)
  const clock = useDisplayClock()
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const element = panel.current
    element?.querySelector('select')?.focus()
    return () => { if (element?.contains(document.activeElement)) previous?.focus() }
  }, [])
  return <aside id="recent-events-panel" className="recent-events-panel" aria-labelledby="recent-events-title" ref={panel}
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <header><span className="recent-events-symbol">{symbol}</span><h2 id="recent-events-title">Events</h2>
      <select aria-label="Event range" value={days} onChange={event => setDays(Number(event.target.value) as RecentDays)}>
        {[3, 7, 14, 31].map(value => <option key={value} value={value}>{upcoming ? 'Next' : 'Last'} {value} Days</option>)}
      </select>
      <button type="button" aria-label="Close events" onClick={onClose}>×</button>
    </header>
    <div className="recent-events-body" role="tabpanel" id="event-panel-content" aria-labelledby={`event-panel-${mode}`}>
    {!brokerId ? <p>Connect a broker to view events.</p> : !currencies.length ? <p>No calendar currency scope for {symbol}.</p> : <>
      {error && <p role="alert">{error}</p>}
      {loading ? <p role="status">Loading events…</p> : <>
        <table aria-label={upcoming ? 'Upcoming events' : 'Recent events'}><thead><tr><th scope="col">{upcoming ? 'In' : 'Age'}</th><th scope="col">CUR</th><th scope="col">Event</th>
          <th scope="col" title="Actual / Forecast / Previous">A / F / P</th></tr></thead>
          <tbody>{events.map(event => <tr key={event.value_id}>
            <td><time dateTime={new Date(event.release_at!).toISOString()} title={clock.utc(event.release_at!)}>{age(event.release_at!, now, upcoming)}</time></td>
            <td>{event.currency}</td><td className="recent-events-name">{event.name}
              {event.availability === 'not-returned-by-latest-query' && <small>Latest observation unavailable</small>}</td>
            <td className="recent-events-values">{(['actual', 'forecast', 'previous'] as const).map((field, index) => {
              const impact = field === 'actual' && event.actual !== null
                && (event.impact === 'positive' || event.impact === 'negative') ? event.impact : undefined
              const title = impact ? `Actual · MT5: ${impact === 'positive' ? 'bullish' : 'bearish'} for ${event.currency}` : field
              return <span key={field} title={title} data-mt5-impact={impact}>
                <small>{['A', 'F', 'P'][index]}</small>{formatInspectorValue(event[field], event)}</span>
            })}</td>
          </tr>)}</tbody>
        </table>
        {!events.length && !error && <p>No timed events in the {upcoming ? 'next' : 'last'} {days} days.</p>}
      </>}
    </>}
    </div>
    <footer className="event-panel-tabs" role="tablist" aria-label="Event view">
      {(['upcoming', 'recent'] as const).map((view, index) => <button key={view} type="button" role="tab"
        id={`event-panel-${view}`} aria-controls="event-panel-content" aria-selected={mode === view}
        tabIndex={mode === view ? 0 : -1} onClick={() => setMode(view)} onKeyDown={event => {
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1
            : event.key === 'ArrowLeft' || event.key === 'ArrowRight' ? 1 - index : null
          if (next === null) return
          event.preventDefault()
          setMode(next === 0 ? 'upcoming' : 'recent')
          event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
        }}>{view === 'upcoming' ? 'Upcoming' : 'Recent'}</button>)}
    </footer>
  </aside>
})
