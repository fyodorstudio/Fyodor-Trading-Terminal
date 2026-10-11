import { formatAppTimestamp, type TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import type { InspectorEvent } from './inspector-data'
import { isPublishedTentative } from './releases/group-releases'

export function InspectorReadingTime({ event, timeDisplay }: {
  event: InspectorEvent; brokerTime: boolean; timeDisplay: TimeDisplayPreference
}) {
  const dateOnly = event.time_mode !== 0 && !isPublishedTentative(event)
  return <td className="inspector-reading-time">
    <time data-reading-clock="display">{dateOnly && event.server_time_seconds > 0 ? `${new Date(event.server_time_seconds * 1000).toISOString().slice(0, 10)} · Date only` :
      event.release_at === null ? 'Display time unavailable' : formatAppTimestamp(event.release_at, timeDisplay)}</time>
  </td>
}
