import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { timeDisplayLabel, type TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import { isMajorCurrency, majorCurrencies, type MajorCurrency } from '../economic-calendar/forex/currencies'
import { DiscoveredLimitations } from './DiscoveredLimitations'
import { useExternalSources } from './useExternalSources'
import { ExternalRecordCard } from './ExternalRecordCard'
import { useExternalPin } from './useExternalPin'
import { externalIconEnabled, setExternalIconVisibility, useExternalIconVisibility } from './external-icon-visibility'
import { CalendarBoundary, CalendarClock } from '../inspector/CalendarClock'
import { sortExternalDates, type ExternalDateSort } from './external-schedule'
import type { ExternalSource } from './external-source-model'
import './external-sources.css'

function savedCurrency(): 'all' | MajorCurrency {
  try {
    const value = JSON.parse(localStorage.getItem('fyodor.external-sources.filters.v1') ?? '{}')
    return isMajorCurrency(value.currency) ? value.currency : 'all'
  } catch { return 'all' }
}
function savedSort(): ExternalDateSort {
  try {
    const value = localStorage.getItem('fyodor.external-sources.date-sort.v1')
    return value === 'earliest' || value === 'latest' ? value : 'upcoming'
  } catch { return 'upcoming' }
}
type DockProps = { brokerId?: string | null; timeDisplay: TimeDisplayPreference; symbol?: string; focusKey?: string | null; renderHeader?: (controls: ReactNode, currencies?: ReactNode) => ReactNode; renderAlarm?: (item: ExternalSource, now: number) => ReactNode; showPinControls?: boolean }
export function ExternalSourcesDock({ brokerId = null, focusKey = null, renderHeader, ...props }: DockProps) {
  const [view, setView] = useState<'events' | 'limitations'>(() => {
    try { return !focusKey && localStorage.getItem('fyodor.external-sources.view.v1') === 'limitations' ? 'limitations' : 'events' } catch { return 'events' }
  })
  const [currency, setCurrency] = useState<'all' | MajorCurrency>(() => focusKey ? 'all' : savedCurrency())
  const [savedFocus, setSavedFocus] = useState(focusKey)
  if (savedFocus !== focusKey) { setSavedFocus(focusKey); if (focusKey) { setView('events'); setCurrency('all') } }
  const changeCurrency = (next: 'all' | MajorCurrency) => { setCurrency(next); try { localStorage.setItem('fyodor.external-sources.filters.v1', JSON.stringify({ currency: next })) } catch { /* Retain session filter. */ } }
  const selector = <label>Show: <select aria-label="External Source view" value={view} onChange={event => {
    const next = event.target.value as typeof view; setView(next)
    try { localStorage.setItem('fyodor.external-sources.view.v1', next) } catch { /* Retain session view. */ }
  }}><option value="events">Events</option><option value="limitations">Discovered Limitations</option></select></label>
  const currencies = <nav aria-label="External Sources currency" className={renderHeader ? 'events-currency-buttons' : undefined}>{(['all', ...majorCurrencies] as const).map(value =>
    <button type="button" key={value} aria-pressed={currency === value} onClick={() => changeCurrency(value)}>{value === 'all' ? 'All' : value}</button>)}</nav>
  const header = (controls: ReactNode) => renderHeader ? renderHeader(<>{selector}{controls}</>, currencies) : <header>
    <div className="external-toolbar"><strong>External Sources</strong>{selector}{controls}<span className="external-timezone">{timeDisplayLabel(props.timeDisplay)}</span></div>{currencies}
  </header>
  return view === 'limitations' ? <section className="external-sources-dock" aria-label="External Sources">
    {header(null)}<DiscoveredLimitations brokerId={brokerId} currency={currency} />
  </section> : <ExternalEventsDock {...props} focusKey={focusKey} currency={currency} renderHeader={header} />
}
function ExternalEventsDock({ timeDisplay, focusKey = null, renderHeader, renderAlarm, showPinControls = false, currency }: Omit<DockProps, 'renderHeader'> & { currency: 'all' | MajorCurrency; renderHeader: (controls: ReactNode) => ReactNode }) {
  const [search, setSearch] = useState(''), [iconError, setIconError] = useState('')
  const [dateSort, setDateSort] = useState(savedSort)
  const [savedFocus, setSavedFocus] = useState<string | null>(null)
  if (savedFocus !== focusKey) {
    setSavedFocus(focusKey)
    if (focusKey) setSearch('')
  }
  const records = useExternalSources(currency, 'all')
  const pins = useExternalPin(records.refresh)
  const [now, setNow] = useState(Date.now)
  const times = useMemo(() => records.items.flatMap(item => item.event_at ? [Date.parse(item.event_at) + 1] : []), [records.items])
  const visibility = useExternalIconVisibility()
  const terms = useMemo(() => search.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean), [search])
  const filtered = useMemo(() => !terms.length ? records.items : records.items.filter(item => {
    const text = [item.title, item.key, ...item.currencies, item.kind, item.status, item.facts, item.interpretation,
      ...item.sources.flatMap(source => [source.label, source.locator])].join(' ').toLocaleLowerCase()
    return terms.every(term => text.includes(term))
  }), [records.items, terms])
  const items = useMemo(() => sortExternalDates(filtered, dateSort, now, timeDisplay), [filtered, dateSort, now, timeDisplay])
  const panel = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (focusKey) panel.current?.querySelector(`[data-external-key="${focusKey}"]`)?.scrollIntoView?.({ block: 'nearest' })
  }, [focusKey, records.items])
  const searchAndSort = <>
    <input type="search" aria-label="Search External Sources" placeholder="Search events, risks or sources" value={search} onChange={event => setSearch(event.target.value)} />
    <label className="external-date-sort">Date <select aria-label="Sort External Sources by date" value={dateSort} onChange={event => {
      const next = event.target.value as ExternalDateSort
      setDateSort(next)
      try { localStorage.setItem('fyodor.external-sources.date-sort.v1', next) } catch { /* Retain session sort. */ }
    }}><option value="upcoming">Upcoming first</option><option value="earliest">Earliest first</option><option value="latest">Latest first</option></select></label>
  </>
  return <CalendarClock><CalendarBoundary times={times} onBoundary={setNow} timeDisplay={timeDisplay} />
  <section ref={panel} className={`external-sources-dock${renderAlarm ? ' with-alarms' : ''}${showPinControls ? ' with-pins' : ''}`} aria-label="External Sources">
    {renderHeader(<>{searchAndSort}<button type="button" onClick={records.refresh}>Refresh</button></>)}
    {records.error && <p role="status">{records.error} {records.items.length ? 'Showing the last loaded records.' : ''}</p>}
    {iconError && <p role="status">{iconError}</p>}
    {pins.error && <p role="status">{pins.error}</p>}
    {records.loading && <p role="status">Loading External Sources…</p>}
    {!records.loading && !records.error && !items.length && <p role="status">{search ? 'No records match this search.' : 'No external records for this currency.'}</p>}
    <div className="external-records">
      {!!items.length && <div className="external-column-headings" aria-hidden="true"><span>Event / risk</span><span>Currency</span><span>Type / status</span><span>Date / time</span><span>Countdown</span>{renderAlarm && <span>Alarm</span>}{showPinControls && <span>Highlight</span>}<span>Chart visibility</span></div>}
      {items.map(item => <ExternalRecordCard key={item.key} item={item} timeDisplay={timeDisplay} focused={focusKey === item.key}
        now={now}
        alarm={renderAlarm?.(item, now)}
        pin={showPinControls && <button type="button" aria-label={`${item.archived ? 'Pin' : 'Unpin'} ${item.title}`} aria-pressed={!item.archived}
          disabled={pins.busy} onClick={() => void pins.changePin(item)} title={item.archived ? 'Pin to Highlight' : 'Remove from Highlight; retain saved research'}>{item.archived ? 'Pin' : 'Pinned'}</button>}
        iconVisible={externalIconEnabled(item, visibility)} onIconChange={visible => {
          setIconError(setExternalIconVisibility(item.key, visible, item.chart_icon_request_id ?? null) ? '' : 'Could not save chart visibility. Check browser storage and try again.')
        }} />)}
    </div>
  </section></CalendarClock>
}
