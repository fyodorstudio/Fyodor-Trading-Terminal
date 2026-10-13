import { memo, useId, useMemo, useState } from 'react'
import { formatAppTimestamp, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import type { InspectorRelease } from '../../economic-calendar/releases/release'
import { groupInspectorReleases } from '../../inspector/releases/group-releases'
import { formatInspectorValue } from '../../inspector/readings/reading-values'
import { InspectorReadingTime } from '../../inspector/InspectorReadingTime'
import { alertCountdown } from '../model/alert-episodes'
import { highlightState, highlightPrompt, type Highlight } from './highlight-model'
import { useHighlights } from './useHighlights'
import { majorForexPairs } from '../../economic-calendar/forex/pairs'
import { HighlightJournal, type JournalView } from './HighlightJournal'
import { DiscoveredLimitations } from './DiscoveredLimitations'

const HighlightCard = memo(function HighlightCard({ item, now, timeDisplay, archive, restore, busy, onPrepareResearch }: {
  item: Highlight; now: number; timeDisplay: TimeDisplayPreference; archive: (id: string) => Promise<void>; restore: (id: string) => Promise<void>; busy: boolean
  onPrepareResearch?: (release: InspectorRelease) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const contentId = useId()
  const [view, setView] = useState<JournalView | 'prompt' | 'readings'>('before')
  const scopes = useMemo(() => [...new Set([item.currency, ...majorForexPairs.filter(pair => pair.includes(item.currency)), ...(item.journal ?? []).map(entry => entry.scope), ...(item.prompts ?? []).map(entry => entry.scope)])], [item.currency, item.journal, item.prompts])
  const [scope, setScope] = useState(() => item.prompts?.at(-1)?.scope ?? item.journal?.at(-1)?.scope ?? item.currency)
  const [promptPhase, setPromptPhase] = useState<'prepare' | 'after'>(() => item.prompts?.length && item.release_at !== null && item.release_at > now ? 'prepare' : 'after')
  const [copyStatus, setCopyStatus] = useState('')
  const prompt = useMemo(() => highlightPrompt(item, scope, promptPhase), [item, scope, promptPhase])
  async function copyPrompt() {
    try { await navigator.clipboard.writeText(prompt); setCopyStatus('Prompt copied') }
    catch { setCopyStatus('Clipboard unavailable. Copy the text from Prompt preview.'); setView('prompt'); setExpanded(true) }
  }
  const releases = useMemo(() => groupInspectorReleases(item.events), [item.events])
  const state = highlightState(item, now)
  const future = item.events.filter(event => event.release_at !== null && event.time_mode === 0 && event.release_at > now)
  const next = future.length ? Math.min(...future.map(event => event.release_at!)) : null
  const versions = (item.journal ?? []).filter(entry => entry.scope === scope).length
  return <article className="highlight-card" data-highlight-id={item.id}>
    <div className="highlight-header"><button type="button" className="highlight-toggle" aria-expanded={expanded} aria-controls={contentId}
      onClick={() => setExpanded(value => !value)}><span aria-hidden="true">{expanded ? '▾' : '▸'}</span><span className="alert-currency">{item.currency}</span><strong>{item.label}</strong>
      <time>{item.release_at === null ? item.server_time === null ? 'Date unavailable' : `${formatAppTimestamp(item.server_time * 1000, { mode: 'utc', utcOffsetMinutes: 0 }, 'date')} · time unconfirmed` :
        formatAppTimestamp(item.release_at, timeDisplay)}</time>
      <span className="alert-countdown">{item.archived_utc ? 'Archived' : next !== null ? `${state === 'Upcoming' ? '' : 'Next series · '}${alertCountdown(next, now, true)}` : state}</span>
    </button>
    <div className="highlight-actions">{onPrepareResearch && releases[0] && <button type="button" onClick={() => onPrepareResearch({ ...releases[0],
      label: item.label, events: item.events, releaseAt: item.release_at, serverTime: item.server_time ?? releases[0].serverTime, timingUncertain: item.release_at === null })}
      aria-label={`Prepare research for highlighted ${item.currency} ${item.label}`}>Research</button>}
      <label>Scope <select aria-label={`Research scope for ${item.label}`} value={scope} onChange={event => { setScope(event.target.value); setCopyStatus('') }}>
        {scopes.map(value => <option key={value}>{value}</option>)}</select></label>
      <select aria-label={`Prompt stage for ${item.label}`} value={promptPhase} onChange={event => { setPromptPhase(event.target.value as 'prepare' | 'after'); setCopyStatus('') }}>
        <option value="prepare">Prepare before release</option><option value="after">Interpret after release</option></select>
      <button type="button" onClick={() => void copyPrompt()}>Copy Prompt</button>
      <button type="button" disabled={busy} onClick={() => void (item.archived_utc ? restore(item.id) : archive(item.id))}
        aria-label={`${item.archived_utc ? 'Restore' : 'Archive'} highlight ${item.currency} ${item.label}`}>{item.archived_utc ? 'Restore' : 'Archive'}</button>
    </div>
    </div>
    {copyStatus && <p className="highlight-copy-status" role="status">{copyStatus}</p>}
    <div id={contentId} className="highlight-content" hidden={!expanded}>{expanded && <>
      <div className="highlight-view-toolbar"><label>View <select aria-label={`Journal view for ${item.label}`} value={view}
        onChange={event => setView(event.target.value as typeof view)}>
        <option value="before">Before release</option><option value="after">After release</option>
        <option value="sources">Sources and captured evidence</option><option value="history">Research history ({versions} versions)</option>
        <option value="prompt">Prompt preview · {scope} · {promptPhase === 'prepare' ? 'Before release' : 'After release'}</option>
        <option value="readings">Latest broker readings</option>
      </select></label>
      {item.archived_utc && <span className="highlight-research-meta">Archived {item.archived_utc} · Readings preserved at archive time.</span>}</div>
      {view === 'prompt' ? <textarea readOnly value={prompt} aria-label={`Prompt for ${item.label} ${scope}`} /> :
        view === 'readings' ? <HighlightSeries item={item} timeDisplay={timeDisplay} /> : <HighlightJournal item={item} scope={scope} view={view} />}
    </>}</div>
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
  const [visibility, setVisibility] = useState<'active' | 'archived' | 'limitations'>('active')
  const highlights = useHighlights(visibility === 'limitations' ? null : brokerId, 2000, visibility === 'archived' ? 'archived' : 'active')
  return <div className="highlight-list" aria-label="Highlighted releases">
    <nav className="highlight-views" aria-label="Highlight view"><button type="button" aria-pressed={visibility === 'active'} onClick={() => setVisibility('active')}>Active</button>
      <button type="button" aria-pressed={visibility === 'archived'} onClick={() => setVisibility('archived')}>Archive</button>
      <button type="button" aria-pressed={visibility === 'limitations'} onClick={() => setVisibility('limitations')}>Discovered Limitations</button></nav>
    {visibility === 'limitations' ? <DiscoveredLimitations brokerId={brokerId} /> : <>
    {highlights.error && <p role="status">{highlights.error}</p>}
    {!highlights.error && highlights.offline && <p role="status">Publisher offline · stored values may be stale</p>}
    {!highlights.items.length && <p>{brokerId ? visibility === 'archived' ? 'No archived releases.' : 'Pin releases from Inspector or Alert to keep them here.' : 'Connect calendar storage to load Highlight.'}</p>}
    {highlights.items.map(item => <HighlightCard key={item.id} item={item} now={now} timeDisplay={timeDisplay}
      archive={highlights.archive} restore={highlights.restore} busy={highlights.busy} onPrepareResearch={onPrepareResearch} />)}</>}
  </div>
}
