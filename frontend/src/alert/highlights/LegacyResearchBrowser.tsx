import { useMemo, useState } from 'react'
import type { Highlight } from './highlight-model'
import { useHighlights } from './useHighlights'
import { SavedReleaseResearch } from './SavedReleaseResearch'
import { formatAppTimestamp } from '../../appearance/time-display/time-display-preference'
import { jakartaDisplay } from '../../events-alarms/alarm-time'
import { formatInspectorValue } from '../../inspector/readings/reading-values'

export function LegacyResearchBrowser({ onClose }: { onClose: () => void }) {
  const records = useHighlights(undefined, 0, 'all')
  const [broker, setBroker] = useState('all'), [status, setStatus] = useState('all'), [query, setQuery] = useState('')
  const brokers = useMemo(() => [...new Set(records.items.map(item => item.source_id))].sort(), [records.items])
  const items = useMemo(() => records.items.filter(item => (broker === 'all' || item.source_id === broker)
    && (status === 'all' || !!item.archived_utc === (status === 'archived'))
    && `${item.label} ${item.currency} ${item.id} ${item.source_id}`.toLowerCase().includes(query.trim().toLowerCase())), [records.items, broker, status, query])
  return <section className="legacy-research-browser" aria-label="Legacy pins and research">
    <header><h3>Legacy pins &amp; research</h3><button type="button" onClick={onClose}>Back to calendar</button></header>
    <p>Read-only records from all saved brokers, including Elev8. Active and archived pins, research versions and saved prompts are preserved here for review. These records do not select current reminders.</p>
    <div className="legacy-research-filters">
      <label>Broker <select value={broker} onChange={event => setBroker(event.target.value)}><option value="all">All brokers</option>{brokers.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Status <select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Active &amp; archived</option><option value="active">Active</option><option value="archived">Archived</option></select></label>
      <label>Search <input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
    </div>
    {records.error && <p role="status">{records.error} Showing any cached records available.</p>}
    <p>{items.length} of {records.items.length} pins · {records.items.reduce((sum, item) => sum + (item.journal?.length ?? 0), 0)} research versions · {records.items.reduce((sum, item) => sum + (item.prompts?.length ?? 0), 0)} saved prompts</p>
    {!items.length && <p>No matching legacy records loaded.</p>}
    {items.map(item => <LegacyRecord key={`${item.source_id}:${item.id}`} item={item} />)}
  </section>
}

function LegacyRecord({ item }: { item: Highlight }) {
  const [open, setOpen] = useState(false)
  const time = (value: string) => formatAppTimestamp(Date.parse(value), jakartaDisplay)
  return <details open={open}>
    <summary onClick={event => { event.preventDefault(); setOpen(value => !value) }}>
      {item.source_id} · {item.currency} · {item.label} · {item.archived_utc ? 'Archived' : 'Active'} · {item.journal?.length ?? 0} research versions
    </summary>
    {open && <>
      <p>Pin {item.id} · Saved {time(item.pinned_utc)} Jakarta{item.archived_utc && ` · Archived ${time(item.archived_utc)} Jakarta`}</p>
      <p>{item.release_at === null ? 'Exact publication time unavailable' : `Release ${formatAppTimestamp(item.release_at, jakartaDisplay)} Jakarta`}</p>
      {!!item.missing_value_ids.length && <p>Missing stored readings: {item.missing_value_ids.join(', ')}</p>}
      <SavedReleaseResearch item={item} />
      <details><summary>Stored readings and IDs ({item.events.length})</summary><div className="highlight-series"><table>
        <thead><tr><th>Series / value ID</th><th>Actual</th><th>Forecast</th><th>Previous</th></tr></thead>
        <tbody>{item.events.map(event => <tr key={event.value_id}><th scope="row">{event.name}<small>{event.event_id} / {event.value_id}</small></th>
          {[event.actual, event.forecast, event.previous].map((value, index) => <td key={index}>{formatInspectorValue(value, event)}</td>)}</tr>)}</tbody>
      </table></div></details>
      <details><summary>Saved prompts ({item.prompts?.length ?? 0})</summary>{item.prompts?.map(prompt => <section key={prompt.id}>
        <h4>{prompt.scope} · {time(prompt.saved_utc)} Jakarta</h4><p>Preparation</p><pre>{prompt.prepare_prompt}</pre><p>Release</p><pre>{prompt.release_prompt}</pre>
      </section>)}</details>
    </>}
  </details>
}
