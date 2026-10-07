import type { ITimeScaleApi, Time } from 'lightweight-charts'
import type { InspectorMarker } from '../inspector-data'
import { inspectorMarkerCoordinate } from '../marker-position'

export type MarkerCluster = { x: number; markers: InspectorMarker[] }
export function indexMarkers(markers: readonly InspectorMarker[]) {
  return {
    anchored: markers.filter(marker => !marker.projection).sort((a, b) => a.time - b.time),
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
  // Blank future space is outside getVisibleRange's loaded candles. Keep
  // projected releases eligible and let logical coordinates clip them instead.
  const positioned = [...anchored, ...index.projected].flatMap(marker => {
    const x = inspectorMarkerCoordinate(scale, marker)
    return x !== null && Number.isFinite(x) && x >= 0 && x <= width ? [{ marker, x: Number(x) }] : []
  }).sort((a, b) => a.x - b.x)
  const clusters: MarkerCluster[] = []
  for (const { marker, x } of positioned) {
    const previous = clusters.at(-1)
    if (previous && x - previous.x < 36) previous.markers.push(marker)
    else clusters.push({ x, markers: [marker] })
  }
  return clusters
}
export function sameMarkerClusters(a: readonly MarkerCluster[], b: readonly MarkerCluster[]) {
  return a.length === b.length && a.every((cluster, i) => cluster.x === b[i].x &&
    cluster.markers.length === b[i].markers.length && cluster.markers.every((marker, j) => marker === b[i].markers[j]))
}
