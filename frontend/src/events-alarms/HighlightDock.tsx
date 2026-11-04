import { Fragment, memo, useId, useMemo, useState } from 'react'
import { jakartaDate, publisherName, type AlertDayGroup } from '../alert/model/alert-day-model'
import { scheduledAnchors, nearestScheduledAnchor } from '../alert/model/alert-timeline'
import { CalendarBoundary } from '../inspector/CalendarClock'
import { useCountdownNow } from '../inspector/calendar-clock'
import { indexAlarmEvents } from './alarm-event-index'
import { formatInspectorValue } from '../inspector/readings/reading-values'
import { formatAppTimestamp } from '../appearance/time-display/time-display-preference'
import { ReleaseCountdown } from '../alert/highlights/ReleaseCountdown'
import { isInspectorCommentary } from '../inspector/releases/group-releases'
import { EventAlarmButton } from './EventAlarmButton'
import { ExternalEventDetails } from './ExternalEventDetails'
import { SavedReleaseResearch } from '../alert/highlights/SavedReleaseResearch'
import { jakartaDisplay } from './alarm-time'
import type { useAlarms } from './useAlarms'
import { ImpactBadge, ImpactDetails } from '../alert/impact/ImpactBadge'
import type { useAlertImpact } from '../alert/impact/useAlertImpact'

type TableProps = { groups: AlertDayGroup[]; sourceId: string; alarms: ReturnType<typeof useAlarms>; now: number; focusKey: string | null; focusRequest?: number; date?: string; impact: ReturnType<typeof useAlertImpact> }
function NowLine({ now, at }: { now: number; at: number }) {
  const clock = useCountdownNow(now)
  return <tbody className="alert-now-line"><tr><td colSpan={8}>
    <span><time>{formatAppTimestamp(clock, jakartaDisplay, 'time-short')}</time> Jakarta · Now · nearest scheduled event {formatAppTimestamp(at, jakartaDisplay, 'time-short')}</span>
  </td></tr></tbody>
}
export const HighlightDock = memo(function HighlightDock({ groups, ...props }: TableProps) {
  // Visual batches are independent of publication identities and alarm choices.
  const ordered = useMemo(() => [...groups].sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity)
    || a.currency.localeCompare(b.currency) || a.title.localeCompare(b.title) || a.key.localeCompare(b.key)), [groups])
  const sameTime = (a: AlertDayGroup, b?: AlertDayGroup) => a.at !== null && a.at === b?.at && a.currency === b.currency
  const alarmIndex = useMemo(() => indexAlarmEvents(props.alarms.data?.events ?? []), [props.alarms.data?.events])
  const anchors = useMemo(() => scheduledAnchors(ordered), [ordered])
  const midpoints = useMemo(() => anchors.slice(1).map((anchor, index) => Math.ceil((anchor.at + anchors[index].at) / 2)), [anchors])
  const [anchorNow, setAnchorNow] = useState(props.now)
  const nearest = nearestScheduledAnchor(anchors, anchorNow)
  const showNow = props.date === jakartaDate(anchorNow)
  return <><CalendarBoundary times={midpoints} onBoundary={setAnchorNow} timeDisplay={jakartaDisplay} />
  <table className="alert-event-table" aria-label="Events on selected date">
    <thead><tr><th>Time · Jakarta</th><th>Event</th><th>Actual</th><th>Forecast</th><th>Previous</th><th>Source</th><th>Agent impact</th><th><span className="alert-sr-only">Alarm</span></th></tr></thead>
    {ordered.map((group, index) => <Fragment key={group.key}>
      {showNow && nearest?.index === index && <NowLine now={anchorNow} at={nearest.at} />}
      <EventGroup group={group} alarmIndex={alarmIndex}
        startsTime={!sameTime(group, ordered[index - 1])} endsTime={!sameTime(group, ordered[index + 1])} {...props} />
    </Fragment>)}
  </table></>
})

const EventGroup = memo(function EventGroup({ group, startsTime, endsTime, sourceId, alarms, now, focusKey, focusRequest, impact, alarmIndex }: Omit<TableProps, 'groups'> & { group: AlertDayGroup; startsTime: boolean; endsTime: boolean; alarmIndex: ReturnType<typeof indexAlarmEvents> }) {
  const focused = group.key === focusKey || group.external.some(item => item.key === focusKey)
  const [expanded, setExpanded] = useState(focused)
  const focusToken = focused ? focusRequest ?? focusKey : null
  const [expandedFor, setExpandedFor] = useState(focusToken)
  if (expandedFor !== focusToken) {
    setExpandedFor(focusToken)
    if (focused) setExpanded(true)
  }
  const [tab, setTab] = useState<'overview' | 'sources' | 'research'>('overview')
  const panelId = useId(), tabId = useId(), series = group.release?.events ?? []
  const total = series.length + group.external.length
  const numeric = series.filter(event => !isInspectorCommentary(event)), arrived = numeric.filter(event => event.actual !== null).length
  const elapsed = group.at !== null && group.at <= now
  const status = group.at === null ? 'Time unconfirmed' : !elapsed ? null : series.length
    ? !numeric.length ? 'Elapsed' : arrived === numeric.length ? 'Released' : arrived ? 'Partial data' : 'Awaiting data' : 'Elapsed · verify outcome'
  const shared = (first: boolean) => first ? <>
    <td rowSpan={total}><EventAlarmButton alarms={alarms} group={group} sourceId={sourceId} now={now} alarmIndex={alarmIndex} /></td>
  </> : null
  const pending = (commentary = false, external = false) => group.at === null ? 'Time unconfirmed'
    : !elapsed ? <ReleaseCountdown at={group.at} now={now} />
    : external ? 'Elapsed · verify outcome' : commentary ? 'Elapsed' : 'Awaiting data'
  const time = group.at === null ? '—' : formatAppTimestamp(group.at, jakartaDisplay, 'time-short')
  const timeCell = <td rowSpan={total} className="alert-time-cell">{startsTime
    ? <><time>{time}</time><small>{group.currency}</small></>
    : <span className="alert-sr-only">{time} · {group.currency}</span>}</td>
  const toggle = (label: string) => <button type="button" className="alert-event-name" aria-expanded={expanded} aria-controls={panelId}
    onClick={() => setExpanded(value => !value)}><span aria-hidden="true">{expanded ? '▾' : '▸'}</span>{label}</button>
  return <tbody className={`alert-event-group${startsTime ? ' alert-time-start' : ''}${endsTime ? ' alert-time-end' : ''}${focused ? ' alert-event-focused' : ''}`} data-alert-focused={focused || undefined} data-alert-id={group.key} data-external-key={group.external[0]?.key}>
    {series.map((event, index) => <tr key={event.value_id} data-series-id={event.event_id}>
      {index === 0 && timeCell}
      <th scope="row">{toggle(event.name)}{'availability' in event && event.availability !== 'observed' && <small>Latest observation unavailable</small>}</th>
      <td className={`alert-value${event.actual === null ? ' alert-value-pending' : ''}`}>{event.actual === null ? pending(isInspectorCommentary(event)) : formatInspectorValue(event.actual, event)}</td>
      {[event.forecast, event.previous].map((value, i) => <td className="alert-value" key={i}>{formatInspectorValue(value, event)}</td>)}
      <td className="alert-source-cell" title={sourceId}>Pepperstone</td><td><ImpactBadge item={impact.byValueId.get(event.value_id)} /></td>{shared(index === 0)}
    </tr>)}
    {group.external.map((item, index) => { const first = series.length === 0 && index === 0; return <tr key={item.key} data-external-key={item.key}>
      {first && timeCell}
      <th scope="row">{toggle(item.title)}</th><td className="alert-value alert-value-pending">{pending(false, true)}</td><td className="alert-value">—</td><td className="alert-value">—</td>
      <td className="alert-source-cell">{item.sources.filter(source => source.kind === 'web').slice(0, 1).map(source =>
        <a href={source.locator} target="_blank" rel="noreferrer" key={source.locator}>{publisherName(source)}</a>)}</td><td><ImpactBadge item={impact.byKey.get(`external:${item.key}`)} /></td>{shared(first)}
    </tr> })}
    {expanded && <tr className="alert-details-row"><td colSpan={8}><section id={panelId} className="alert-event-details" aria-label={`Details for ${group.title}`}>
      <header><div><span>{group.currency} · {time} Jakarta</span><h3>{group.title}</h3></div><button type="button" aria-label={`Close ${group.title} details`} onClick={() => setExpanded(false)}>×</button></header>
      <nav role="tablist" aria-label="Event details" onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
        const index = tabs.indexOf(event.target as HTMLButtonElement)
        if (index < 0) return
        event.preventDefault()
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
        tabs[next].click(); tabs[next].focus()
      }}>{(['overview', 'sources', ...(group.release ? ['research'] : [])]).map(value => <button type="button" role="tab" key={value}
        id={`${tabId}-${value}`} aria-controls={`${panelId}-body`} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value as typeof tab)}>
        {value === 'overview' ? 'Overview' : value === 'sources' ? 'Sources & history' : 'Saved research'}</button>)}</nav>
      <div id={`${panelId}-body`} role="tabpanel" aria-labelledby={`${tabId}-${tab}`}>
        {tab === 'overview' && <>
          <p className="alert-details-status">{status ?? 'Scheduled'}{group.at === null ? ' · No exact publication hour is assumed.' : ` · ${formatAppTimestamp(group.at, jakartaDisplay)} Jakarta`}</p>
          {[...new Map([...series.flatMap(event => impact.byValueId.get(event.value_id) ?? []),
            ...group.external.flatMap(item => impact.byKey.get(`external:${item.key}`) ?? [])].map(item => [item.id, item])).values()]
            .map(item => <ImpactDetails key={item.id} item={item} />)}
          {!!series.length && <dl className="alert-reading-metadata">{series.map(event => <Fragment key={event.value_id}>
            <dt>{event.name}</dt><dd>{event.period_seconds > 0 ? `Reference period: ${new Date(event.period_seconds * 1000).toISOString().slice(0, 10)} · ` : ''}
              Revision {event.revision}{event.revised_previous !== null && ` · Revised previous: ${formatInspectorValue(event.revised_previous, event)}`}</dd>
          </Fragment>)}</dl>}
          {group.external.map(item => <div key={item.key} className="alert-fact-summary"><h4>{item.title}</h4><p>{item.facts}</p>
            {item.interpretation && <details><summary>Interpretation at save time</summary><p>{item.interpretation}</p></details>}</div>)}
        </>}
        {tab === 'sources' && <>
          {!!series.length && <><p>Pepperstone · {sourceId}. Forecasts retain their supplied values; other publishers may use different expectations or capture times.</p>
            <dl className="alert-reading-metadata">{series.map(event => <Fragment key={event.value_id}><dt>{event.name}</dt><dd>Series {event.event_id} · Value {event.value_id}
              {'observed_at' in event && typeof event.observed_at === 'number' && ` · Captured ${formatAppTimestamp(event.observed_at * 1000, jakartaDisplay)} Jakarta`}
              {event.forecast_raw_scaled_1e6 != null && ` · Raw forecast ×10⁶: ${event.forecast_raw_scaled_1e6}`}</dd></Fragment>)}</dl></>}
          {group.external.map(item => <ExternalEventDetails key={item.key} item={item} />)}
        </>}
        {tab === 'research' && <SavedReleaseResearch sourceId={sourceId} valueIds={group.valueIds} currency={group.currency} events={series} />}
      </div>
    </section></td></tr>}
  </tbody>
})
