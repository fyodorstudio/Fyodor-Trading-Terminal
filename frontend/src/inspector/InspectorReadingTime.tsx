import { formatAppTimestamp, type TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import { inspectorEventChartTime, type InspectorEvent } from './inspector-data'

export function InspectorReadingTime({ event, brokerTime, timeDisplay }: {
  event: InspectorEvent; brokerTime: boolean; timeDisplay: TimeDisplayPreference
}) {
  const chartTime = inspectorEventChartTime(event)
  return <td className="inspector-reading-time">
    <time data-reading-clock="display">{event.release_at === null ? 'Display time unavailable' : formatAppTimestamp(event.release_at, timeDisplay)}</time>
    {brokerTime && <small data-reading-clock="broker">{chartTime === null ? 'Broker time unavailable' :
      `broker time · ${formatAppTimestamp(chartTime * 1000, { mode: 'utc', utcOffsetMinutes: 0 })}`}</small>}
    {event.time_mode !== 0 && <small>Time uncertain</small>}
  </td>
}
