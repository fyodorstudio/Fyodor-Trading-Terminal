import { drawingLogicalToTime, drawingTimeToLogical, type DrawingTimeline } from '../chart-drawings/drawing-coordinates'

export type ChartDateWindow = { from: number; to: number }
export function captureDateWindow(range: { from: number; to: number } | null, bars: DrawingTimeline, step: number): ChartDateWindow | null {
  if (!range) return null
  // Native logical ranges count both end bars. Their outer edges extend half
  // an interval beyond the reported bounds; omitting that interval shifts the
  // screen's dates on every timeframe change, even without native clamping.
  const from = drawingLogicalToTime(range.from - 0.5, bars, step), to = drawingLogicalToTime(range.to + 0.5, bars, step)
  return from !== null && to !== null && Number.isFinite(from) && Number.isFinite(to) && from < to ? { from, to } : null
}
// Logical ranges retain fractional bars and future whitespace, which a clipped
// visible-time range cannot capture. Resolve again as older sessions arrive.
export function projectDateWindow(window: ChartDateWindow, bars: DrawingTimeline, step: number) {
  const from = drawingTimeToLogical(window.from, bars, step), to = drawingTimeToLogical(window.to, bars, step)
  // The native default zoom needs two intervals including the outer edges.
  // Keep the left date anchored at that limit; the original window remains the
  // target so returning to a smaller timeframe restores the chosen zoom.
  return from !== null && to !== null ? { from: from + 0.5, to: Math.max(from + 1.5, to - 0.5) } : null
}

// Follow an appended candle without adopting a higher timeframe's temporary
// minimum zoom. Resolve each original edge through the actual session timeline.
export function advanceDateWindow(window: ChartDateWindow, previous: DrawingTimeline, bars: DrawingTimeline, step: number): ChartDateWindow | null {
  const from = drawingTimeToLogical(window.from, previous, step), to = drawingTimeToLogical(window.to, previous, step)
  if (from === null || to === null) return null
  const nextFrom = drawingLogicalToTime(from + 1, bars, step), nextTo = drawingLogicalToTime(to + 1, bars, step)
  return nextFrom !== null && nextTo !== null ? { from: nextFrom, to: nextTo } : null
}
