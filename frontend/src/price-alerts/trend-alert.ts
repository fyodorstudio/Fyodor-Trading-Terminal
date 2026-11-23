import type { ChartDrawingPoint } from '../market-data/chart-drawings/chart-drawing-record'
import type { SymbolQuote } from '../market-data/contracts/SymbolQuote'
import { trendScaleDistance, type TrendAlertScale } from './trend-alert-scale'

export type TrendAlert = readonly [ChartDrawingPoint, ChartDrawingPoint]
export type TrendSample = { chartTime: number; at: number; bid: number }

export const maxTrendQuoteGapMs = 15_000

export function trendAlertPoints(points: readonly ChartDrawingPoint[]): TrendAlert | undefined {
  const [first, second] = points
  if (points.length !== 2 || !first || !second
    || ![first, second].every(point => Number.isFinite(point.time) && point.time > 0 && Number.isFinite(point.price) && point.price > 0)
    || first.time === second.time) return
  return first.time < second.time ? [first, second] : [second, first]
}

export function trendAlertPrice([start, end]: TrendAlert, time: number, scale?: TrendAlertScale) {
  return start.price + (end.price - start.price) * trendScaleDistance(scale, start.time, time) / trendScaleDistance(scale, start.time, end.time)
}

export function trendAlertSample(quote: SymbolQuote | undefined, bid: number | undefined, now: number): TrendSample | undefined {
  const at = quote?.tickAt, chartTime = quote?.tickChartTime
  if (bid === undefined || at === undefined || chartTime === undefined || !Number.isFinite(at) || !Number.isFinite(chartTime)
    || at < now - maxTrendQuoteGapMs || at > now + 5_000) return
  return { at, chartTime, bid }
}

export function reachesTrendAlert(trend: TrendAlert, previous: TrendSample | undefined, sample: TrendSample,
  armedAt: number, precision: number, scale?: TrendAlertScale) {
  const [start, end] = trend
  const tolerance = 0.5 * 10 ** -precision
  const inside = sample.chartTime >= start.time && sample.chartTime <= end.time
  if (sample.at < armedAt) return false
  const currentDistance = sample.bid - trendAlertPrice(trend, sample.chartTime, scale)
  if (inside && Math.abs(currentDistance) <= tolerance) return true
  if (!previous || sample.at - previous.at > maxTrendQuoteGapMs || sample.chartTime < previous.chartTime) return false
  if (sample.chartTime === previous.chartTime) {
    return previous.at >= armedAt && inside && (previous.bid - trendAlertPrice(trend, sample.chartTime, scale)) * currentDistance <= 0
  }
  const timeSpan = sample.chartTime - previous.chartTime
  const armedFraction = previous.at < armedAt ? (armedAt - previous.at) / (sample.at - previous.at) : 0
  // Clip the observed quote interval to the armed segment. Circling back after
  // the end or crossing before the start cannot fire an alert.
  const from = Math.max(start.time, previous.chartTime + armedFraction * timeSpan)
  const to = Math.min(end.time, sample.chartTime)
  if (from > to) return false
  const distanceAt = (time: number) =>
    previous.bid + (sample.bid - previous.bid) * (time - previous.chartTime) / timeSpan - trendAlertPrice(trend, time, scale)
  let lastDistance = distanceAt(from)
  if (Math.abs(lastDistance) <= tolerance) return true
  // Within each candle interval the line and the sampled quote are affine.
  // A crossing can reverse at a spacing change, even with matching end signs.
  for (const interval of scale?.intervals ?? []) {
    if (interval[0] >= to) break
    if (interval[1] <= from) continue
    for (const time of interval) {
      if (time <= from || time >= to) continue
      const distance = distanceAt(time)
      if (Math.abs(distance) <= tolerance || lastDistance * distance < 0) return true
      lastDistance = distance
    }
  }
  const distance = distanceAt(to)
  return Math.abs(distance) <= tolerance || lastDistance * distance < 0
}
