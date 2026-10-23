import type { InspectorRelease } from '../economic-calendar/releases/release'
import { currencyColorStyle } from './currency-colors'
import { useCallback, useEffect, useId, useState } from 'react'
import { type TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import type { CalendarSourceHealth } from '../system-connectivity/bridge-status/bridge-contract'
import { chartEventCurrencies as inspectorPairCurrencies } from '../economic-calendar/forex/chart-event-scope'
import { InspectorFiltersModal } from './InspectorFiltersModal'
import { InspectorDateRangePicker } from './InspectorDateRangePicker'
import { inspectorPopoversFit } from './inspector-popover-layout'
import { InspectorReleaseHeading } from './InspectorReleaseHeading'
import { InspectorInfoTooltip } from './InspectorInfoTooltip'
import type { InspectorView } from './useInspector'
import { InspectorReleaseList } from './releases/InspectorReleaseList'
import { releaseStatus } from './releases/release-status'
import { InspectorReadingsTable } from './readings/InspectorReadingsTable'
import { InspectorDayTable } from './readings/InspectorDayTable'
import './inspector.css'
import { InspectorPin } from '../alert/highlights/InspectorPin'

function sourceLabel(source: CalendarSourceHealth | null, error: string | null): string {
  if (error) return error
  if (!source) return 'Waiting for the local bridge'
  if (source.status === 'live') return 'MT5 calendar live'
  if (source.status === 'stale') return 'Calendar publisher stale'
  if (source.status === 'awaiting-snapshot') return 'Receiving calendar snapshot'
  return 'Waiting for the calendar publisher'
}
export function InspectorPanel({ view, symbol, source, error, timeDisplay }: {
  view: InspectorView; symbol: string; source: CalendarSourceHealth | null; error: string | null
  timeDisplay: TimeDisplayPreference
}) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const changeCalendarOpen = useCallback((open: boolean) => {
    if (open && !inspectorPopoversFit(window.innerWidth)) setFiltersOpen(false)
    setCalendarOpen(open)
  }, [])
  useEffect(() => {
    const resize = () => { if (filtersOpen && !inspectorPopoversFit(window.innerWidth)) setCalendarOpen(false) }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [filtersOpen])
  const [listOpen, setListOpen] = useState(false)
  const panelId = useId()
  const release = view.selectedRelease
  const status = (item: InspectorRelease) => releaseStatus(item, view.now)
  const storageStatus = view.storage.loading ? 'Loading stored calendar' : view.storage.error ??
    (view.storage.source ? 'Stored calendar available' : 'Waiting for the broker calendar')
  const calendarDetail = view.brokerTime ? storageStatus : sourceLabel(source, error)
  const calendarLoading = view.brokerTime ? view.storage.loading : source?.status === 'awaiting-snapshot'
  const pairCurrencies: readonly string[] = inspectorPairCurrencies(symbol)
  const missingCoverage = Object.entries(view.storage.coverage).filter(([currency, coverage]) => pairCurrencies.includes(currency) && coverage.missing.length).map(([currency]) => currency)
  const coverageDetail = view.brokerTime && missingCoverage.length > 0 ?
    `Coverage pending for ${missingCoverage.join(' and ')} in this range; stored readings remain available.` : null
  const unplaced = view.releases.filter((item) => item.chartTime === null).length
  const sharedPeriod = release?.events.length && release.events[0].period_seconds > 0 &&
    release.events.every((event) => event.period_seconds === release.events[0].period_seconds) ? release.events[0].period_seconds : null
  const coverageStart = source?.window_from_server_seconds
  const coverageEnd = source?.window_to_server_seconds
  const offset = source?.server_utc_offset_seconds
  const hasCoverage = coverageStart != null && coverageEnd != null && offset != null
  const outsideCoverage = !view.brokerTime && hasCoverage && view.range && (view.range.from < (coverageStart - offset) * 1000 || view.range.to > (coverageEnd - offset) * 1000)
  return <section className="inspector-panel" style={currencyColorStyle(view.preferences.currencyColors)} aria-label="Inspector">
    <header className="inspector-header">
      <div className="inspector-header-sidebar">
        <button type="button" className="inspector-pair-toggle" aria-expanded={listOpen} aria-controls={`${panelId}-releases`}
          title={`${view.releases.length} ${view.preferences.symbolGrouping === 'day' ? 'daily entries' : 'releases'}`} onClick={() => setListOpen((open) => !open)}>
          <strong>{symbol}</strong>
        </button>
        <button type="button" data-inspector-filter-trigger disabled={!view.supported} aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => {
          if (!inspectorPopoversFit(window.innerWidth)) setCalendarOpen(false)
          setFiltersOpen(true)
        }}>Filters</button>
        <InspectorDateRangePicker view={view} open={calendarOpen} onOpenChange={changeCalendarOpen} filtersOpen={filtersOpen} />
      </div>
      {view.supported && <div className="inspector-context">
        {calendarLoading && <span role="status" title={calendarDetail}>Loading</span>}
        {!release && <InspectorInfoTooltip label="Calendar information" placement="right">
          <span className="inspector-info-line">{calendarDetail}</span>
          {coverageDetail && <span className="inspector-info-line">{coverageDetail}</span>}
        </InspectorInfoTooltip>}
        {view.storage.error && <span role="alert" title={view.storage.error}>Calendar unavailable</span>}
        {view.storageFailed && <span role="alert">Inspector settings could not be saved in this browser.</span>}
        {!view.range && <span role="alert">Choose a valid date range with the start before or on the end date.</span>}
        {view.brokerTime && view.storage.collectorError && <span role="alert">Live collection delayed: {view.storage.collectorError}</span>}
        {view.brokerTime && unplaced > 0 && <span>{unplaced} releases have no verified chart time; they remain available in the list.</span>}
        {outsideCoverage && <span>Part of this range is outside the available calendar coverage.</span>}
      </div>}
      {view.supported && release && <InspectorReleaseHeading release={release} view={view} timeDisplay={timeDisplay}
        status={status(release)} sharedPeriod={sharedPeriod} calendarDetail={calendarDetail} coverageDetail={coverageDetail} />}
      {view.supported && release && <InspectorPin release={release} brokerId={view.brokerId ?? null} />}
    </header>
    {!view.supported ? <p className="inspector-empty">Select a supported forex pair, currency index, Japan 225 or USD gold chart to inspect releases.</p> : <>
      <div className={`inspector-body${listOpen ? '' : ' releases-collapsed'}`}>
        <InspectorReleaseList id={`${panelId}-releases`} hidden={!listOpen} releases={view.releases}
          selectedId={release?.id ?? null} symbols={view.preferences.symbols} timeDisplay={timeDisplay}
          now={view.now} onSelect={view.selectRelease} />
        <div className="inspector-detail" aria-live="polite">
          {!release ? <p className="inspector-empty">Click a chart symbol or select a release to inspect Actual, Previous and A−P.</p> :
            release.daily ? <InspectorDayTable release={release} timeDisplay={timeDisplay} /> :
            <InspectorReadingsTable release={release} timeDisplay={timeDisplay} sharedPeriod={sharedPeriod} />}

        </div>
      </div>
    </>}
    {filtersOpen && <InspectorFiltersModal key={symbol} symbol={symbol} preferences={view.preferences} onApply={view.applyPreferences} onClose={() => setFiltersOpen(false)} />}
  </section>
}
