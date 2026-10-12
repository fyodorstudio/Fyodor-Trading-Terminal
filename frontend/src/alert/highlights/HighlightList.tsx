import { memo, useMemo, useState } from 'react'
import { formatAppTimestamp, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import type { InspectorRelease } from '../../economic-calendar/releases/release'
import { groupInspectorReleases } from '../../inspector/releases/group-releases'
import { formatInspectorValue } from '../../inspector/readings/reading-values'
import { InspectorReadingTime } from '../../inspector/InspectorReadingTime'
import { alertCountdown } from '../model/alert-episodes'
import { highlightState, highlightPrompt, type Highlight } from './highlight-model'
import { useHighlights } from './useHighlights'
import { majorForexPairs } from '../../economic-calendar/forex/pairs'
import { HighlightJournal } from './HighlightJournal'

const HighlightCard = memo(function HighlightCard({ item, now, timeDisplay, archive, restore, busy, onPrepareResearch }: {
  item: Highlight; now: number; timeDisplay: TimeDisplayPreference; archive: (id: string) => Promise<void>; restore: (id: string) => Promise<void>; busy: boolean
  onPrepareResearch?: (release: InspectorRelease) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const scopes = useMemo(() => [...new Set([item.currency, ...majorForexPairs.filter(pair => pair.includes(item.currency)), ...(item.journal ?? []).map(entry => entry.scope)])], [item.currency, item.journal])
  const [scope, setScope] = useState(() => item.journal?.at(-1)?.scope ?? item.currency)
  const [copyStatus, setCopyStatus] = useState('')
  const prompt = useMemo(() => highlightPrompt(item, scope), [item, scope])
  async function copyPrompt() {
    try { await navigator.clipboard.writeText(prompt); setCopyStatus('Prompt copied') }
    catch { setCopyStatus('Clipboard unavailable. Open Prompt preview and copy the text.'); setExpanded(true) }
  }
  const releases = useMemo(() => groupInspectorReleases(item.events), [item.events])
  const state = highlightState(item, now)
  const future = item.events.filter(event => event.release_at !== null && event.time_mode === 0 && event.release_at > now)
  const next = future.length ? Math.min(...future.map(event => event.release_at!)) : null
  return <article className="highlight-card" data-highlight-id={item.id}>
    <details open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}><summary><span className="alert-currency">{item.currency}</span><strong>{item.label}</strong>
      <time>{item.release_at === null ? item.server_time === null ? 'Date unavailable' : `${formatAppTimestamp(item.server_time * 1000, { mode: 'utc', utcOffsetMinutes: 0 }, 'date')} · time unconfirmed` :
        formatAppTimestamp(item.release_at, timeDisplay)}</time>
      <span className="alert-countdown">{item.archived_utc ? 'Archived' : next !== null ? `${state === 'Upcoming' ? '' : 'Next series · '}${alertCountdown(next, now, true)}` : state}</span>
    </summary>{expanded && <><HighlightJournal item={item} scope={scope} />
      {item.archived_utc && <p className="highlight-research-meta">Archived {item.archived_utc} · Readings preserved at archive time.</p>}
      <details><summary>Prompt preview · {scope}</summary><textarea readOnly value={prompt} aria-label={`Prompt for ${item.label} ${scope}`} /></details>
      <HighlightSeries item={item} timeDisplay={timeDisplay} /></>}</details>
    <div className="highlight-actions">{onPrepareResearch && releases[0] && <button type="button" onClick={() => onPrepareResearch({ ...releases[0],
      label: item.label, events: item.events, releaseAt: item.release_at, serverTime: item.server_time ?? releases[0].serverTime, timingUncertain: item.release_at === null })}
      aria-label={`Prepare research for highlighted ${item.currency} ${item.label}`}>Research</button>}
      <label>Scope <select aria-label={`Research scope for ${item.label}`} value={scope} onChange={event => { setScope(event.target.value); setCopyStatus('') }}>
        {scopes.map(value => <option key={value}>{value}</option>)}</select></label>
      <button type="button" onClick={() => void copyPrompt()}>Copy Prompt</button>
      <button type="button" disabled={busy} onClick={() => void (item.archived_utc ? restore(item.id) : archive(item.id))}
        aria-label={`${item.archived_utc ? 'Restore' : 'Archive'} highlight ${item.currency} ${item.label}`}>{item.archived_utc ? 'Restore' : 'Archive'}</button>
      {copyStatus && <span role="status">{copyStatus}</span>}
    </div>
  </article>
})
const HighlightSeries = memo(function HighlightSeries({ item, timeDisplay }: { item: Highlight; timeDisplay: TimeDisplayPreference }) {
  return <div className="highlight-series"><table aria-label={`${item.label} highlighted series`}>
      <thead><tr><th>Series</th><th>Release time</th><th>Actual</th><th>Forecast</th><th>Previous</th><th>Revised previous</th></tr></thead>
      <tbody>{item.events.map(event => <tr key={event.value_id} data-series-id={event.event_id}>
        <th scope="row">{event.name}<small>{event.period_seconds > 0 && `Period: ${formatAppTimestamp(event.period_seconds * 1000, { mode: 'utc', utcOffsetMinutes: 0 }, 'date')}`}
          {event.revision > 0 && ` · Revision ${event.revision}`}{event.availability !== 'observed' && ' · Latest observation unavailable'}</small></th>
        <InspectorReadingTime event={event} timeDisplay={timeDisplay} />
        {[event.actual, event.forecast, event.previous, event.revised_previous].map((value, index) => <td key={index}>{formatInspectorValue(value, event)}</td>)}
      </tr>)}</tbody>
    </table>{!item.events.length && <p>Stored readings unavailable. The pin is retained.</p>}</div>
})
export function HighlightList({ brokerId, now, timeDisplay, onPrepareResearch }: {
  brokerId: string | null; now: number; timeDisplay: TimeDisplayPreference; onPrepareResearch?: (release: InspectorRelease) => void
}) {
  const [visibility, setVisibility] = useState<'active' | 'archived'>('active')
  const highlights = useHighlights(brokerId, 2000, visibility)
  return <div className="highlight-list" aria-label="Highlighted releases">
    <nav className="highlight-views" aria-label="Highlight view"><button type="button" aria-pressed={visibility === 'active'} onClick={() => setVisibility('active')}>Active</button>
      <button type="button" aria-pressed={visibility === 'archived'} onClick={() => setVisibility('archived')}>Archive</button></nav>
    {highlights.error && <p role="status">{highlights.error}</p>}
    {!highlights.error && highlights.offline && <p role="status">Publisher offline · stored values may be stale</p>}
    {!highlights.items.length && <p>{brokerId ? visibility === 'archived' ? 'No archived releases.' : 'Pin releases from Inspector or Alert to keep them here.' : 'Connect calendar storage to load Highlight.'}</p>}
    {highlights.items.map(item => <HighlightCard key={item.id} item={item} now={now} timeDisplay={timeDisplay}
      archive={highlights.archive} restore={highlights.restore} busy={highlights.busy} onPrepareResearch={onPrepareResearch} />)}
  </div>
}
