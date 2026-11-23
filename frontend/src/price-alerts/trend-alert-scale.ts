import type { DrawingTimeline } from '../market-data/chart-drawings/drawing-coordinates'
import { timeframeToSeconds } from '../market-data/chart-drawings/position-drawing-geometry'
import type { ChartTimeframe } from '../market-data/contracts/ChartTimeframe'

export type TrendAlertScale = {
  timeframe: ChartTimeframe
  confirmedThrough: number
  // Adjacent candles with irregular spacing still occupy exactly one bar.
  intervals: Array<readonly [number, number]>
}

export function validTrendAlertScale(scale: TrendAlertScale) {
  if (!scale || !['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'].includes(scale.timeframe)
    || !Number.isFinite(scale.confirmedThrough) || scale.confirmedThrough <= 0 || !Array.isArray(scale.intervals)) return false
  let previous = 0
  for (const interval of scale.intervals) {
    if (!Array.isArray(interval) || interval.length !== 2) return false
    const [from, to] = interval
    if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0 || from < previous || from >= to || to > scale.confirmedThrough) return false
    previous = to
  }
  return true
}

function candleIntervals(bars: DrawingTimeline, step: number, firstIndex: number, from: number) {
  const intervals: TrendAlertScale['intervals'] = []
  for (let index = firstIndex; index < bars.length; index++) {
    const to = bars[index].time
    if (to > from && to - from !== step) intervals.push([from, to])
    from = to
  }
  return intervals
}

export function createTrendAlertScale(timeframe: ChartTimeframe, bars: DrawingTimeline, start: number): TrendAlertScale | undefined {
  const first = bars[0], last = bars.at(-1)
  if (!first || !last) return
  const index = Math.max(1, barAfter(bars, start))
  return { timeframe, confirmedThrough: last.time,
    intervals: candleIntervals(bars, timeframeToSeconds(timeframe), index, bars[index - 1].time) }
}

function barAfter(bars: DrawingTimeline, time: number) {
  let low = 0, high = bars.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (bars[middle].time <= time) low = middle + 1
    else high = middle
  }
  return low
}

export function extendTrendAlertScale(scale: TrendAlertScale, bars: DrawingTimeline): TrendAlertScale {
  const last = bars.at(-1)
  if (!last || last.time <= scale.confirmedThrough) return scale
  const index = barAfter(bars, scale.confirmedThrough)
  // An overlapping candle proves the page spans the whole interval since the
  // last confirmation. A disjoint tail cannot prove which bars were skipped.
  if (bars[index - 1]?.time !== scale.confirmedThrough) return scale
  return { ...scale, confirmedThrough: last.time,
    intervals: [...scale.intervals, ...candleIntervals(bars, timeframeToSeconds(scale.timeframe), index, scale.confirmedThrough)] }
}

export function trendScaleCovers(scale: TrendAlertScale, time: number) {
  return time < scale.confirmedThrough + timeframeToSeconds(scale.timeframe)
}

// Measure relative to the first point to retain precision on steep lines. A
// regular bar has one step of width, including across irregular intervals.
export function trendScaleDistance(scale: TrendAlertScale | undefined, from: number, to: number): number {
  if (!scale || from === to) return to - from
  if (to < from) return -trendScaleDistance(scale, to, from)
  const step = timeframeToSeconds(scale.timeframe)
  let distance = 0, cursor = from
  for (const [start, end] of scale.intervals) {
    if (start >= to) break
    if (end <= cursor) continue
    const left = Math.max(cursor, start), right = Math.min(to, end)
    distance += left - cursor + (right - left) * step / (end - start)
    cursor = right
  }
  return distance + (to - cursor)
}
