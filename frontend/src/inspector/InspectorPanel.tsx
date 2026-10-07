import { currencyColorStyle } from './currency-colors'
import { useId, useMemo, useState } from 'react'
import { type TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import type { CalendarSourceHealth } from '../system-connectivity/bridge-status/bridge-contract'
import { type InspectorRelease } from './inspector-data'
import { InspectorFiltersModal } from './InspectorFiltersModal'
import { InspectorDateRangePicker } from './InspectorDateRangePicker'
import { InspectorReleaseHeading } from './InspectorReleaseHeading'
import { InspectorInfoTooltip } from './InspectorInfoTooltip'
import { ismSourceRelease } from './episodes/ism-episodes'
import { matchesReadingFamily } from './grading/reading-grading'
import { magnitudeFamilies } from './magnitude/magnitude-families'
import { InspectorScoringView } from './scoring/InspectorScoringView'
import { inspectorScoringBinding } from './scoring/scoring-registry'
import type { InspectorView } from './useInspector'
import { InspectorReleaseList } from './releases/InspectorReleaseList'
import { releaseStatus } from './releases/release-status'
import { InspectorReadingsTable } from './readings/InspectorReadingsTable'
import './inspector.css'
import { normalizeInspectorDetailView } from './inspector-detail-view'
import { ComboInspector } from '../usd-context/sequences/ui/ComboInspector'
import type { ComboSnapshot, ComboSource } from '../usd-context/sequences/core/contracts'

function HistogramIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="1.5" y="8.5" width="2.5" height="5.5" rx="0.5" />
      <rect x="5.25" y="2" width="2.5" height="12" rx="0.5" />
      <rect x="9" y="5" width="2.5" height="9" rx="0.5" />
      <rect x="12.75" y="8.5" width="2.5" height="5.5" rx="0.5" />
    </svg>
  )
}

function sourceLabel(source: CalendarSourceHealth | null, error: string | null): string {
  if (error) return error
  if (!source) return 'Waiting for the local bridge'
  if (source.status === 'live') return 'MT5 calendar live'
  if (source.status === 'stale') return 'Calendar publisher stale'
  if (source.status === 'awaiting-snapshot') return 'Receiving calendar snapshot'
  return 'Waiting for the calendar publisher'
}
export function InspectorPanel({ view, symbol, source, error, timeDisplay, onOpenScatter, scatterAvailable = true, combo, onCloseCombo, onOpenComboRelease }: {
  combo?: ComboSnapshot | null; onCloseCombo?: () => void; onOpenComboRelease?: (source: ComboSource) => void;
  view: InspectorView; symbol: string; source: CalendarSourceHealth | null; error: string | null
  timeDisplay: TimeDisplayPreference
  onOpenScatter?: (release: InspectorRelease) => void; scatterAvailable?: boolean
}) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [listOpen, setListOpen] = useState(true)
  const panelId = useId()
  const release = view.selectedRelease
  const scoringEvents = useMemo(() => view.allReleases.flatMap((item) => item.events), [view.allReleases])
  const scoreRelease = ismSourceRelease(release, null, view.now)
  const magnitudeFamily = magnitudeFamilies.find((family) => matchesReadingFamily(release, family)) ?? null
  const hasMagnitude = !!magnitudeFamily && !!release?.events.some((event) => Object.hasOwn(magnitudeFamily.readingRules, event.event_id))
  const scoringBinding = inspectorScoringBinding(symbol, scoreRelease)
  const showScoring = normalizeInspectorDetailView(view.preferences.detailView) === 'scoring' && !!scoringBinding
  const visibleView = showScoring ? 'scoring' : 'table'
  const status = (item: InspectorRelease) => releaseStatus(item, view.now + (view.brokerTime ? view.brokerOffsetSeconds * 1000 : 0), view.brokerTime)
  const storageStatus = view.storage.loading ? 'Loading stored calendar' : view.storage.error ??
    (view.storage.source ? 'Stored calendar available' : 'Waiting for the broker calendar')
  const calendarDetail = view.brokerTime ? storageStatus : sourceLabel(source, error)
  const calendarLoading = view.brokerTime ? view.storage.loading : source?.status === 'awaiting-snapshot'
  const missingCoverage = Object.entries(view.storage.coverage).filter(([, coverage]) => coverage.missing.length).map(([currency]) => currency)
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
  if (combo && onCloseCombo && onOpenComboRelease) return <ComboInspector combo={combo} symbol={symbol} timeDisplay={timeDisplay}
    onClose={onCloseCombo} onOpenRelease={onOpenComboRelease} />
  return <section className="inspector-panel" style={currencyColorStyle(view.preferences.currencyColors)} aria-label="Inspector">
    <header className="inspector-header">
      <div className="inspector-header-sidebar">
        <button type="button" className="inspector-pair-toggle" aria-expanded={listOpen} aria-controls={`${panelId}-releases`}
          title={`${view.releases.length} releases`} onClick={() => setListOpen((open) => !open)}>
          <strong>{symbol}</strong>
        </button>
        <button type="button" disabled={!view.supported} aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>Filters</button>
        <InspectorDateRangePicker view={view} />
        {view.supported && <button type="button" className="inspector-histogram-btn" aria-pressed={view.preferences.showHistograms}
          title={view.preferences.showHistograms ? 'Hide histogram' : 'Show histogram'}
          aria-label={view.preferences.showHistograms ? 'Hide histogram' : 'Show histogram'}
          onClick={() => view.applyPreferences({ ...view.preferences, showHistograms: !view.preferences.showHistograms })}>
          <HistogramIcon />
          <span className="inspector-sr-only">{view.preferences.showHistograms ? 'Hide histogram' : 'Show histogram'}</span>
        </button>}
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
        status={status(release)} sharedPeriod={sharedPeriod} hasMagnitude={hasMagnitude} calendarDetail={calendarDetail} coverageDetail={coverageDetail} />}
      {view.supported && release && <select className="inspector-view-select" aria-label="Inspector view"
        value={visibleView} onChange={(event) => {
          const next = event.target.value
          if (next === 'scatter') {
            // Scatter is navigation; keep the selected Inspector view when returning.
            event.target.value = visibleView
            if (hasMagnitude && scatterAvailable && onOpenScatter) onOpenScatter(scoreRelease ?? release)
          } else if (next === 'table' || (next === 'scoring' && scoringBinding)) {
            view.applyPreferences({ ...view.preferences, detailView: next })
          }
        }}>
        <option value="table">Table only</option>
        <option value="scoring" disabled={!scoringBinding}>Scoring system{scoringBinding ? ` · ${scoringBinding.versionLabel}` : ''}</option>
        <option value="scatter" disabled={!hasMagnitude || !scatterAvailable || !onOpenScatter}>Scatter Plot</option>
      </select>}

    </header>
    {!view.supported ? <p className="inspector-empty">Inspector currently supports EURUSD. Select EURUSD to inspect monetary policy, inflation, labor/wages and growth/activity releases.</p> : <>
      <div className={`inspector-body${listOpen ? '' : ' releases-collapsed'}`}>
        <InspectorReleaseList id={`${panelId}-releases`} hidden={!listOpen} releases={view.releases}
          selectedId={release?.id ?? null} symbols={view.preferences.symbols} timeDisplay={timeDisplay}
          brokerTime={view.brokerTime} now={view.now + (view.brokerTime ? view.brokerOffsetSeconds * 1000 : 0)} onSelect={view.selectRelease} />
        <div className="inspector-detail" aria-live="polite">
          {!release ? <p className="inspector-empty">Click a chart symbol or select a release to inspect Actual, Previous and A−P.</p> : <>
            {showScoring && scoringBinding ? <InspectorScoringView binding={scoringBinding} release={release}
              brokerId={view.brokerId} events={scoringEvents} now={view.now} timeDisplay={timeDisplay}
              onOpenScatter={scatterAvailable ? onOpenScatter : undefined} /> :
            <InspectorReadingsTable release={release} view={view} timeDisplay={timeDisplay} sharedPeriod={sharedPeriod} />}
          </>}
        </div>
      </div>
    </>}
    {filtersOpen && <InspectorFiltersModal preferences={view.preferences} onApply={view.applyPreferences} onClose={() => setFiltersOpen(false)} />}
  </section>
}
