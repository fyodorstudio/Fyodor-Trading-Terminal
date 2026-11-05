import { Fragment, memo, useId, useMemo, useState } from 'react'
import { jakartaDate, publisherName, type AlertDayGroup } from '../alert/model/alert-day-model'
import { currentTimePosition } from '../alert/model/alert-timeline'
import { CalendarBoundary } from '../inspector/CalendarClock'
import { useCountdownNow } from '../inspector/calendar-clock'
import { indexAlarmEvents } from './alarm-event-index'
import { formatInspectorValue } from '../inspector/readings/reading-values'
import { formatAppTimestamp } from '../appearance/time-display/time-display-preference'
import { ReleaseCountdown } from '../alert/highlights/ReleaseCountdown'
import { isInspectorCommentary } from '../inspector/releases/group-releases'
import { EventAlarmButton } from './EventAlarmButton'
import { ExternalEventDetails } from './ExternalEventDetails'
import { jakartaDisplay } from './alarm-time'
import type { useAlarms } from './useAlarms'
import { ImpactBadge, ImpactDetails } from '../alert/impact/ImpactBadge'
import type { useAlertImpact } from '../alert/impact/useAlertImpact'
import { eventPublisher } from '../event-tiers/event-tiers'

type TableProps = { groups: AlertDayGroup[]; sourceId: string; alarms: ReturnType<typeof useAlarms>; now: number; focusKey: string | null; focusRequest?: number; date?: string; impact: ReturnType<typeof useAlertImpact> }
type AlertRow = AlertDayGroup & { rowId: string; alarmGroup: AlertDayGroup; showAlarm: boolean }
function NowLine({ now }: { now: number }) {
  const clock = useCountdownNow(now)
  return <tbody className="alert-now-line"><tr><td colSpan={8}>
    <span><time aria-label="Current time in Jakarta">{formatAppTimestamp(clock, jakartaDisplay, 'time-short')}</time></span>
  </td></tr></tbody>
}
export const HighlightDock = memo(function HighlightDock({ groups, ...props }: TableProps) {
  // Visual batches are independent of publication identities and alarm choices.
  const ordered = useMemo((): AlertRow[] => [...groups].sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity)
    || a.currency.localeCompare(b.currency) || a.title.localeCompare(b.title) || a.key.localeCompare(b.key)).flatMap(group => {
      // Packages own reminder identity only. Every displayed event owns its
      // summary, expansion and details, including explicitly linked web rows.
      const rows = [
        ...(group.release?.events ?? []).map(event => ({ ...group, title: event.name,
          rowId: `${group.key}/value/${event.value_id}`, release: { ...group.release!, events: [event] }, external: [] })),
        ...group.external.map(item => ({ ...group, title: item.title,
          rowId: `${group.key}/external/${item.key}`, release: undefined, external: [item] })),
      ]
      return rows.map((row, index) => ({ ...row, alarmGroup: group, showAlarm: index === 0 }))
    }), [groups])
  const sameTime = (a: AlertDayGroup, b?: AlertDayGroup) => a.at !== null && a.at === b?.at && a.currency === b.currency
  const alarmIndex = useMemo(() => indexAlarmEvents(props.alarms.data?.events ?? []), [props.alarms.data?.events])
  const times = useMemo(() => ordered.flatMap(group => group.at === null ? [] : [group.at]), [ordered])
  const [timelineNow, setTimelineNow] = useState(props.now)
  const position = currentTimePosition(ordered, timelineNow)
  const showNow = times.length > 0 && props.date === jakartaDate(timelineNow)
  return <><CalendarBoundary times={times} onBoundary={setTimelineNow} timeDisplay={jakartaDisplay} />
  <table className="alert-event-table" aria-label="Events on selected date">
    <thead><tr><th>Time · Jakarta</th><th>Event</th><th>Actual</th><th>Forecast</th><th>Previous</th><th>Source</th><th>Tier</th><th><span className="alert-sr-only">Alarm</span></th></tr></thead>
    {ordered.map((group, index) => <Fragment key={group.rowId}>
      {showNow && position === index && <NowLine now={timelineNow} />}
      <EventGroup group={group} alarmIndex={alarmIndex}
        startsClock={group.at === null || group.at !== ordered[index - 1]?.at}
        endsClock={group.at === null || group.at !== ordered[index + 1]?.at}
        startsTime={!sameTime(group, ordered[index - 1])} endsTime={!sameTime(group, ordered[index + 1])} {...props} />
    </Fragment>)}
    {showNow && position === ordered.length && <NowLine now={timelineNow} />}
  </table></>
})

const EventGroup = memo(function EventGroup({ group, startsClock, endsClock, startsTime, endsTime, sourceId, alarms, now, focusKey, focusRequest, impact, alarmIndex }: Omit<TableProps, 'groups'> & { group: AlertRow; startsClock: boolean; endsClock: boolean; startsTime: boolean; endsTime: boolean; alarmIndex: ReturnType<typeof indexAlarmEvents> }) {
  const focused = group.showAlarm && group.key === focusKey || group.external.some(item => item.key === focusKey)
  const [expanded, setExpanded] = useState(focused)
  const focusToken = focused ? focusRequest ?? focusKey : null
  const [expandedFor, setExpandedFor] = useState(focusToken)
  if (expandedFor !== focusToken) {
    setExpandedFor(focusToken)
    if (focused) setExpanded(true)
  }
  const [hoverDismissed, setHoverDismissed] = useState(false)
  const panelId = useId(), series = group.release?.events ?? []
  const numeric = series.filter(event => !isInspectorCommentary(event)), arrived = numeric.filter(event => event.actual !== null).length
  const elapsed = group.at !== null && group.at <= now
  const status = group.at === null ? 'Time unconfirmed' : !elapsed ? null : series.length
    ? !numeric.length ? 'Elapsed' : arrived === numeric.length ? 'Released' : arrived ? 'Partial data' : 'Awaiting data' : 'Elapsed · verify outcome'
  const shared = (first: boolean) => first ? <>
    <td>{group.showAlarm && <EventAlarmButton alarms={alarms} group={group.alarmGroup} sourceId={sourceId} now={now} alarmIndex={alarmIndex} />}</td>
  </> : null
  const pending = (commentary = false, external = false) => group.at === null ? 'Time unconfirmed'
    : !elapsed ? <span className="alert-release-countdown"><ReleaseCountdown at={group.at} now={now} /></span>
    : external ? 'Elapsed · verify outcome' : commentary ? 'Elapsed' : 'Awaiting data'
  const time = group.at === null ? '—' : formatAppTimestamp(group.at, jakartaDisplay, 'time-short')
  const timeCell = <td className="alert-time-cell">{startsTime
    ? <>{startsClock ? <time>{time}</time> : <span className="alert-sr-only">{time}</span>}<small>{group.currency}</small></>
    : <span className="alert-sr-only">{time} · {group.currency}</span>}</td>
  const changeExpanded = () => { setExpanded(value => !value); setHoverDismissed(expanded) }
  const clickRow = (event: React.MouseEvent<HTMLTableRowElement>) => {
    if ((event.target as Element).closest('button, a, input, select, label, summary, details')) return
    changeExpanded()
  }
  const toggle = (label: string) => <button type="button" className="alert-event-name" aria-expanded={expanded} aria-controls={panelId}
    onClick={changeExpanded}><span aria-hidden="true">{expanded ? '▾' : '▸'}</span>{label}</button>
  return <tbody className={`alert-event-group${startsClock ? ' alert-clock-start' : ''}${endsClock ? ' alert-clock-end' : ''}${startsTime ? ' alert-time-start' : ''}${endsTime ? ' alert-time-end' : ''}${focused && expanded ? ' alert-event-focused' : ''}${hoverDismissed ? ' alert-hover-dismissed' : ''}`} onPointerLeave={() => setHoverDismissed(false)} data-alert-focused={focused || undefined} data-alert-id={group.key} data-external-key={group.external[0]?.key}>
    {series.map((event, index) => { const publisher = eventPublisher(event)
      const value = (amount: number | null) => publisher && amount !== null
        ? <a href={publisher.url} target="_blank" rel="noreferrer" title={`${publisher.label} · actual/previous release`}>{formatInspectorValue(amount, event)}</a>
        : formatInspectorValue(amount, event)
      return <tr key={event.value_id} data-series-id={event.event_id} className="alert-summary-row" onClick={clickRow}>
      {index === 0 && timeCell}
      <th scope="row">{toggle(event.name)}{'availability' in event && event.availability !== 'observed' && <small>Latest observation unavailable</small>}</th>
      <td className={`alert-value${event.actual === null ? ' alert-value-pending' : ''}`}>{event.actual === null ? pending(isInspectorCommentary(event)) : value(event.actual)}</td>
      <td className="alert-value" title="Captured consensus forecast; survey provider not identified">{formatInspectorValue(event.forecast, event)}</td>
      <td className="alert-value">{value(event.previous)}</td>
      <td className="alert-source-cell" title={sourceId}>{publisher ? <a href={publisher.url} target="_blank" rel="noreferrer">{publisher.label}</a> : '—'}</td><td><ImpactBadge event={event} item={impact.byValueId.get(event.value_id)} /></td>{shared(index === 0)}
    </tr>})}
    {group.external.map((item, index) => { const first = series.length === 0 && index === 0; return <tr key={item.key} data-external-key={item.key} className="alert-summary-row" onClick={clickRow}>
      {first && timeCell}
      <th scope="row">{toggle(item.title)}</th><td className="alert-value alert-value-pending">{pending(false, true)}</td><td className="alert-value">—</td><td className="alert-value">—</td>
      <td className="alert-source-cell">{item.sources.filter(source => source.kind === 'web').slice(0, 1).map(source =>
        <a href={source.locator} target="_blank" rel="noreferrer" key={source.locator}>{publisherName(source)}</a>)}</td><td><ImpactBadge item={impact.byKey.get(`external:${item.key}`)} /></td>{shared(first)}
    </tr> })}
    {expanded && <tr className="alert-details-row"><td colSpan={8}><section id={panelId} className="alert-event-details" aria-label={`Details for ${group.title}`}>
      <header><h3>{group.title}</h3><span className="alert-overview-label">Overview</span><span>{group.currency} · {time} Jakarta</span>
      </header>
          <p className="alert-details-status">{status ?? 'Scheduled'}{group.at === null ? ' · No exact publication hour is assumed.' : ` · ${formatAppTimestamp(group.at, jakartaDisplay)} Jakarta`}</p>
          {[...new Map([...series.flatMap(event => impact.byValueId.get(event.value_id) ?? []),
            ...group.external.flatMap(item => impact.byKey.get(`external:${item.key}`) ?? [])].map(item => [item.id, item])).values()]
            .map(item => <ImpactDetails key={item.id} item={item} event={series.find(event => impact.byValueId.get(event.value_id)?.id === item.id)} />)}
          {!!series.length && <dl className="alert-reading-metadata">{series.map(event => <Fragment key={event.value_id}>
            <dt>{event.name}</dt><dd>{event.period_seconds > 0 ? `Reference period: ${new Date(event.period_seconds * 1000).toISOString().slice(0, 10)} · ` : ''}
              Revision {event.revision}{event.revised_previous !== null && ` · Revised previous: ${formatInspectorValue(event.revised_previous, event)}`}</dd>
          </Fragment>)}</dl>}
          {group.external.map(item => <div key={item.key} className="alert-fact-summary"><h4>{item.title}</h4><p>{item.facts}</p>
            {item.interpretation && <details><summary>Interpretation at save time</summary><p>{item.interpretation}</p></details>}</div>)}
          {group.external.map(item => <ExternalEventDetails key={item.key} item={item} compact />)}
          {!!series.length && <details><summary>Source details &amp; captured IDs</summary>
          {!!series.length && <><p>Pepperstone · {sourceId}. Forecasts retain their supplied values; other publishers may use different expectations or capture times.</p>
            <dl className="alert-reading-metadata">{series.map(event => <Fragment key={event.value_id}><dt>{event.name}</dt><dd>Series {event.event_id} · Value {event.value_id}
              {'observed_at' in event && typeof event.observed_at === 'number' && ` · Captured ${formatAppTimestamp(event.observed_at * 1000, jakartaDisplay)} Jakarta`}
              {event.forecast_raw_scaled_1e6 != null && ` · Raw forecast ×10⁶: ${event.forecast_raw_scaled_1e6}`}</dd></Fragment>)}</dl></>}
          </details>}
    </section></td></tr>}
  </tbody>
})
