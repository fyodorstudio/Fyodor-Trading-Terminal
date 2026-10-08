import type { IChartApi, ISeriesApi, Logical, Time } from 'lightweight-charts'
import type { ChartTimeframe } from '../contracts/ChartTimeframe'
import type { ChartDrawingPoint } from './chart-drawing-record'
import { timeframeToSeconds } from './position-drawing-geometry'

export type DrawingTimeline = readonly { time: number }[]
export const emptyDrawingTimeline: DrawingTimeline = []

// Interpolate between actual bars, including session gaps. Outside the loaded
// history, use the timeframe spacing. Persist times, never mutable bar indexes.
export function drawingTimeToLogical(time: number, bars: DrawingTimeline, step: number): number | null {
  if (!bars.length) return null
  const last = bars.length - 1
  if (time <= bars[0].time) return (time - bars[0].time) / step
  if (time >= bars[last].time) return last + (time - bars[last].time) / step
  let low = 0, high = last
  while (low + 1 < high) {
    const middle = (low + high) >>> 1
    if (bars[middle].time <= time) low = middle
    else high = middle
  }
  return low + (time - bars[low].time) / (bars[high].time - bars[low].time)
}

export function drawingLogicalToTime(logical: number, bars: DrawingTimeline, step: number): ChartDrawingPoint['time'] | null {
  if (!bars.length) return null
  const last = bars.length - 1
  let time: number
  if (logical <= 0) time = bars[0].time + logical * step
  else if (logical >= last) time = bars[last].time + (logical - last) * step
  else {
    const index = Math.floor(logical)
    time = bars[index].time + (logical - index) * (bars[index + 1].time - bars[index].time)
  }
  return time as ChartDrawingPoint['time']
}

export function drawingCoordinates(
  chart: IChartApi,
  series: ISeriesApi<'Candlestick', Time>,
  bars: DrawingTimeline,
  timeframe?: ChartTimeframe,
) {
  const scale = chart.timeScale()
  const step = timeframeToSeconds(timeframe)
  const timeToLogical = (time: number) => drawingTimeToLogical(time, bars, step)
  const logicalToTime = (logical: number) => drawingLogicalToTime(logical, bars, step)
  // The installed chart library rounds coordinateToLogical to a bar index.
  // Invert its forward transform to retain sub-bar precision during editing.
  const xToLogical = (x: number) => {
    const zero = scale.logicalToCoordinate?.(0 as Logical)
    const one = scale.logicalToCoordinate?.(1 as Logical)
    if (zero != null && one != null && one !== zero) return (x - zero) / (one - zero)
    return scale.coordinateToLogical(x)
  }
  return {
    timeToLogical,
    logicalToTime,
    timeToX(time: ChartDrawingPoint['time']) {
      const logical = timeToLogical(time)
      if (logical === null) return scale.timeToCoordinate(time)
      // This library also rejects fractional logicalToCoordinate inputs and
      // returns zero. Interpolate its integer coordinates in both directions.
      const index = Math.floor(logical)
      const left = scale.logicalToCoordinate(index as Logical)
      if (left === null || logical === index) return left
      const right = scale.logicalToCoordinate((index + 1) as Logical)
      return right === null ? null : left + (right - left) * (logical - index)
    },
    xToLogical,
    pointAt(x: number, y: number): ChartDrawingPoint | null {
      const logical = xToLogical(x)
      const time = logical === null ? scale.coordinateToTime(x) : logicalToTime(logical) ?? scale.coordinateToTime(x)
      const price = series.coordinateToPrice(y)
      return typeof time === 'number' && price !== null && Number.isFinite(price) ? { time, price } : null
    },
  }
}
