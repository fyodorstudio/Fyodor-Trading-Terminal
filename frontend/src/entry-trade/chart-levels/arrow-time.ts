import { drawingLogicalToTime, type DrawingTimeline } from '../../market-data/chart-drawings/drawing-coordinates'
import { timeframeToSeconds } from '../../market-data/chart-drawings/position-drawing-geometry'
import type { ChartTimeframe } from '../../market-data/contracts/ChartTimeframe'
export function hasArrowCandle(time: number, bars: DrawingTimeline) {
  let low = 0, high = bars.length - 1
  while (low <= high) {
    const middle = (low + high) >>> 1, at = bars[middle].time
    if (at === time) return true
    if (at < time) low = middle + 1; else high = middle - 1
  }
  return false
}
export function arrowTimeAt(logical: number | null, bars: DrawingTimeline, timeframe: ChartTimeframe) {
  if (logical == null || !Number.isFinite(logical) || !bars.length) return null
  return drawingLogicalToTime(Math.round(logical), bars, timeframeToSeconds(timeframe))
}
