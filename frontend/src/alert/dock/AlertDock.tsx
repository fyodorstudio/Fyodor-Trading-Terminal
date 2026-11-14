import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AlertFocus } from '../model/alert-focus'
import { majorCurrencies } from '../../economic-calendar/forex/currencies'
import { CalendarBoundary, CalendarClock } from '../../inspector/CalendarClock'
import { readAlertPreferences, saveAlertPreferences, type AlertPreferences } from '../model/alert-preferences'
import { alertSeriesIds } from '../model/alert-format'
import { dayGroups, jakartaDate } from '../model/alert-day-model'
import { AlertFiltersModal } from './AlertFiltersModal'
import { AlertDateSelector } from './AlertDateSelector'
import { useAlertDay } from './useAlertDay'
import { AlertCalendarTable } from '../../events-alarms/AlertCalendarTable'
import { AlarmControls } from '../../events-alarms/AlarmControls'
import { jakartaDisplay } from '../../events-alarms/alarm-time'
import type { useAlarms } from '../../events-alarms/useAlarms'
import './alert-table.css'

export const AlertDock = memo(function AlertDock({ sourceId, alarms, focus = null }: {
  sourceId: string; alarms: ReturnType<typeof useAlarms>; focus?: AlertFocus | null
}) {
  const [date, setDate] = useState(() => jakartaDate(Date.now()))
  const [preferences, setPreferences] = useState(readAlertPreferences)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [boundaryNow, setBoundaryNow] = useState(Date.now)
  const closeFilters = useCallback(() => setFiltersOpen(false), [])
  const updatePreferences = useCallback((next: AlertPreferences) => { setPreferences(next); saveAlertPreferences(next) }, [])
  const storage = useAlertDay(sourceId, date)
  const incoming = focus
  const [previousIncoming, setPreviousIncoming] = useState(incoming), [navigation, setNavigation] = useState<AlertFocus | null>(incoming)
  const [applied, setApplied] = useState<AlertFocus | null>(null)
  const scrolled = useRef<AlertFocus | null>(null), scrollport = useRef<HTMLDivElement>(null)
  if (previousIncoming !== incoming) {
    setPreviousIncoming(incoming); setNavigation(incoming)
  }
  if (navigation && applied !== navigation && (!navigation.sourceId || navigation.sourceId === sourceId)) {
    if (navigation.date) setDate(navigation.date)
    setPreferences(old => ({ ...old, currency: 'all', families: [...new Set([...old.families, ...(navigation.families ?? [])])] }))
    setApplied(navigation)
  }
  const groups = useMemo(() => dayGroups(storage.events, preferences), [storage.events, preferences])
  const selectedFocusKey = groups.find(group => navigation?.sourceId === sourceId
    && navigation.valueIds?.some(id => group.valueIds.includes(id)))?.key ?? null
  useEffect(() => {
    if (!navigation || scrolled.current === navigation || applied !== navigation || !selectedFocusKey) return
    if (navigation.date && navigation.date !== date) return
    const frame = window.requestAnimationFrame(() => {
      const port = scrollport.current, target = port?.querySelector<HTMLElement>('[data-alert-focused="true"]')
      if (!port || !target) return
      // Only the dock scrolls. Read layout once after details/date data are committed.
      const top = port.scrollTop + target.getBoundingClientRect().top - port.getBoundingClientRect().top - 12
      port.scrollTo({ top: Math.max(0, top), behavior: 'auto' })
      scrolled.current = navigation
    })
    return () => window.cancelAnimationFrame(frame)
  }, [navigation, applied, selectedFocusKey, date, groups])
  const changeDate = useCallback((next: string) => { setNavigation(null); setDate(next) }, [])
  const times = useMemo(() => groups.flatMap(group => group.at === null ? [] : [group.at, group.at + 1]), [groups])
  const selectedIds = useMemo(() => alertSeriesIds(preferences), [preferences])
  const partial = storage.coverage && Object.entries(storage.coverage).some(([currency, value]) =>
    (preferences.currency === 'all' || currency === preferences.currency) && value.missing.length > 0)
  return <CalendarClock><CalendarBoundary times={times} onBoundary={setBoundaryNow} timeDisplay={jakartaDisplay} />
    <div className="alert-date-dock">
      <header className="alert-date-header"><AlertDateSelector date={date} onChange={changeDate} />
        <nav className="events-currency-buttons" aria-label="Alert currency">{(['all', ...majorCurrencies] as const).map(currency =>
          <button type="button" key={currency} aria-pressed={preferences.currency === currency} onClick={() => { updatePreferences({ ...preferences, currency }) }}>{currency === 'all' ? 'All' : currency}</button>)}</nav>
        <button type="button" aria-label="Alert filters" title={`${selectedIds.length} known series enabled`} onClick={() => { setFiltersOpen(true) }}>Filters</button>
        <div className="alert-header-actions"><AlarmControls alarms={alarms} />
        </div>
      </header>
      <div className="alert-date-scroll" ref={scrollport}>
        <div className="alert-date-meta"><span>{date} · Jakarta · MT5 calendar</span></div>
        {(storage.error || alarms.error) && <p className="alert-feed-message" role="status">{storage.error ?? alarms.error}</p>}
        {storage.source?.publisher_status === 'offline' && <p className="alert-feed-message" role="status">Pepperstone publisher offline · showing saved readings.</p>}
        {!storage.loading && !storage.source && !storage.error && <p role="status">No stored Pepperstone calendar. Start its publisher to populate this date.</p>}
        {partial && <p className="alert-feed-message" role="status">Partial calendar coverage for this date. Missing events may not have been captured.</p>}
        <div className="alert-table-scroll"><AlertCalendarTable groups={groups} sourceId={sourceId} alarms={alarms} now={boundaryNow} date={date} focusKey={selectedFocusKey} focusRequest={navigation?.request} /></div>
        {!groups.length && <p className="alert-empty" role="status">{storage.loading ? 'Loading events…' : 'No matching events in the available data for this date.'}</p>}


      </div>
      {filtersOpen && <AlertFiltersModal preferences={preferences} onSave={next => updatePreferences({ ...preferences, families: next.families })} onClose={closeFilters} />}
    </div>
  </CalendarClock>
})
