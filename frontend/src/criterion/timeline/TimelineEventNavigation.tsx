import { eventDate, eventPageSize, type useTimelineEventBrowser } from './useTimelineEventBrowser'
import { TimelinePopover } from './TimelinePopover'

export function TimelineEventNavigation({ browser }: { browser: ReturnType<typeof useTimelineEventBrowser> }) {
  if (browser.tab === 'anchor') return null
  const count = browser.matching.length ?
    `${browser.page * eventPageSize + 1}–${Math.min((browser.page + 1) * eventPageSize, browser.matching.length)} of ${browser.matching.length}` : '0'
  const search = <input type="search" aria-label="Search releases in all dates of this tab" placeholder="Search this tab…"
    value={browser.query} onChange={(event) => browser.search(event.target.value)} />
  return <div className="timeline-event-navigation">
    <div className="timeline-event-browse-controls">
      <label>Date <select aria-label="Event date" value={browser.searching ? 'ALL' : browser.date} disabled={browser.searching}
        onChange={(event) => browser.selectDate(event.target.value)}>
        <option value="ALL">All dates ({browser.counts[browser.tab]})</option>
        {browser.dates.map((date) => <option key={date} value={date}>{date} ({browser.tabGroups.filter((group) => eventDate(group) === date).length})</option>)}
      </select></label>
      <div className="timeline-inline-search">{search}</div>
      <div className="timeline-small-search"><TimelinePopover label={browser.query ? 'Search •' : 'Search'} title="Search this tab" width={320}>
        {(close) => <>
          <div className="timeline-popover-heading"><strong>Search all dates in this tab</strong><button type="button" aria-label="Close event search" onClick={close}>×</button></div>
          {search}
          <p className="timeline-symbol-help">Search by family, country or date. {browser.query && <button type="button" onClick={() => browser.search('')}>Clear search</button>}</p>
        </>}
      </TimelinePopover></div>
      {browser.query && <button type="button" aria-label="Clear event search" onClick={() => browser.search('')}>×</button>}
    </div>
    <div className="timeline-event-pager" aria-label="Event pagination">
      <span title={`${count} releases${browser.searching ? ' · searching all dates' : ''}`}>{count}<span className="timeline-count-label"> releases</span></span>
      {browser.pageCount > 1 && <div>
        <button type="button" aria-label="Previous event page" disabled={browser.page === 0} onClick={() => browser.selectPage(browser.page - 1)}>‹</button>
        <span>{browser.page + 1}/{browser.pageCount}</span>
        <button type="button" aria-label="Next event page" disabled={browser.page + 1 >= browser.pageCount} onClick={() => browser.selectPage(browser.page + 1)}>›</button>
      </div>}
    </div>
  </div>
}
