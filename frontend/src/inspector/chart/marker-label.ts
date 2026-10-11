import { type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { releaseTimeLabel } from '../releases/release-time-label'
import type { InspectorMarker } from '../inspector-data'

type MarkerLabel = { time: string; description: string }
const labels = new WeakMap<TimeDisplayPreference, WeakMap<InspectorMarker, MarkerLabel>>()

// Format only visible markers, once per immutable marker/display preference.
export function markerLabel(marker: InspectorMarker, timeDisplay: TimeDisplayPreference): MarkerLabel {
  let cache = labels.get(timeDisplay)
  if (!cache) { cache = new WeakMap(); labels.set(timeDisplay, cache) }
  const known = cache.get(marker)
  if (known) return known
  const time = releaseTimeLabel(marker.release, timeDisplay)
  const value = { time, description: `${marker.release.currency} · ${marker.release.label} · ${time}` }
  cache.set(marker, value)
  return value
}
