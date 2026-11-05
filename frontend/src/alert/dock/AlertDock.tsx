import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AlertFocus } from '../model/alert-focus'
import { majorCurrencies } from '../../economic-calendar/forex/currencies'
import { useExternalSources } from '../../external-sources/useExternalSources'
import { OngoingRiskNotices } from '../../external-sources/OngoingRiskNotices'
import { setOngoingRiskVisibility, useOngoingRiskVisibility } from '../../external-sources/ongoing-risk-visibility'
import { CalendarBoundary, CalendarClock } from '../../inspector/CalendarClock'
import { readAlertPreferences, saveAlertPreferences, type AlertPreferences } from '../model/alert-preferences'
import { alertSeriesIds } from '../model/alert-format'
import { dayGroups, externalDate, jakartaDate, type AlertDayGroup } from '../model/alert-day-model'
import { AlertFiltersModal } from './AlertFiltersModal'
import { AlertDateSelector } from './AlertDateSelector'
import { useAlertDay } from './useAlertDay'
import { HighlightDock } from '../../events-alarms/HighlightDock'
import { AlarmControls } from '../../events-alarms/AlarmControls'
import { jakartaDisplay } from '../../events-alarms/alarm-time'
import type { useAlarms } from '../../events-alarms/useAlarms'
import { useAlertImpact } from '../impact/useAlertImpact'
import './alert-table.css'

const LegacyResearchBrowser = lazy(() => import('../highlights/LegacyResearchBrowser').then(module => ({ default: module.LegacyResearchBrowser })))

export const AlertDock = memo(function AlertDock({ sourceId, alarms, focusKey = null, focus = null }: {
  sourceId: string; alarms: ReturnType<typeof useAlarms>; focusKey?: string | null; focus?: AlertFocus | null
}) {
  const [date, setDate] = useState(() => jakartaDate(Date.now()))
  const [preferences, setPreferences] = useState(readAlertPreferences)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [legacyOpen, setLegacyOpen] = useState(false)
  const closeLegacy = useCallback(() => setLegacyOpen(false), [])
  const risksVisible = useOngoingRiskVisibility()
  const [riskPreferenceError, setRiskPreferenceError] = useState<string | null>(null)
  const [boundaryNow, setBoundaryNow] = useState(Date.now)
  const closeFilters = useCallback(() => setFiltersOpen(false), [])
  const updatePreferences = useCallback((next: AlertPreferences) => { setPreferences(next); saveAlertPreferences(next) }, [])
  const storage = useAlertDay(sourceId, date), external = useExternalSources('all', 'all')
  const impact = useAlertImpact(sourceId)
  const incoming = useMemo(() => focus ?? (focusKey ? { externalKey: focusKey, request: 0 } : null), [focus, focusKey])
  const [previousIncoming, setPreviousIncoming] = useState(incoming), [navigation, setNavigation] = useState<AlertFocus | null>(incoming)
  const [applied, setApplied] = useState<AlertFocus | null>(null)
  const scrolled = useRef<AlertFocus | null>(null), scrollport = useRef<HTMLDivElement>(null)
  if (previousIncoming !== incoming) {
    setPreviousIncoming(incoming); setNavigation(incoming); setLegacyOpen(false)
  }
  const focusItem = navigation?.externalKey ? external.items.find(item => item.key === navigation.externalKey) : null
  if (navigation && applied !== navigation && (!navigation.sourceId || navigation.sourceId === sourceId)
    && (!navigation.externalKey || focusItem)) {
    const targetDate = navigation.date ?? (focusItem ? externalDate(focusItem) : null)
    if (targetDate) setDate(targetDate)
    setPreferences(old => ({ ...old, currency: 'all', families: [...new Set([...old.families, ...(navigation.families ?? [])])] }))
    setApplied(navigation)
  }
  const groups = useMemo(() => dayGroups(storage.events, external.items, date, sourceId, preferences), [storage.events, external.items, date, sourceId, preferences])
  const undated = useMemo((): AlertDayGroup[] => external.items.filter(item => externalDate(item) === null
    && (item.visibility_scope === 'global' || preferences.currency === 'all' || item.currencies.includes(preferences.currency))).map(item => ({ key: `external:${item.key}`,
      title: item.title, currency: [...item.currencies, ...(item.instruments ?? [])].join(' / '), at: null, valueIds: [], external: [item] })), [external.items, preferences.currency])
  const selectedFocusKey = navigation?.externalKey ?? groups.find(group => navigation?.sourceId === sourceId
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
  }, [navigation, applied, selectedFocusKey, date, groups, undated])
  const riskItems = useMemo(() => external.items.filter(item => item.visibility_scope === 'global' || preferences.currency === 'all'
    || item.currencies.includes(preferences.currency)), [external.items, preferences.currency])
  const selectRisk = useCallback((key: string) => setNavigation(old => ({ externalKey: key, request: (old?.request ?? 0) + 1 })), [])
  const changeDate = useCallback((next: string) => { setNavigation(null); setDate(next); setLegacyOpen(false) }, [])
  const times = useMemo(() => groups.flatMap(group => group.at === null ? [] : [group.at, group.at + 1]), [groups])
  const selectedIds = useMemo(() => alertSeriesIds(preferences), [preferences])
  const partial = storage.coverage && Object.entries(storage.coverage).some(([currency, value]) =>
    (preferences.currency === 'all' || currency === preferences.currency) && value.missing.length > 0)
  return <CalendarClock><CalendarBoundary times={times} onBoundary={setBoundaryNow} timeDisplay={jakartaDisplay} />
    <div className="alert-date-dock">
      <header className="alert-date-header"><AlertDateSelector date={date} onChange={changeDate} />
        <nav className="events-currency-buttons" aria-label="Alert currency">{(['all', ...majorCurrencies] as const).map(currency =>
          <button type="button" key={currency} aria-pressed={preferences.currency === currency} onClick={() => { setLegacyOpen(false); updatePreferences({ ...preferences, currency }) }}>{currency === 'all' ? 'All' : currency}</button>)}</nav>
        <button type="button" aria-label="Alert filters" title={`${selectedIds.length} known series enabled`} onClick={() => { setLegacyOpen(false); setFiltersOpen(true) }}>Filters</button>
        <div className="alert-header-actions"><AlarmControls alarms={alarms} />
          <button type="button" aria-pressed={risksVisible} title="Show or hide ongoing risk notices in Alert and on charts; stars and alarms stay unchanged" onClick={() => {
            setRiskPreferenceError(setOngoingRiskVisibility(!risksVisible) ? null : 'Could not save ongoing-risk visibility. Browser storage is unavailable.')
          }}>Ongoing risks: {risksVisible ? 'shown' : 'hidden'}</button>
          <button type="button" aria-pressed={legacyOpen} onClick={() => setLegacyOpen(value => !value)}>Legacy pins &amp; research</button>
        </div>
      </header>
      {legacyOpen && <div className="alert-date-scroll"><Suspense fallback={<p role="status">Loading legacy research…</p>}><LegacyResearchBrowser onClose={closeLegacy} /></Suspense></div>}
      <div className="alert-date-scroll" ref={scrollport} hidden={legacyOpen}>
        <div className="alert-date-meta"><span>{date} · Jakarta · Pepperstone + named publishers</span></div>
        {riskPreferenceError && <p className="alert-feed-message" role="status">{riskPreferenceError}</p>}
        {(storage.error || external.error || alarms.error) && <p className="alert-feed-message" role="status">{storage.error ?? external.error ?? alarms.error}</p>}
        {impact.error && <p className="alert-feed-message" role="status">{impact.error} Calendar tiers remain available.</p>}
        {storage.source?.publisher_status === 'offline' && <p className="alert-feed-message" role="status">Pepperstone publisher offline · showing saved readings.</p>}
        {!storage.loading && !storage.source && !storage.error && <p role="status">No stored Pepperstone calendar. Start its publisher to populate this date.</p>}
        {partial && <p className="alert-feed-message" role="status">Partial calendar coverage for this date. Missing events may not have been captured.</p>}
        <OngoingRiskNotices items={riskItems} onSelect={selectRisk} />
        <div className="alert-table-scroll"><HighlightDock groups={groups} sourceId={sourceId} alarms={alarms} now={boundaryNow} date={date} focusKey={selectedFocusKey} focusRequest={navigation?.request} impact={impact} /></div>
        {!groups.length && <p className="alert-empty" role="status">{storage.loading || external.loading ? 'Loading events…' : 'No matching events in the available data for this date.'}</p>}
        {!!undated.length && <details className="alert-undated" open={undated.some(group => group.external.some(item => item.key === selectedFocusKey)) || undefined}>
          <summary>Undated items ({undated.length})</summary><p>No publication date is assumed for these saved watch items.</p>
          <div className="alert-table-scroll"><HighlightDock groups={undated} sourceId={sourceId} alarms={alarms} now={boundaryNow} focusKey={selectedFocusKey} focusRequest={navigation?.request} impact={impact} /></div>
        </details>}

      </div>
      {filtersOpen && <AlertFiltersModal preferences={preferences} onSave={next => updatePreferences({ ...preferences, families: next.families })} onClose={closeFilters} />}
    </div>
  </CalendarClock>
})
