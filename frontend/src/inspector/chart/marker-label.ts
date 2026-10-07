import { formatAppTimestamp, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import type { InspectorMarker } from '../inspector-data'

type MarkerLabel = { time: string; description: string }
const labels = new WeakMap<TimeDisplayPreference, WeakMap<InspectorMarker, MarkerLabel>>()

// Format only visible markers, once per immutable marker/display preference.
export function markerLabel(marker: InspectorMarker, timeDisplay: TimeDisplayPreference): MarkerLabel {
  let cache = labels.get(timeDisplay)
  if (!cache) { cache = new WeakMap(); labels.set(timeDisplay, cache) }
  const known = cache.get(marker)
  if (known) return known
  const time = marker.release.events.some(event => 'chart_time_seconds' in event)
    ? `${formatAppTimestamp(marker.release.chartTime! * 1000, { mode: 'utc', utcOffsetMinutes: 0 })} · broker time`
    : formatAppTimestamp(marker.release.releaseAt!, timeDisplay)
  const value = { time, description: `${marker.release.currency} · ${marker.release.label} · ${time}` }
  cache.set(marker, value)
  return value
}
