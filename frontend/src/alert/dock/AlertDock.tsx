import { memo, useCallback, useMemo, useState } from 'react'
import { majorCurrencies } from '../../economic-calendar/forex/currencies'
import { useExternalSources } from '../../external-sources/useExternalSources'
import { ExternalFeedNotes } from '../../external-sources/ExternalSourcesDock'
import { CalendarBoundary, CalendarClock } from '../../inspector/CalendarClock'
import { readAlertPreferences, saveAlertPreferences, type AlertPreferences } from '../model/alert-preferences'
import { alertSeriesIds } from '../model/alert-episodes'
import { dayGroups, externalDate, jakartaDate, type AlertDayGroup } from '../model/alert-day-model'
import { AlertFiltersModal } from './AlertFiltersModal'
import { AlertDateSelector } from './AlertDateSelector'
import { useAlertDay } from './useAlertDay'
import { HighlightDock } from '../../events-alarms/HighlightDock'
import { AlarmControls } from '../../events-alarms/AlarmControls'
import { jakartaDisplay } from '../../events-alarms/alarm-time'
import type { useAlarms } from '../../events-alarms/useAlarms'
import { useAlertImpact } from '../impact/useAlertImpact'
import './alert-dock.css'
import './alert-table.css'

export const AlertDock = memo(function AlertDock({ sourceId, alarms, focusKey = null }: {
  sourceId: string; alarms: ReturnType<typeof useAlarms>; focusKey?: string | null
}) {
  const [date, setDate] = useState(() => jakartaDate(Date.now()))
  const [preferences, setPreferences] = useState(readAlertPreferences)
  const [filtersOpen, setFiltersOpen] = useState(false), [notesOpen, setNotesOpen] = useState(false)
  const [boundaryNow, setBoundaryNow] = useState(Date.now)
  const closeFilters = useCallback(() => setFiltersOpen(false), [])
  const updatePreferences = useCallback((next: AlertPreferences) => { setPreferences(next); saveAlertPreferences(next) }, [])
  const storage = useAlertDay(sourceId, date), external = useExternalSources('all', 'all')
  const impact = useAlertImpact(sourceId)
  const [focused, setFocused] = useState<string | null>(null)
  const focusItem = external.items.find(item => item.key === focusKey)
  if (focusItem && focused !== focusKey) {
    setFocused(focusKey)
    const item = focusItem
    const targetDate = externalDate(item)
    if (targetDate) setDate(targetDate)
    setPreferences(old => ({ ...old, currency: 'all' }))
  }
  const groups = useMemo(() => dayGroups(storage.events, external.items, date, sourceId, preferences), [storage.events, external.items, date, sourceId, preferences])
  const undated = useMemo((): AlertDayGroup[] => external.items.filter(item => externalDate(item) === null
    && (preferences.currency === 'all' || item.currencies.includes(preferences.currency))).map(item => ({ key: `external:${item.key}`,
      title: item.title, currency: item.currencies.join(' / '), at: null, valueIds: [], external: [item] })), [external.items, preferences.currency])
  const times = useMemo(() => groups.flatMap(group => group.at === null ? [] : [group.at, group.at + 1]), [groups])
  const selectedIds = useMemo(() => alertSeriesIds(preferences), [preferences])
  const partial = storage.coverage && Object.entries(storage.coverage).some(([currency, value]) =>
    (preferences.currency === 'all' || currency === preferences.currency) && value.missing.length > 0)
  return <CalendarClock><CalendarBoundary times={times} onBoundary={setBoundaryNow} timeDisplay={jakartaDisplay} />
    <div className="alert-date-dock">
      <header className="alert-date-header"><AlertDateSelector date={date} onChange={setDate} />
        <nav className="events-currency-buttons" aria-label="Alert currency">{(['all', ...majorCurrencies] as const).map(currency =>
          <button type="button" key={currency} aria-pressed={preferences.currency === currency} onClick={() => updatePreferences({ ...preferences, currency })}>{currency === 'all' ? 'All' : currency}</button>)}</nav>
        <button type="button" aria-label="Alert filters" title={`${selectedIds.length} known series enabled`} onClick={() => setFiltersOpen(true)}>Filters</button>
        <AlarmControls alarms={alarms} />
      </header>
      <div className="alert-date-meta"><span>{date} · Jakarta · Pepperstone + named publishers</span><button type="button" aria-expanded={notesOpen} onClick={() => setNotesOpen(value => !value)}>Feed notes</button></div>
      {notesOpen && <ExternalFeedNotes brokerId={sourceId} currency={preferences.currency} />}
      {(storage.error || external.error || alarms.error) && <p className="alert-feed-message" role="status">{storage.error ?? external.error ?? alarms.error}</p>}
      {impact.error && <p className="alert-feed-message" role="status">{impact.error} Showing saved assessments where available; other events remain Unreviewed.</p>}
      {storage.source?.publisher_status === 'offline' && <p className="alert-feed-message" role="status">Pepperstone publisher offline · showing saved readings.</p>}
      {!storage.loading && !storage.source && !storage.error && <p role="status">No stored Pepperstone calendar. Start its publisher to populate this date.</p>}
      {partial && <p className="alert-feed-message" role="status">Partial calendar coverage for this date. Missing events may not have been captured.</p>}
      <div className="alert-table-scroll"><HighlightDock groups={groups} sourceId={sourceId} alarms={alarms} now={boundaryNow} focusKey={focusKey} impact={impact} /></div>
      {!groups.length && <p className="alert-empty" role="status">{storage.loading || external.loading ? 'Loading events…' : 'No matching events in the available data for this date.'}</p>}
      {!!undated.length && <details className="alert-undated" open={undated.some(group => group.external.some(item => item.key === focusKey)) || undefined}>
        <summary>Undated items ({undated.length})</summary><p>No publication date is assumed for these saved watch items.</p>
        <div className="alert-table-scroll"><HighlightDock groups={undated} sourceId={sourceId} alarms={alarms} now={boundaryNow} focusKey={focusKey} impact={impact} /></div>
      </details>}
      {filtersOpen && <AlertFiltersModal preferences={preferences} onSave={next => updatePreferences({ ...preferences, families: next.families })} onClose={closeFilters} />}
    </div>
  </CalendarClock>
})
