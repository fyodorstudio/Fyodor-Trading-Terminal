import type { ContextTimeline } from './contracts'

export function contextAt(timeline: ContextTimeline, chartAt: number) {
  if (!Number.isFinite(chartAt)) return null
  let lo = 0, hi = timeline.points.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (timeline.points[mid].chartAt <= chartAt) lo = mid + 1; else hi = mid }
  return lo ? timeline.points[lo - 1] : null
}
