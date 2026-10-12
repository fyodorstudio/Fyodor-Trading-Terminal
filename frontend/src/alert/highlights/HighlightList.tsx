import { memo, useMemo, useState } from 'react'
import { formatAppTimestamp, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import type { InspectorRelease } from '../../economic-calendar/releases/release'
import { groupInspectorReleases } from '../../inspector/releases/group-releases'
import { formatInspectorValue } from '../../inspector/readings/reading-values'
import { InspectorReadingTime } from '../../inspector/InspectorReadingTime'
import { alertCountdown } from '../model/alert-episodes'
import { highlightState, type Highlight } from './highlight-model'
import { useHighlights } from './useHighlights'

const HighlightCard = memo(function HighlightCard({ item, now, timeDisplay, remove, busy, onPrepareResearch }: {
  item: Highlight; now: number; timeDisplay: TimeDisplayPreference; remove: (id: string) => Promise<void>; busy: boolean
  onPrepareResearch?: (release: InspectorRelease) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const releases = useMemo(() => groupInspectorReleases(item.events), [item.events])
  const state = highlightState(item, now)
  const future = item.events.filter(event => event.release_at !== null && event.time_mode === 0 && event.release_at > now)
  const next = future.length ? Math.min(...future.map(event => event.release_at!)) : null
  return <article className="highlight-card" data-highlight-id={item.id}>
    <details onToggle={event => setExpanded(event.currentTarget.open)}><summary><span className="alert-currency">{item.currency}</span><strong>{item.label}</strong>
      <time>{item.release_at === null ? item.server_time === null ? 'Date unavailable' : `${formatAppTimestamp(item.server_time * 1000, { mode: 'utc', utcOffsetMinutes: 0 }, 'date')} · time unconfirmed` :
        formatAppTimestamp(item.release_at, timeDisplay)}</time>
      <span className="alert-countdown">{next !== null ? `${state === 'Upcoming' ? '' : 'Next series · '}${alertCountdown(next, now, true)}` : state}</span>
    </summary>{expanded && <HighlightSeries item={item} timeDisplay={timeDisplay} />}</details>
    <div className="highlight-actions">{onPrepareResearch && releases[0] && <button type="button" onClick={() => onPrepareResearch({ ...releases[0],
      label: item.label, events: item.events, releaseAt: item.release_at, serverTime: item.server_time ?? releases[0].serverTime, timingUncertain: item.release_at === null })}
      aria-label={`Prepare research for highlighted ${item.currency} ${item.label}`}>Research</button>}
      <button type="button" disabled={busy} onClick={() => void remove(item.id)} aria-label={`Remove highlight ${item.currency} ${item.label}`}>Remove pin</button>
    </div>
  </article>
})
const HighlightSeries = memo(function HighlightSeries({ item, timeDisplay }: { item: Highlight; timeDisplay: TimeDisplayPreference }) {
  return <div className="highlight-series"><table aria-label={`${item.label} highlighted series`}>
      <thead><tr><th>Series</th><th>Release time</th><th>Actual</th><th>Forecast</th><th>Previous</th><th>Revised previous</th></tr></thead>
      <tbody>{item.events.map(event => <tr key={event.value_id} data-series-id={event.event_id}>
        <th scope="row">{event.name}<small>{event.period_seconds > 0 && `Period: ${formatAppTimestamp(event.period_seconds * 1000, { mode: 'utc', utcOffsetMinutes: 0 }, 'date')}`}
          {event.revision > 0 && ` · Revision ${event.revision}`}{event.availability !== 'observed' && ' · Latest observation unavailable'}</small></th>
        <InspectorReadingTime event={event} brokerTime timeDisplay={timeDisplay} />
        {[event.actual, event.forecast, event.previous, event.revised_previous].map((value, index) => <td key={index}>{formatInspectorValue(value, event)}</td>)}
      </tr>)}</tbody>
    </table>{!item.events.length && <p>Stored readings unavailable. The pin is retained.</p>}</div>
})
export function HighlightList({ brokerId, now, timeDisplay, onPrepareResearch }: {
  brokerId: string | null; now: number; timeDisplay: TimeDisplayPreference; onPrepareResearch?: (release: InspectorRelease) => void
}) {
  const highlights = useHighlights(brokerId, 2000)
  return <div className="highlight-list" aria-label="Highlighted releases">
    {highlights.error && <p role="status">{highlights.error}</p>}
    {!highlights.error && highlights.offline && <p role="status">Publisher offline · stored values may be stale</p>}
    {!highlights.items.length && <p>{brokerId ? 'Pin releases from Inspector or Alert to keep them here.' : 'Connect calendar storage to load Highlight.'}</p>}
    {highlights.items.map(item => <HighlightCard key={item.id} item={item} now={now} timeDisplay={timeDisplay}
      remove={highlights.remove} busy={highlights.busy} onPrepareResearch={onPrepareResearch} />)}
  </div>
}
