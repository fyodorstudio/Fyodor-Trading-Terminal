import type { ScatterAxisRange, scatterPlotGeometry } from './scatter-plot-geometry'

export type ScatterGeometry = ReturnType<typeof scatterPlotGeometry>
export type ScatterPointerZone = 'x' | 'y' | 'plot'

export function scatterPointerZone(g: ScatterGeometry, x: number, y: number): ScatterPointerZone | null {
  if (x >= g.left && x <= g.right && y >= g.top && y < g.bottom) return 'plot'
  if (x >= g.left && x <= g.right && y >= g.bottom) return 'x'
  if (x >= 0 && x < g.left && y >= g.top && y <= g.bottom) return 'y'
  return null
}

export function scaleScatterAxis(range: ScatterAxisRange, factor: number, anchor: number, minimum: number, maximum: number): ScatterAxisRange {
  const span = range.to - range.from
  const nextSpan = Math.max(minimum, Math.min(maximum, span * factor))
  const fraction = Math.max(0, Math.min(1, (anchor - range.from) / span))
  return { from: anchor - nextSpan * fraction, to: anchor + nextSpan * (1 - fraction) }
}

export function translateScatterAxis(range: ScatterAxisRange, amount: number): ScatterAxisRange {
  return { from: range.from + amount, to: range.to + amount }
}

export function limitScatterDates(range: ScatterAxisRange): ScatterAxisRange {
  // Keep navigation within supported calendar years, without altering the span.
  const first = Date.UTC(1900, 0, 1), last = Date.UTC(2200, 0, 1)
  const offset = range.from < first ? first - range.from : range.to > last ? last - range.to : 0
  return translateScatterAxis(range, offset)
}
