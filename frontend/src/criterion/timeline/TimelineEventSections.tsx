import { useEffect, useId, useRef } from 'react'
import type { PriorContextBars } from '../audit-data'
import { CpiEventTimelineTable, type TimelineReleaseBlock, type TimelineSeriesRow } from './CpiEventTimelineTable'
import type { TimelineEventAnnotations } from './useTimelineEventAnnotations'
import { TimelineEventRelease } from './TimelineEventRelease'
import { useTimelineEventBrowser, eventPageSize, eventDate, type EventBrowserTab } from './useTimelineEventBrowser'
import { TimelinePopover } from './TimelinePopover'
import { TimelineFamilyPicker } from './TimelineFamilyPicker'
import { timelineManifest } from './cpi-event-timeline-data'

type Props = {
  view: TimelineEventAnnotations
  anchorBlock?: TimelineReleaseBlock
  priorBars: PriorContextBars
  onPriorChange: (bars: PriorContextBars) => void
  selectedRowKey?: string | null
  onSelectRow?: (block: TimelineReleaseBlock, row: TimelineSeriesRow, key: string) => void
  onReturnLive?: () => void
}

export function TimelineEventSections({ view, anchorBlock, priorBars, onPriorChange, selectedRowKey, onSelectRow, onReturnLive }: Props) {
  const browser = useTimelineEventBrowser(view, Boolean(anchorBlock))
  const panelId = useId()
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!list.current) return
    list.current.scrollTop = 0
    if (view.focusedGroupId) {
      const element = [...list.current.querySelectorAll<HTMLElement>('[data-event-group]')]
        .find((node) => node.dataset.eventGroup === view.focusedGroupId)
      element?.scrollIntoView?.({ block: 'nearest' })
    }
  }, [browser.tab, browser.date, browser.page, browser.query, view.focusedGroupId])
  const tabs: [EventBrowserTab, string, number | null][] = [
    ...(anchorBlock ? [['anchor', 'CPI release', null] as [EventBrowserTab, string, null]] : []),
    ['before', 'Before CPI', browser.counts.before], ['simultaneous', 'At CPI', browser.counts.simultaneous],
    ['after', 'After CPI', browser.counts.after], ['selected', 'On chart', browser.counts.selected],
  ]
  return <div className="timeline-event-sections">
    <header className="timeline-dock-header timeline-compact-header">
      <div className="timeline-compact-identity"><strong>CPI &amp; Event Timeline <span>EURUSD</span></strong>
        <time>{anchorBlock?.releaseTimeText.slice(0, 10)}</time></div>
    <div className="timeline-event-tabs" role="tablist" aria-label="CPI episode events">
      {tabs.map(([tab, label, count], index) => <button key={tab} type="button" role="tab"
        id={`${panelId}-${tab}`} data-event-tab={tab} aria-controls={`${panelId}-panel`}
        aria-selected={browser.tab === tab} tabIndex={browser.tab === tab ? 0 : -1}
        onClick={() => browser.selectTab(tab)} onKeyDown={(event) => {
          const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length :
            event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length :
            event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null
          if (next === null) return
          event.preventDefault()
          browser.selectTab(tabs[next][0])
          event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
        }}>{label}{count !== null && <span> ({count})</span>}</button>)}
    </div>
    <div className="timeline-header-actions">
      <TimelinePopover label="Filters" title="Event filters" width={580}>
        {(close) => <TimelineFamilyPicker view={view} close={close} />}
      </TimelinePopover>
      <TimelinePopover label="Window" title="Viewing window">
        {(close) => <>
          <div className="timeline-popover-heading"><strong>Viewing window</strong><button type="button" onClick={close} aria-label="Close viewing window">×</button></div>
      <div className="timeline-event-controls">
        <label>Before CPI <select value={priorBars} onChange={(e) => onPriorChange(Number(e.target.value) as PriorContextBars)}>
          {[0, 60, 120, 240].map((bars) => <option key={bars} value={bars}>{bars} H1 bars</option>)}
        </select></label>
        <label>After CPI <select value={view.afterBars} onChange={(e) => view.setAfterBars(Number(e.target.value) as 60 | 120 | 240)}>
          {[60, 120, 240].map((bars) => <option key={bars} value={bars}>{bars} H1 bars</option>)}
        </select></label>
      </div>
          <p className="timeline-symbol-help">{priorBars} observed H1 bars before / {view.afterBars} after entry. Weekends and missing candles are not counted as bars. The window changes chart context only; published results stay H240 · SL 1 ATR · TP 1 ATR.</p>
        </>}
      </TimelinePopover>
      <TimelinePopover label="Info" title="CPI episode details">
        {(close) => <>
          <div className="timeline-popover-heading"><strong>CPI episode details</strong><button type="button" onClick={close} aria-label="Close CPI episode details">×</button></div>
          <dl className="timeline-episode-details">
            <dt>Anchor release</dt><dd>{anchorBlock?.releaseTimeText ?? 'Unavailable'}</dd>
            <dt>Entry</dt><dd>{anchorBlock?.entryTimeText ?? 'Unavailable'}</dd>
            <dt>Clock</dt><dd>Pinned source server clock</dd>
            <dt>Gross results</dt><dd>H240 · SL 1 ATR · TP 1 ATR · STOP_FIRST</dd>
            <dt>Research source SHA-256</dt><dd>{timelineManifest.reviewedSourceManifestSha256}</dd>
          </dl>
          <p className="timeline-symbol-help">Exploratory research. A−P compares Actual with Previous. Grouping and symbols preserve source readings and reviewed outcomes.</p>
        </>}
      </TimelinePopover>
      {onReturnLive && <button type="button" className="arrow-result-text-button" onClick={onReturnLive}
        aria-label="Return to live chart view">Return to live</button>}
    </div>
    </header>
    {view.storageFailed && <p role="alert">Symbol choices could not be saved in this browser.</p>}
    {browser.tab !== 'anchor' && <div className="timeline-event-browse-controls">
      <label>Date <select aria-label="Event date" value={browser.searching ? 'ALL' : browser.date} disabled={browser.searching}
        onChange={(event) => browser.selectDate(event.target.value)}>
        <option value="ALL">All dates ({browser.counts[browser.tab]})</option>
        {browser.dates.map((date) => <option key={date} value={date}>{date} ({browser.tabGroups.filter((group) =>
          eventDate(group) === date).length})</option>)}
      </select></label>
      <input type="search" aria-label="Search releases in all dates of this tab" placeholder="Search this tab: PPI, US, date…"
        value={browser.query} onChange={(event) => browser.search(event.target.value)} />
      {browser.query && <button type="button" onClick={() => browser.search('')}>Clear</button>}
    </div>}
    <div id={`${panelId}-panel`} ref={list} className={`timeline-event-page${browser.tab === 'anchor' ? ' timeline-anchor-page' : ''}`} role="tabpanel"
      aria-labelledby={`${panelId}-${browser.tab}`} tabIndex={0}>
      {browser.tab === 'anchor' && anchorBlock ? <CpiEventTimelineTable blocks={[anchorBlock]} horizon={240} stop={1} target={1}
        hideBlockHeader selectedRowKey={selectedRowKey} onSelectRow={onSelectRow} /> : <>
        {!view.auditBars && <p role="status">Chart context is unavailable; event symbols need the pinned H1 candles.</p>}
        {!browser.matching.length && <p className="timeline-symbol-help">{browser.tab === 'selected' ?
          'No selected chart events in this view. Tick a release in Before, At or After CPI to add its symbol.' :
          'No releases match this selection. Try another date or change Families or Window.'}</p>}
        {browser.groups.map((group) => <TimelineEventRelease key={group.id} group={group} view={view}
          selectedRowKey={selectedRowKey} onSelectRow={onSelectRow} />)}
      </>}
    </div>
    {browser.tab !== 'anchor' && <div className="timeline-event-pager">
      <span>{browser.matching.length ? `${browser.page * eventPageSize + 1}–${Math.min((browser.page + 1) * eventPageSize, browser.matching.length)} of ${browser.matching.length} releases` : '0 releases'}
        {browser.searching && ' · searching all dates'}</span>
      <div><button type="button" aria-label="Previous event page" disabled={browser.page === 0}
        onClick={() => browser.selectPage(browser.page - 1)}>Previous</button>
        <span>Page {browser.page + 1} / {browser.pageCount}</span>
        <button type="button" aria-label="Next event page" disabled={browser.page + 1 >= browser.pageCount}
          onClick={() => browser.selectPage(browser.page + 1)}>Next</button></div>
    </div>}
  </div>
}
