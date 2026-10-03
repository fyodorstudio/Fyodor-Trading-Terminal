import { useState } from 'react'
import { CpiEventTimelineTable, type TimelineReleaseBlock, type TimelineSeriesRow } from './CpiEventTimelineTable'
import { getRelationshipMeta, isExploratoryBlock } from './timeline-release-metadata'
import type { TimelineEventAnnotations } from './useTimelineEventAnnotations'
import { eventSymbols, containingEventBar, type EventSymbol, type TimelineEventGroup } from './timeline-event-view'
import { defaultFamilySymbol } from './timeline-event-families'
import { eventFamilyKey, eventCurrencySide } from './timeline-event-filters'
import { TimelineReleaseSummary } from './TimelineReleaseSummary'

export function TimelineEventRelease({ group, view, selectedRowKey, onSelectRow }: {
  group: TimelineEventGroup
  view: TimelineEventAnnotations
  selectedRowKey?: string | null
  onSelectRow?: (block: TimelineReleaseBlock, row: TimelineSeriesRow, key: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const focused = view.focusedGroupId === group.id
  const selectedSymbol = view.selected[group.id]
  const symbol = selectedSymbol ?? view.familySymbols[eventFamilyKey(group)] ??
    view.familySymbols[group.family] ?? defaultFamilySymbol(group.familyId)
  const canMark = !group.timingUncertain && containingEventBar(group.releaseTimestamp, view.auditBars ?? []) !== null
  const relationship = getRelationshipMeta(group.block.relationship, group.timingUncertain)
  return <div data-event-group={group.id} className={`timeline-event-release${focused ? ' focused' : ''}`}>
    <div className="timeline-event-marker-controls">
      <label title={canMark ? 'Show this release on the chart' : 'Exact publication time or containing candle is unavailable'}>
        <input type="checkbox" aria-label={`Show ${group.family} ${group.countryCode} ${group.releaseTimeText} on chart`}
          checked={Boolean(selectedSymbol)} disabled={!canMark}
          onChange={(e) => view.setEventSymbol(group.id, group.family, symbol, e.target.checked)} /> Chart
      </label>
      <select className={`timeline-currency-${eventCurrencySide(group.currency)}`} aria-label={`Symbol for ${group.family} ${group.countryCode} ${group.releaseTimeText}`} value={symbol}
        onChange={(e) => view.setEventSymbol(group.id, group.family, e.target.value as EventSymbol, Boolean(selectedSymbol))}>
        {eventSymbols.map(([id, glyph, name]) => <option key={id} value={id}>{glyph} {name}</option>)}
      </select>
    </div>
    <details open={expanded || focused} onToggle={(event) => {
      const open = event.currentTarget.open
      setExpanded(open)
      if (!open && focused) view.setFocusedGroupId(null)
    }}>
      <summary><strong>{group.family}</strong> · {group.countryCode} · {group.currency} <time>{group.releaseTimeText}</time>
        {group.timingUncertain && <span className="timeline-uncertain-badge">TIME UNCERTAIN · no timed symbol</span>}
        <span className="timeline-event-reading-count">{group.block.rows.length} readings</span>
        <span className={`timeline-block-relationship badge ${relationship.badgeClass}`}>{relationship.label}</span>
        {isExploratoryBlock(group.block) && <span className="timeline-exploratory-badge badge"
          title="Exploratory Non-CPI Family with independent entry and levels">EXPLORATORY</span>}
        {group.block.entryTimeText && <span className="timeline-event-entry">Entry {group.block.entryTimeText}</span>}
        <TimelineReleaseSummary block={group.block} />
      </summary>
      {(expanded || focused) && <CpiEventTimelineTable blocks={[group.block]} hideBlockHeader selectedRowKey={selectedRowKey}
        onSelectRow={(_block, _row, key) => {
          const source = group.sources.get(key)
          if (source) onSelectRow?.(source.block, source.row, key)
        }} />}
    </details>
  </div>
}
