import { useId, useState } from 'react'
import { formatAppTimestamp, timeDisplayLabel, type TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import type { CalendarSourceHealth } from '../system-connectivity/bridge-status/bridge-contract'
import { symbolGlyph } from '../criterion/timeline/timeline-event-view'
import { formatInspectorValue, inspectorDelta, isInspectorCommentary, type InspectorRelease } from './inspector-data'
import { InspectorFiltersModal } from './InspectorFiltersModal'
import { InspectorDateRangePicker } from './InspectorDateRangePicker'
import { assessNfpMajority, gradeLabels, gradeNfpReading, tallyNfpRelease } from './grading/nfp-grading'
import type { InspectorView } from './useInspector'
import './inspector.css'

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
export function InspectorPanel({ view, symbol, source, error, timeDisplay, auditMode = false, onReturnLive }: {
  view: InspectorView; symbol: string; source: CalendarSourceHealth | null; error: string | null
  timeDisplay: TimeDisplayPreference; auditMode?: boolean; onReturnLive?: () => void
}) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [listOpen, setListOpen] = useState(true)
  const panelId = useId()
  const release = view.selectedRelease
  const tally = tallyNfpRelease(release)
  const majority = assessNfpMajority(release)
  const releaseTime = (item: InspectorRelease) => view.brokerTime
    ? `${formatAppTimestamp(item.serverTime * 1000, { mode: 'utc', utcOffsetMinutes: 0 })} · broker time`
    : item.releaseAt === null ? 'Time unavailable' : formatAppTimestamp(item.releaseAt, timeDisplay)
  const status = (item: InspectorRelease) => releaseStatus(item, view.now + (view.brokerTime ? view.brokerOffsetSeconds * 1000 : 0), view.brokerTime)
  const storageStatus = view.storage.loading ? 'Loading stored calendar' : view.storage.error ??
    (view.storage.source ? `Stored calendar · ${view.storage.source.publisher_status === 'live' ? 'publisher live' : 'publisher offline'}` : 'Waiting for the broker calendar')
  const missingCoverage = Object.entries(view.storage.coverage).filter(([, coverage]) => coverage.missing.length).map(([currency]) => currency)
  const unplaced = view.releases.filter((item) => item.chartTime === null).length
  const sharedPeriod = release?.events.length && release.events[0].period_seconds > 0 &&
    release.events.every((event) => event.period_seconds === release.events[0].period_seconds) ? release.events[0].period_seconds : null
  const coverageStart = source?.window_from_server_seconds
  const coverageEnd = source?.window_to_server_seconds
  const offset = source?.server_utc_offset_seconds
  const hasCoverage = coverageStart != null && coverageEnd != null && offset != null
  const outsideCoverage = !view.brokerTime && hasCoverage && view.range && (view.range.from < (coverageStart - offset) * 1000 || view.range.to > (coverageEnd - offset) * 1000)
  return <section className="inspector-panel" aria-label="Inspector">
    <header className="inspector-header">
      <strong>{symbol}</strong>
      <InspectorDateRangePicker view={view} />
      <button type="button" disabled={!view.supported} aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>Filters</button>
    </header>
    {!view.supported ? <p className="inspector-empty">Inspector currently supports EURUSD. Select EURUSD to inspect monetary policy, inflation, labor/wages and growth/activity releases.</p> : <>
      <div className="inspector-context"><span>{view.releases.length} releases · {view.brokerTime ? 'Broker time' : timeDisplayLabel(timeDisplay)}</span>
        <button type="button" className="inspector-list-toggle" aria-expanded={listOpen} aria-controls={`${panelId}-releases`}
          onClick={() => setListOpen((open) => !open)}>{listOpen ? 'Hide releases' : 'Show releases'}</button>
        <span role="status">{view.brokerTime ? storageStatus : sourceLabel(source, error)}</span>
        {auditMode && <span>Symbols are available on the live chart. <button type="button" onClick={onReturnLive}>Return to live</button></span>}
        {view.storageFailed && <span role="alert">Filter settings could not be saved in this browser.</span>}
        {!view.range && <span role="alert">Choose a valid date range with the start before or on the end date.</span>}
        {view.brokerTime && missingCoverage.length > 0 && <span role="status">Coverage pending for {missingCoverage.join(' and ')} in this range; stored readings remain available.</span>}
        {view.brokerTime && view.storage.collectorError && <span role="alert">Live collection delayed: {view.storage.collectorError}</span>}
        {view.brokerTime && unplaced > 0 && <span>{unplaced} releases have no verified chart time; they remain available in the list.</span>}
        {outsideCoverage && <span>Part of this range is outside the available calendar coverage.</span>}
      </div>
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
            <div className="inspector-detail-heading"><strong className={`inspector-currency-${release.currency}`}>
              {symbolGlyph(view.preferences.symbols[release.familyId] ?? 'star')} {release.label} · {release.country} · {release.currency}</strong>
              <div className="inspector-release-clocks" aria-label="Selected release clocks">
                <span data-clock="display">Display · {timeDisplayLabel(timeDisplay)} · {release.releaseAt === null ? 'Display time unavailable' :
                  formatAppTimestamp(release.releaseAt, timeDisplay)}</span>
                {view.brokerTime && <><span aria-hidden="true"> | </span><span data-clock="broker">{release.chartTime === null ? 'Broker time unavailable' :
                  `broker time · ${formatAppTimestamp(release.chartTime * 1000, { mode: 'utc', utcOffsetMinutes: 0 })}`}</span></>}
                <span aria-hidden="true"> | </span>
                <span>{status(release)}{sharedPeriod !== null && <> <span className="inspector-shared-period"
                  title="Reference period covered by these readings. The source represents the period by its starting date.">Period: {formatAppTimestamp(sharedPeriod * 1000,
                    { mode: 'utc', utcOffsetMinutes: 0 }, 'date')}</span></>}</span>
              </div>
              <span className="inspector-info"><button type="button" aria-label="About A−P" aria-describedby={`${panelId}-reading-info`}>ⓘ</button>
                <span id={`${panelId}-reading-info`} role="tooltip">A−P uses Previous; revised Previous is shown separately.
                  pp = percentage points · bp = basis points.
                  {tally && <> NFP colors use defined Good/Bad rules versus Previous. The experimental majority rule maps more Good to EURUSD Short, more Bad to Long, and a tie to Neutral. All ten series must be usable. The tally counts overlapping readings equally.</>}</span></span>
            </div>
            {tally && <div className="inspector-grade-summary" role="status" aria-label="NFP reading tally">
              {majority && <><strong className={`inspector-majority inspector-direction-${majority.direction}`} aria-label="NFP majority direction" title={majority.explanation}>{majority.label}</strong>
                <span>NFP majority rule · Experimental{majority.direction === 'incomplete' && ' · Needs 10 usable series'}</span></>}
              <strong>Compared with Previous</strong>
              {(['good', 'bad', 'unchanged', 'missing', 'unrated'] as const).filter((grade) =>
                ['good', 'bad', 'unchanged'].includes(grade) || tally.counts[grade] > 0).map((grade) =>
                <span className={`inspector-grade inspector-grade-${grade}`} key={grade}>{tally.counts[grade]} {gradeLabels[grade]}</span>)}
              <span>{tally.total} readings</span>
            </div>}
            <div className="inspector-table-scroll"><table aria-label={`${release.label} release readings`}>
              <thead><tr><th>Series</th><th>Actual</th><th>Previous</th><th>A−P</th></tr></thead>
              <tbody>{release.events.map((event) => {
                const delta = inspectorDelta(event)
                const commentary = isInspectorCommentary(event)
                const grading = gradeNfpReading(event, release.familyId)
                return <tr key={event.value_id}>
                  <td><strong>{event.name}</strong>{event.revision > 0 && <span className="inspector-revision"> · Revision {event.revision}</span>}
                    {sharedPeriod === null && release.events.some((reading) => reading.period_seconds > 0) &&
                      <small>Period: {event.period_seconds > 0 ? formatAppTimestamp(event.period_seconds * 1000,
                        { mode: 'utc', utcOffsetMinutes: 0 }, 'date') : '—'}</small>}</td>
                  <td>{formatInspectorValue(event.actual, event)}</td>
                  <td>{formatInspectorValue(event.previous, event)}{event.revised_previous !== null && event.revised_previous !== event.previous &&
                    <small>Rev: {formatInspectorValue(event.revised_previous, event)}</small>}</td>
                  <td className={grading ? `inspector-graded-delta inspector-grade-${grading.grade}` : undefined} title={grading?.explanation}>
                    {commentary ? 'Not applicable' : formatInspectorValue(delta, event, true)}
                    {grading && <span className="inspector-row-grade">{gradeLabels[grading.grade]}</span>}</td>
                </tr>
              })}</tbody>
            </table></div>
          </>}
        </div>
      </div>
    </>}
    {filtersOpen && <InspectorFiltersModal preferences={view.preferences} onApply={view.applyPreferences} onClose={() => setFiltersOpen(false)} />}
  </section>
}
