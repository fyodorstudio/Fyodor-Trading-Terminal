import { useEffect, useState } from 'react'
import { formatAppTimestamp, type TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import { validExternalItems, type ExternalSource } from './external-source-model'

export function RecordDetails({ item, timeDisplay }: { item: ExternalSource; timeDisplay: TimeDisplayPreference }) {
  const time = (at: string) => `${formatAppTimestamp(Date.parse(at), timeDisplay)} (${at})`
  return <div className="external-record-details">
    <p>{item.kind === 'scheduled' ? 'Scheduled event' : item.kind === 'headline' ? 'Published headline' : 'Unscheduled watch'} · {item.status}</p>
    <p>{item.event_at ? `Event / headline reference: ${time(item.event_at)}` : item.event_date ? `Source date: ${item.event_date} · hour unconfirmed` : 'Event time unconfirmed / unscheduled'}</p>
    {item.published_utc && <p>Source publication: {time(item.published_utc)}</p>}
    <p>{item.time_note}</p>
    <h4>Facts</h4><p>{item.facts}</p>
    {item.interpretation && <><h4>Interpretation at save time</h4><p>{item.interpretation}</p></>}
    <h4>Evidence</h4><ul>{item.sources.map((source, index) => <li key={index}>
      {source.kind === 'web' ? <a href={source.locator} target="_blank" rel="noreferrer">{source.label}</a> : <span>{source.label}: {source.locator}</span>}
      {source.note && <p>{source.note}</p>}
    </li>)}</ul>
    <p className="external-meta">Recorded: {time(item.saved_utc)}</p>
  </div>
}
export function VersionHistory({ item, timeDisplay }: { item: ExternalSource; timeDisplay: TimeDisplayPreference }) {
  const [open, setOpen] = useState(false), [items, setItems] = useState<ExternalSource[]>([]), [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    const abort = new AbortController()
    void (async () => {
      try {
        const response = await fetch(`/storage-api/external-sources/${encodeURIComponent(item.key)}`, { signal: abort.signal })
        if (!response.ok) throw new Error('Version history unavailable')
        const data = await response.json()
        if (!validExternalItems(data.items) || data.items.some((entry: ExternalSource) => entry.key !== item.key)) throw new Error('Invalid version history')
        if (!abort.signal.aborted) setItems(data.items.slice().reverse())
      } catch (failure) { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : 'Version history unavailable') }
    })()
    return () => abort.abort()
  }, [open, item.key, item.id])
  return <div><button type="button" aria-expanded={open} onClick={() => { if (!open) { setItems([]); setError(null) }; setOpen(value => !value) }}>Version history ({item.version_count ?? 1})</button>
    {open && <div>{error ? <p role="status">{error}</p> : !items.length ? <p role="status">Loading history…</p> : items.map(entry =>
      <details key={entry.id}><summary>{formatAppTimestamp(Date.parse(entry.saved_utc), timeDisplay)} · {entry.title}</summary>
        <RecordDetails item={entry} timeDisplay={timeDisplay} /></details>)}</div>}
  </div>
}
