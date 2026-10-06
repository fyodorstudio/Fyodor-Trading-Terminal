import { currencyColorStyle } from './currency-colors'
import { useId, useState } from 'react'
import { formatAppTimestamp, type TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import type { CalendarSourceHealth } from '../system-connectivity/bridge-status/bridge-contract'
import { symbolGlyph } from './event-symbols'
import { formatInspectorValue, hasRevisedPreviousChange, inspectorDelta, inspectorSurprise, isInspectorCommentary, supportsInspector, type InspectorRelease } from './inspector-data'
import { InspectorFiltersModal } from './InspectorFiltersModal'
import { InspectorDateRangePicker } from './InspectorDateRangePicker'
import { InspectorReleaseHeading } from './InspectorReleaseHeading'
import { InspectorInfoTooltip } from './InspectorInfoTooltip'
import { InspectorReadingTime } from './InspectorReadingTime'
import { policyEpisodeRule } from './episodes/policy-episodes'
import { ismSourceRelease } from './episodes/ism-episodes'
import { useFamilyMagnitudeHistory } from './magnitude/useFamilyMagnitudeHistory'
import { gradePolicyRateDecision } from './grading/policy-rate-grading'
import { gradeLabels, gradeFamilyReading, matchesReadingFamily, revisedFamilyComparison } from './grading/reading-grading'
import { magnitudeFamilies } from './magnitude/magnitude-families'
import { FamilyMagnitudeCell } from './magnitude/FamilyMagnitudeCell'
import { InspectorScoringView } from './scoring/InspectorScoringView'
import { inspectorScoringBinding } from './scoring/scoring-registry'
import { supportsCpiV2 } from './scoring/PAIR/EURUSD/USD/CPI/assessment/cpi-score-v2'
import { CpiScoreV2 } from './scoring/PAIR/EURUSD/USD/CPI/ui/CpiScoreV2'
import { supportsCpiV3 } from './scoring/PAIR/EURUSD/USD/CPI/assessment/cpi-score-v3'
import { CpiScoreV3 } from './scoring/PAIR/EURUSD/USD/CPI/ui/CpiScoreV3'
import { supportsNfpV2 } from './scoring/PAIR/EURUSD/USD/NFP/assessment/nfp-score-v2'
import { NfpScoreV2 } from './scoring/PAIR/EURUSD/USD/NFP/ui/NfpScoreV2'
import { supportsIsmV2 } from './scoring/PAIR/EURUSD/USD/ISM/assessment/ism-score-v2'
import { IsmScoreV2 } from './scoring/PAIR/EURUSD/USD/ISM/ui/IsmScoreV2'
import type { InspectorView } from './useInspector'
import './inspector.css'

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

function releaseStatus(release: InspectorRelease, now: number, brokerTime = false): string {
  if (release.events.some((event) => event.actual !== null)) return 'Released'
  if ((brokerTime ? release.serverTime * 1000 : release.releaseAt ?? 0) > now) return 'Upcoming'
  if (release.events.every(isInspectorCommentary)) return 'Commentary'
  return 'Awaiting actual'
}
function sourceLabel(source: CalendarSourceHealth | null, error: string | null): string {
  if (error) return error
  if (!source) return 'Waiting for the local bridge'
  if (source.status === 'live') return 'MT5 calendar live'
  if (source.status === 'stale') return 'Calendar publisher stale'
  if (source.status === 'awaiting-snapshot') return 'Receiving calendar snapshot'
  return 'Waiting for the calendar publisher'
}
export function InspectorPanel({ view, symbol, source, error, timeDisplay, onOpenScatter, scatterAvailable = true }: {
  view: InspectorView; symbol: string; source: CalendarSourceHealth | null; error: string | null
  timeDisplay: TimeDisplayPreference
  onOpenScatter?: (release: InspectorRelease) => void; scatterAvailable?: boolean
}) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [listOpen, setListOpen] = useState(true)
  const panelId = useId()
  const release = view.selectedRelease
  const [ismSelection, setIsmSelection] = useState<{ group: string; source: string } | null>(null)
  const scoreRelease = ismSourceRelease(release, ismSelection?.group === release?.id ? ismSelection?.source : null, view.now)
  const policyTimes = !!release && !!policyEpisodeRule(release.familyId)
  const showReadingTimes = policyTimes || !!release?.ismPublications
  const extraIsmSource = release?.ismPublications?.[1] ?? null
  const extraIsmHistory = useFamilyMagnitudeHistory(view.brokerId, extraIsmSource)
  const magnitudeFamily = magnitudeFamilies.find((family) => matchesReadingFamily(release, family)) ?? null
  const hasMagnitude = !!magnitudeFamily && !!release?.events.some((event) => Object.hasOwn(magnitudeFamily.readingRules, event.event_id))
  const scoringBinding = inspectorScoringBinding(symbol, scoreRelease)
  const showScoring = view.preferences.detailView === 'scoring' && !!scoringBinding
  const nfpV2Available = supportsInspector(symbol) && supportsNfpV2(release)
  const ismV2Available = supportsInspector(symbol) && supportsIsmV2(release)
  const v2Available = (supportsInspector(symbol) && supportsCpiV2(release)) || nfpV2Available || ismV2Available
  const showScoringV2 = view.preferences.detailView === 'scoring-v2' && v2Available
  const v3Available = supportsInspector(symbol) && supportsCpiV3(release)
  const showScoringV3 = view.preferences.detailView === 'scoring-v3' && v3Available
  const visibleView = showScoringV3 ? 'scoring-v3' : showScoringV2 ? 'scoring-v2' : showScoring ? 'scoring' : 'table'
  const showHistograms = hasMagnitude && view.preferences.showHistograms
  const releaseTime = (item: InspectorRelease) => view.brokerTime
    ? `${formatAppTimestamp(item.serverTime * 1000, { mode: 'utc', utcOffsetMinutes: 0 })} · broker time`
    : item.releaseAt === null ? 'Time unavailable' : formatAppTimestamp(item.releaseAt, timeDisplay)
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
          } else if (next === 'table' || (next === 'scoring' && scoringBinding) || (next === 'scoring-v2' && v2Available) || (next === 'scoring-v3' && v3Available)) {
            view.applyPreferences({ ...view.preferences, detailView: next })
          }
        }}>
        <option value="table">Table only</option>
        <option value="scoring" disabled={!scoringBinding}>Scoring system</option>
        {v2Available && <option value="scoring-v2">Scoring system v2</option>}
        {v3Available && <option value="scoring-v3">Scoring system v3</option>}
        <option value="scatter" disabled={!hasMagnitude || !scatterAvailable || !onOpenScatter}>Scatter Plot</option>
      </select>}

    </header>
    {!view.supported ? <p className="inspector-empty">Inspector currently supports EURUSD. Select EURUSD to inspect monetary policy, inflation, labor/wages and growth/activity releases.</p> : <>
      <div className={`inspector-body${listOpen ? '' : ' releases-collapsed'}`}>
        <nav id={`${panelId}-releases`} hidden={!listOpen} className="inspector-releases" aria-label="Inspector releases">
          {!view.releases.length && <p className="inspector-empty">No releases match this date range and filter selection.</p>}
          {view.releases.map((item) => <button type="button" key={item.id} aria-pressed={release?.id === item.id}
            className={`inspector-release${release?.id === item.id ? ' selected' : ''}`} onClick={() => view.selectRelease(item.id)}>
            <span className={`inspector-currency-${item.currency}`}><b>{symbolGlyph(view.preferences.symbols[item.familyId] ?? 'star')} {item.currency}</b> · {item.country}</span>
            <strong>{item.label}</strong>
            <time>{releaseTime(item)}</time>
            <small>{item.timingUncertain ? 'Time uncertain · ' : ''}{status(item)} · {item.events.length} readings</small>
          </button>)}
        </nav>
        <div className="inspector-detail" aria-live="polite">
          {!release ? <p className="inspector-empty">Click a chart symbol or select a release to inspect Actual, Previous and A−P.</p> : <>
            {release.ismPublications && <label className="inspector-ism-publication-select">Scoring publication <select aria-label="ISM scoring publication"
              value={scoreRelease?.id} onChange={(event) => setIsmSelection({ group: release.id, source: event.target.value })}>
              {release.ismPublications.map((member) => <option key={member.id} value={member.id}>
                {member.familyId === 'ism-manufacturing' ? 'Manufacturing' : 'Services'} · {releaseTime(member)}
              </option>)}
            </select></label>}
            {showScoringV3 ? <CpiScoreV3 key={release.id} release={release} brokerId={view.brokerId}
              events={view.allReleases.flatMap((item) => item.events)} /> :
            showScoringV2 && ismV2Available ? <IsmScoreV2 key={release.id} release={scoreRelease} brokerId={view.brokerId}
              events={view.allReleases.flatMap((item) => item.events)} timeDisplay={timeDisplay}
              onOpenScatter={scatterAvailable ? onOpenScatter : undefined} /> :
            showScoringV2 && nfpV2Available ? <NfpScoreV2 key={release.id} release={release} brokerId={view.brokerId}
              events={view.allReleases.flatMap((item) => item.events)} /> :
            showScoringV2 ? <CpiScoreV2 key={release.id} release={release} brokerId={view.brokerId}
              events={view.allReleases.flatMap((item) => item.events)} /> :
            showScoring && scoringBinding ? <InspectorScoringView binding={scoringBinding} release={scoreRelease} history={scoreRelease?.id === extraIsmSource?.id ? extraIsmHistory : view.magnitudeHistory}
              brokerId={view.brokerId} events={view.allReleases.flatMap((item) => item.events)} /> :
            <div className="inspector-table-scroll"><table className={showHistograms ? 'inspector-magnitude-table' : undefined} aria-label={`${release.label} release readings`}>
              <thead><tr><th>Series</th>{showReadingTimes && <th>Release time</th>}<th>Actual</th><th>Previous</th>
                {policyTimes && <th>Forecast</th>}<th>A−P</th>{policyTimes && <th
                  title="Actual minus this broker's supplied Forecast, in basis points. Informational only; does not affect A−P, magnitude or scoring.">A−F (Surprise)</th>}{hasMagnitude && <th
                title={showHistograms ? "Seven A−P bands: three negative, exact zero, three positive. Boundaries follow the selected series' Scatter Plot configuration. Undefined magnitude leaves this cell empty. Height counts all usable released readings since January 2015 through now; Extreme values sit beyond the configured range." :
                  "Magnitude follows this series' frozen manual boundaries in Scatter Plot. Undefined magnitude leaves this cell empty."}>
                {showHistograms ? 'A−P magnitude · History' : 'Magnitude'}</th>}</tr></thead>
              <tbody>{release.events.map((event) => {
                const delta = inspectorDelta(event)
                const commentary = isInspectorCommentary(event)
                const sourceRelease = release.ismPublications?.find((member) => member.events.some((row) => row.value_id === event.value_id)) ?? release
                const rowFamily = release.ismPublications ? magnitudeFamilies.find((family) => matchesReadingFamily(sourceRelease, family)) ?? null : magnitudeFamily
                const numericReading = !!rowFamily && Object.hasOwn(rowFamily.readingRules, event.event_id)
                const grading = numericReading ? gradeFamilyReading(event, sourceRelease.familyId, rowFamily!) : gradePolicyRateDecision(event, sourceRelease.familyId)
                const surpriseGrading = policyTimes ? gradePolicyRateDecision(event, release.familyId, 'forecast') : null
                const revisedComparison = revisedFamilyComparison(event, sourceRelease.familyId, rowFamily)
                return <tr key={event.value_id}>
                  <td><strong>{event.name}</strong>{release.ismPublications && <small>{sourceRelease.familyId === 'ism-manufacturing' ? 'Manufacturing' : 'Services'}</small>}{event.revision > 0 && <span className="inspector-revision"> · Revision {event.revision}</span>}
                    {sharedPeriod === null && release.events.some((reading) => reading.period_seconds > 0) &&
                      <small>Period: {event.period_seconds > 0 ? formatAppTimestamp(event.period_seconds * 1000,
                        { mode: 'utc', utcOffsetMinutes: 0 }, 'date') : '—'}</small>}</td>
                  {showReadingTimes && <InspectorReadingTime event={event} brokerTime={view.brokerTime} timeDisplay={timeDisplay} />}
                  <td>{formatInspectorValue(event.actual, event)}</td>
                  <td>{formatInspectorValue(event.previous, event)}{hasRevisedPreviousChange(event) &&
                    <small>Rev: {formatInspectorValue(event.revised_previous, event)}</small>}</td>
                  {policyTimes && <td>{formatInspectorValue(event.forecast, event)}</td>}
                  <td className={grading ? `inspector-graded-delta inspector-grade-${grading.grade}` : undefined} title={grading?.explanation}>
                    {commentary ? 'Not applicable' : formatInspectorValue(delta, event, true)}
                    {grading && numericReading && <span className="inspector-row-grade">{gradeLabels[grading.grade]}</span>}
                    {revisedComparison && <div className={`inspector-secondary-reading inspector-grade-${revisedComparison.grade}`}
                      title={revisedComparison.explanation}>{revisedComparison.label}: {formatInspectorValue(revisedComparison.delta, event, true)}
                      <span className="inspector-row-grade">{gradeLabels[revisedComparison.grade]}</span></div>}</td>
                  {policyTimes && <td className={surpriseGrading ? `inspector-graded-delta inspector-grade-${surpriseGrading.grade}` : undefined}
                    title={surpriseGrading?.explanation}>{commentary ? 'Not applicable' : formatInspectorValue(inspectorSurprise(event), event, true)}</td>}
                  {hasMagnitude && (numericReading ? <FamilyMagnitudeCell event={event} history={sourceRelease.id === extraIsmSource?.id ? extraIsmHistory : view.magnitudeHistory} grade={grading?.grade ?? 'unrated'}
                    deltaScale={rowFamily?.deltaScale} showHistogram={showHistograms} secondaryComparison={revisedComparison} /> : <td>Not applicable</td>)}
                </tr>
              })}</tbody>
            </table></div>}
          </>}
        </div>
      </div>
    </>}
    {filtersOpen && <InspectorFiltersModal preferences={view.preferences} onApply={view.applyPreferences} onClose={() => setFiltersOpen(false)} />}
  </section>
}
