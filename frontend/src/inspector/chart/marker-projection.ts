import type { ITimeScaleApi, Time } from 'lightweight-charts'
import type { InspectorMarker } from '../inspector-data'
import { inspectorMarkerCoordinate } from '../marker-position'

export type MarkerCluster = { x: number; markers: InspectorMarker[] }
export function indexMarkers(markers: readonly InspectorMarker[]) {
  return {
    anchored: markers.filter(marker => !marker.projection && !marker.release.daily).sort((a, b) => a.time - b.time),
    daily: markers.filter(marker => !marker.projection && marker.release.daily).sort((a, b) => a.time - b.time),
    projected: markers.filter(marker => marker.projection),
  }
}
function lowerBound(markers: readonly InspectorMarker[], time: number) {
  let lo = 0, hi = markers.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (markers[mid].time < time) lo = mid + 1; else hi = mid }
  return lo
}
export function projectMarkers(scale: ITimeScaleApi<Time>, index: ReturnType<typeof indexMarkers>): MarkerCluster[] {
  const range = scale.getVisibleRange?.(), width = scale.width()
  const anchored = range ? index.anchored.slice(lowerBound(index.anchored, Number(range.from)),
    lowerBound(index.anchored, Number(range.to) + 1)) : index.anchored
  let firstDay = 0, hi = index.daily.length
  if (range) while (firstDay < hi) {
    const mid = (firstDay + hi) >>> 1
    if (index.daily[mid].release.daily!.endChartTime! <= Number(range.from)) firstDay = mid + 1
    else hi = mid
  }
  const daily = range ? index.daily.slice(firstDay, lowerBound(index.daily, Number(range.to) + 1)) : index.daily
  // Blank future space is outside getVisibleRange's loaded candles. Keep
  // projected releases eligible and let logical coordinates clip them instead.
  const positioned = [...anchored, ...daily, ...index.projected].flatMap(marker => {
    // A day remains selectable on intraday views after its first candle leaves
    // the viewport. Only its visual position moves; publication clocks do not.
    const visibleMarker = range && marker.release.daily && !marker.projection && marker.time < Number(range.from) ?
      { ...marker, time: Number(range.from) } : marker
    const x = inspectorMarkerCoordinate(scale, visibleMarker)
    if (x === null || !Number.isFinite(x) || x < 0 || x > width) return []
    const inset = Math.min(24, width / 2)
    return [{ marker, x: marker.release.daily ? Math.min(width - inset, Math.max(inset, x)) : Number(x) }]
  }).sort((a, b) => a.x - b.x)
  const clusters: MarkerCluster[] = []
  for (const { marker, x } of positioned) {
    const previous = clusters.at(-1)
    const sameDay = marker.release.daily && previous?.markers[0].release.daily?.date === marker.release.daily.date
    if (previous && (sameDay && x === previous.x || !marker.release.daily && !previous.markers[0].release.daily && x - previous.x < 36)) previous.markers.push(marker)
    else clusters.push({ x, markers: [marker] })
  }
  return clusters
}
export function sameMarkerClusters(a: readonly MarkerCluster[], b: readonly MarkerCluster[]) {
  return a.length === b.length && a.every((cluster, i) => cluster.x === b[i].x &&
    cluster.markers.length === b[i].markers.length && cluster.markers.every((marker, j) => marker === b[i].markers[j]))
}
