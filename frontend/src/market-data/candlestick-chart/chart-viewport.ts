import { drawingLogicalToTime, drawingTimeToLogical, type DrawingTimeline } from '../chart-drawings/drawing-coordinates'

export type ChartDateWindow = { from: number; to: number }
export function captureDateWindow(range: { from: number; to: number } | null, bars: DrawingTimeline, step: number): ChartDateWindow | null {
  if (!range) return null
  const from = drawingLogicalToTime(range.from, bars, step), to = drawingLogicalToTime(range.to, bars, step)
  return from !== null && to !== null && Number.isFinite(from) && Number.isFinite(to) && from < to ? { from, to } : null
}
// Logical ranges retain fractional bars and future whitespace, which a clipped
// visible-time range cannot capture. Resolve again as older sessions arrive.
export function projectDateWindow(window: ChartDateWindow, bars: DrawingTimeline, step: number) {
  const from = drawingTimeToLogical(window.from, bars, step), to = drawingTimeToLogical(window.to, bars, step)
  return from !== null && to !== null ? { from, to } : null
}
