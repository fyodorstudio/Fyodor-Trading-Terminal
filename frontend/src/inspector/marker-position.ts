import type { ITimeScaleApi, Logical, Time } from 'lightweight-charts'
import type { InspectorMarker } from './inspector-data'

export function inspectorMarkerCoordinate(scale: ITimeScaleApi<Time>, marker: InspectorMarker): number | null {
  if (!marker.projection) return scale.timeToCoordinate(marker.time as Time)
  const anchorIndex = scale.timeToIndex(marker.projection.anchorTime as Time)
  if (anchorIndex === null) return null
  // Logical coordinates work beyond the loaded timeline. Calendar time uses
  // elapsed timeframe slots until actual candles establish broker sessions.
  const coordinate = scale.logicalToCoordinate((Number(anchorIndex) + marker.projection.barsAhead) as Logical)
  return coordinate !== null && Number.isFinite(coordinate) ? Number(coordinate) : null
}
