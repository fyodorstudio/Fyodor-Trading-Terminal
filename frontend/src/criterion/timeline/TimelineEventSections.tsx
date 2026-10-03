import { useEffect, useRef, useState } from 'react'
import type { PriorContextBars } from '../audit-data'
import { CpiEventTimelineTable, type TimelineReleaseBlock, type TimelineSeriesRow } from './CpiEventTimelineTable'
import type { TimelineEventAnnotations } from './useTimelineEventAnnotations'
import { eventSymbols, containingEventBar, type EventSection, type EventSymbol } from './timeline-event-view'

type Props = {
  view: TimelineEventAnnotations
  priorBars: PriorContextBars
  onPriorChange: (bars: PriorContextBars) => void
  selectedRowKey?: string | null
  onSelectRow?: (block: TimelineReleaseBlock, row: TimelineSeriesRow, key: string) => void
}
const sections: [EventSection, string][] = [
  ['before', 'Before CPI'], ['simultaneous', 'At CPI'], ['after', 'After CPI'],
]

export function TimelineEventSections({ view, priorBars, onPriorChange, selectedRowKey, onSelectRow }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  useEffect(() => {
    if (!view.focusedGroupId) return
    const element = [...(host.current?.querySelectorAll<HTMLElement>('[data-event-group]') ?? [])]
      .find((node) => node.dataset.eventGroup === view.focusedGroupId)
    element?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [view.focusedGroupId])
  const families = [...new Set(view.windowGroups.map((group) => group.family))].sort()
  const currencies = [...new Set(view.windowGroups.map((group) => group.currency))].sort()
  return <div className="timeline-event-sections" ref={host}>
    <div className="timeline-event-controls">
      <label>Before CPI <select value={priorBars} onChange={(e) => onPriorChange(Number(e.target.value) as PriorContextBars)}>
        {[0, 60, 120, 240].map((bars) => <option key={bars} value={bars}>{bars} H1 bars</option>)}
      </select></label>
      <label>After CPI <select value={view.afterBars} onChange={(e) => view.setAfterBars(Number(e.target.value) as 60 | 120 | 240)}>
        {[60, 120, 240].map((bars) => <option key={bars} value={bars}>{bars} H1 bars</option>)}
      </select></label>
      <label>Family <select value={view.familyFilter} onChange={(e) => view.setFamilyFilter(e.target.value)}>
        <option value="ALL">All families</option>
        {families.map((family) => <option key={family}>{family}</option>)}
      </select></label>
      <label>Currency <select value={view.currencyFilter} onChange={(e) => view.setCurrencyFilter(e.target.value)}>
        <option value="ALL">All currencies</option>
        {currencies.map((currency) => <option key={currency}>{currency}</option>)}
      </select></label>
      <span>{view.groups.length} / {view.windowGroups.length} surrounding releases · {view.markers.length} chart symbols</span>
    </div>
    <p className="timeline-symbol-help">Tick releases to mark their publication times. Symbols identify events, not trade directions. Viewing windows do not change the published H240 results.</p>
    {view.storageFailed && <p role="alert">Symbol choices could not be saved in this browser.</p>}
    {!view.auditBars && <p role="status">Chart context is unavailable; event symbols need the pinned H1 candles.</p>}
    {sections.map(([section, title]) => {
      const groups = view.groups.filter((group) => group.section === section)
      return <section key={section} className="timeline-event-section" aria-label={title}>
        <h3>{title} <span>({groups.length})</span></h3>
        {!groups.length && <p className="timeline-symbol-help">No surrounding releases in this selection.</p>}
        {groups.map((group) => {
          const selectedSymbol = view.selected[group.id]
          const symbol = selectedSymbol ?? view.familySymbols[group.family] ?? 'star'
          const canMark = !group.timingUncertain && containingEventBar(group.releaseTimestamp, view.auditBars ?? []) !== null
          const expanded = Boolean(expandedGroups[group.id] || view.focusedGroupId === group.id)
          return <div key={group.id} data-event-group={group.id} className={`timeline-event-release${view.focusedGroupId === group.id ? ' focused' : ''}`}>
            <div className="timeline-event-marker-controls">
              <label title={canMark ? 'Show this release on the chart' : 'Exact publication time or containing candle is unavailable'}>
                <input type="checkbox" aria-label={`Show ${group.family} ${group.countryCode} ${group.releaseTimeText} on chart`}
                  checked={Boolean(selectedSymbol)} disabled={!canMark}
                  onChange={(e) => view.setEventSymbol(group.id, group.family, symbol, e.target.checked)} /> Chart
              </label>
              <select aria-label={`Symbol for ${group.family} ${group.countryCode} ${group.releaseTimeText}`} value={symbol}
                onChange={(e) => view.setEventSymbol(group.id, group.family, e.target.value as EventSymbol, Boolean(selectedSymbol))}>
                {eventSymbols.map(([id, glyph, name]) => <option key={id} value={id}>{glyph} {name}</option>)}
              </select>
            </div>
            <details open={expanded} onToggle={(event) => {
              const open = event.currentTarget.open
              setExpandedGroups((previous) => previous[group.id] === open ? previous : { ...previous, [group.id]: open })
              if (!open && view.focusedGroupId === group.id) view.setFocusedGroupId(null)
            }}>
              <summary><strong>{group.family}</strong> · {group.countryCode} · {group.currency} <time>{group.releaseTimeText}</time>
                {group.timingUncertain && <span className="timeline-uncertain-badge">TIME UNCERTAIN · no timed symbol</span>}
                <span className="timeline-event-reading-count">{group.block.rows.length} readings</span>
              </summary>
              {expanded && <CpiEventTimelineTable blocks={[group.block]} selectedRowKey={selectedRowKey} onSelectRow={(_block, _row, key) => {
                const source = group.sources.get(key)
                if (source) onSelectRow?.(source.block, source.row, key)
              }} />}
            </details>
          </div>
        })}
      </section>
    })}
  </div>
}
