import { useId, useState, type ReactNode } from 'react'
import type { ExternalSource } from '../external-sources/external-source-model'
import { RecordDetails, VersionHistory } from '../external-sources/ExternalRecordDetails'
import { externalCountdown } from '../external-sources/external-schedule'
import { alarmTime, jakartaDisplay } from './alarm-time'

export function ExternalHighlightCard({ item, now, alarm, busy, changePin }: {
  item: ExternalSource; now: number; alarm: ReactNode; busy: boolean; changePin: (item: ExternalSource) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false), contentId = useId()
  return <article className="highlight-card external-highlight-card" data-external-key={item.key}>
    <div className="highlight-header">
      <button type="button" className="highlight-toggle" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(value => !value)}>
        <span aria-hidden="true">{expanded ? '▾' : '▸'}</span><span className="alert-currency">{item.currencies.join(' / ')}</span><strong>{item.title}</strong>
        <span className="highlight-source">External Source</span>
        <time>{item.event_at ? alarmTime(Date.parse(item.event_at)) : item.event_date ? `${externalCountdown(item, now, jakartaDisplay) === 'Today' ? 'Today' : item.event_date} · hour unconfirmed` : 'Unscheduled'}</time>
        <span className="alert-countdown">{item.archived ? 'Archived' : externalCountdown(item, now, jakartaDisplay)}</span>
      </button>
      <div className="highlight-actions">
        <button type="button" onClick={() => setExpanded(true)} aria-label={`Research ${item.title}`}>Research</button>
        {alarm}
        <button type="button" disabled={busy} onClick={() => void changePin(item)} aria-label={`${item.archived ? 'Restore' : 'Archive'} highlight ${item.title}`}>
          {item.archived ? 'Restore' : 'Archive'}</button>
      </div>
    </div>
    <div className="highlight-content" id={contentId} hidden={!expanded}>{expanded && <>
      <RecordDetails item={item} timeDisplay={jakartaDisplay} /><VersionHistory key={item.id} item={item} timeDisplay={jakartaDisplay} />
    </>}</div>
  </article>
}
