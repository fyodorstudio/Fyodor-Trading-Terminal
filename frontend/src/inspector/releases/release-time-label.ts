import { formatAppTimestamp, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import type { InspectorRelease } from '../../economic-calendar/releases/release'

export function releaseTimeLabel(release: InspectorRelease, display: TimeDisplayPreference) {
  if (release.daily) return formatAppTimestamp(Date.parse(`${release.daily.date}T00:00:00Z`), { mode: 'utc', utcOffsetMinutes: 0 }, 'date')
  if (release.timingUncertain && release.serverTime > 0 && Number.isFinite(release.serverTime))
    return `${new Date(release.serverTime * 1000).toISOString().slice(0, 10)} · Date only`
  return release.releaseAt === null ? 'Time unavailable' : formatAppTimestamp(release.releaseAt, display)
}
