import type { ITimeScaleApi, Time } from 'lightweight-charts'
import { utcToChartClock, type ChartClockScope } from '../appearance/time-display/chart-clock'
import type { ChartTimeframe } from '../market-data/contracts/ChartTimeframe'
import type { OhlcBar } from '../market-data/contracts/OhlcBar'
import { timeframeSeconds } from '../inspector/chart/build-markers'
import { inspectorMarkerCoordinate } from '../inspector/marker-position'
import type { ExternalSource } from './external-source-model'
import { externalIconEnabled, type ExternalIconPreferences } from './external-icon-visibility'

export type ExternalMarker = { item: ExternalSource; time: number; dayEnd?: number; projection?: { anchorTime: number; barsAhead: number } }
export type ExternalCluster = { x: number; markers: ExternalMarker[] }
export function buildExternalMarkers(items: readonly ExternalSource[], bars: readonly Pick<OhlcBar, 'time'>[], timeframe: ChartTimeframe, clock: ChartClockScope, visibility: ExternalIconPreferences = {}) {
  if (!bars.length) return []
  const last = Number(bars.at(-1)!.time), duration = timeframeSeconds[timeframe]
  return items.flatMap((item): ExternalMarker[] => {
    if (!externalIconEnabled(item, visibility) || item.kind === 'watch' || !item.event_at && !item.event_date) return []
    // A source date marks a day, never a fabricated publication instant.
    const at = item.event_at ? utcToChartClock(Date.parse(item.event_at), clock) : Date.parse(item.event_date! + 'T00:00:00Z')
    if (at === null || !Number.isFinite(at)) return []
    const target = at / 1000, dayEnd = item.event_date ? target + 86400 : undefined
    if (target >= last + duration) {
      const barsAhead = item.event_date ? Math.ceil((target - last) / duration) : Math.floor((target - last) / duration)
      const time = last + barsAhead * duration
      return dayEnd !== undefined && time >= dayEnd ? [] : [{ item, time, dayEnd, projection: { anchorTime: last, barsAhead } }]
    }
    let lo = 0, hi = bars.length - 1
    while (lo <= hi) { const mid = (lo + hi) >>> 1; if (Number(bars[mid].time) <= target) lo = mid + 1; else hi = mid - 1 }
    if (dayEnd !== undefined) {
      const index = hi >= 0 && Number(bars[hi].time) === target ? hi : lo
      const time = index < bars.length ? Number(bars[index].time) : null
      return time !== null && time < dayEnd ? [{ item, time, dayEnd }] : []
    }
    const time = hi >= 0 ? Number(bars[hi].time) : null
    return time !== null && target < time + duration ? [{ item, time }] : []
  }).sort((a, b) => a.time - b.time || a.item.key.localeCompare(b.item.key))
}
export function projectExternalMarkers(scale: ITimeScaleApi<Time>, markers: readonly ExternalMarker[]): ExternalCluster[] {
  const range = scale.getVisibleRange?.(), width = scale.width()
  const clusters: ExternalCluster[] = []
  for (const marker of markers) {
    if (!marker.projection && range && (marker.dayEnd !== undefined ? marker.dayEnd <= Number(range.from) : marker.time < Number(range.from))) continue
    if (!marker.projection && range && marker.time > Number(range.to)) continue
    const placed = marker.dayEnd !== undefined && range && !marker.projection && marker.time < Number(range.from) ? { ...marker, time: Number(range.from) } : marker
    const x = inspectorMarkerCoordinate(scale, placed)
    if (x === null || !Number.isFinite(x) || x < 0 || x > width) continue
    const previous = clusters.at(-1)
    if (previous && Math.abs(x - previous.x) < 36) previous.markers.push(marker)
    else clusters.push({ x, markers: [marker] })
  }
  return clusters
}
export function sameExternalClusters(a: readonly ExternalCluster[], b: readonly ExternalCluster[]) {
  return a.length === b.length && a.every((cluster, index) => cluster.x === b[index].x && cluster.markers.length === b[index].markers.length
    && cluster.markers.every((marker, i) => marker === b[index].markers[i]))
}
