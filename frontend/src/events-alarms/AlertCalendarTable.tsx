import { Fragment, memo, useId, useMemo, useState } from 'react'
import { jakartaDate, type AlertDayGroup } from '../alert/model/alert-day-model'
import { currentTimePosition } from '../alert/model/alert-timeline'
import { CalendarBoundary } from '../inspector/CalendarClock'
import { useCountdownNow } from '../inspector/calendar-clock'
import { indexAlarmEvents } from './alarm-event-index'
import { formatInspectorValue } from '../inspector/readings/reading-values'
import { actualImpact } from '../economic-calendar/presentation/actual-impact'
import { formatAppTimestamp } from '../appearance/time-display/time-display-preference'
import { ReleaseCountdown } from '../alert/highlights/ReleaseCountdown'
import { isInspectorCommentary } from '../inspector/releases/group-releases'
import { EventAlarmButton } from './EventAlarmButton'
import { jakartaDisplay } from './alarm-time'
import type { useAlarms } from './useAlarms'

type Props = { groups: AlertDayGroup[]; sourceId: string; alarms: ReturnType<typeof useAlarms>; now: number; focusKey: string | null; focusRequest?: number; date?: string }
type Row = AlertDayGroup & { rowId: string; alarmGroup: AlertDayGroup; showAlarm: boolean }
function NowLine({ now }: { now: number }) {
  const clock = useCountdownNow(now)
  return <tbody className="alert-now-line"><tr><td colSpan={6}><span><time aria-label="Current time in Jakarta">{formatAppTimestamp(clock, jakartaDisplay, 'time-short')}</time></span></td></tr></tbody>
}
export const AlertCalendarTable = memo(function AlertCalendarTable({ groups, ...props }: Props) {
  const ordered = useMemo((): Row[] => [...groups].sort((a,b) => (a.at ?? Infinity) - (b.at ?? Infinity) || a.currency.localeCompare(b.currency) || a.key.localeCompare(b.key)).flatMap(group =>
    group.release.events.map((event, index) => ({ ...group, title: event.name, rowId: `${group.key}/value/${event.value_id}`, release: { ...group.release, events: [event] }, alarmGroup: group, showAlarm: index === 0 }))), [groups])
  const alarmIndex = useMemo(() => indexAlarmEvents(props.alarms.data?.events ?? []), [props.alarms.data?.events])
  const times = useMemo(() => ordered.flatMap(group => group.at === null ? [] : [group.at]), [ordered])
  const [timelineNow, setTimelineNow] = useState(props.now)
  const position = currentTimePosition(ordered, timelineNow), showNow = times.length > 0 && props.date === jakartaDate(timelineNow)
  return <><CalendarBoundary times={times} onBoundary={setTimelineNow} timeDisplay={jakartaDisplay} /><table className="alert-event-table" aria-label="Events on selected date">
    <thead><tr><th>Time · Jakarta</th><th>Event</th><th>Actual</th><th>Forecast</th><th>Previous</th><th><span className="alert-sr-only">Alarm</span></th></tr></thead>
    {ordered.map((group,index) => <Fragment key={group.rowId}>{showNow && position === index && <NowLine now={timelineNow} />}<CalendarRow group={group} alarmIndex={alarmIndex} startsClock={index === 0 || ordered[index-1].at !== group.at} endsClock={index === ordered.length-1 || ordered[index+1].at !== group.at} {...props} /></Fragment>)}
    {showNow && position === ordered.length && <NowLine now={timelineNow} />}
  </table></>
})
function CalendarRow({ group, alarms, sourceId, now, focusKey, focusRequest, alarmIndex, startsClock, endsClock }: Omit<Props, 'groups'> & { group: Row; alarmIndex: ReturnType<typeof indexAlarmEvents>; startsClock: boolean; endsClock: boolean }) {
  const focused = group.showAlarm && group.key === focusKey
  const [expanded,setExpanded] = useState(focused), [expandedFor,setExpandedFor] = useState(focused ? focusRequest : null)
  if (focused && expandedFor !== focusRequest) { setExpandedFor(focusRequest); setExpanded(true) }
  const panelId=useId(), event=group.release.events[0], elapsed=group.at !== null && group.at <= now
  const pending=group.at === null ? 'Time unconfirmed' : !elapsed ? <ReleaseCountdown at={group.at} now={now} /> : isInspectorCommentary(event) ? 'Elapsed' : 'Awaiting data'
  return <tbody className={`alert-event-group${startsClock ? ' alert-clock-start alert-time-start' : ''}${endsClock ? ' alert-clock-end alert-time-end' : ''}${focused && expanded ? ' alert-event-focused' : ''}`} data-alert-focused={focused || undefined} data-alert-id={group.key}>
    <tr data-series-id={event.event_id} className="alert-summary-row" onClick={e => { if (!(e.target as Element).closest('button,a')) setExpanded(!expanded) }}>
      <td className="alert-time-cell"><time>{group.at === null ? '—' : formatAppTimestamp(group.at,jakartaDisplay,'time-short')}</time><small>{group.currency}</small></td>
      <th scope="row"><button type="button" className="alert-event-name" aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded(!expanded)}><span aria-hidden="true">{expanded ? '▾' : '▸'}</span>{event.name}</button></th>
      <td className={`alert-value${event.actual === null ? ' alert-value-pending' : ''}`} data-mt5-impact={actualImpact(event.actual,event.impact)}>{event.actual === null ? pending : formatInspectorValue(event.actual,event)}</td>
      <td className="alert-value">{formatInspectorValue(event.forecast,event)}</td><td className="alert-value">{formatInspectorValue(event.previous,event)}</td>
      <td>{group.showAlarm && <EventAlarmButton alarms={alarms} group={group.alarmGroup} sourceId={sourceId} now={now} alarmIndex={alarmIndex} />}</td>
    </tr>
    {expanded && <tr className="alert-details-row"><td colSpan={6}><section id={panelId} className="alert-event-details" aria-label={`Details for ${event.name}`}><header><h3>{event.name}</h3><span>{sourceId}</span></header>
      <p>{group.at === null ? 'Time unconfirmed' : formatAppTimestamp(group.at,jakartaDisplay)}</p>
      {event.period_seconds > 0 && <p>Period: {new Date(event.period_seconds*1000).toISOString().slice(0,10)}</p>}
      {event.revised_previous !== null && <p>Revised previous: {formatInspectorValue(event.revised_previous,event)}</p>}
    </section></td></tr>}
  </tbody>
}
