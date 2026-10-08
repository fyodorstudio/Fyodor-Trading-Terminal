import { formatAppTimestamp, type TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import type { InspectorEvent } from './inspector-data'

export function InspectorReadingTime({ event, timeDisplay }: {
  event: InspectorEvent; brokerTime: boolean; timeDisplay: TimeDisplayPreference
}) {
  return <td className="inspector-reading-time">
    <time data-reading-clock="display">{event.release_at === null ? 'Display time unavailable' : formatAppTimestamp(event.release_at, timeDisplay)}</time>
    {event.time_mode !== 0 && <small>Time uncertain</small>}
  </td>
}
