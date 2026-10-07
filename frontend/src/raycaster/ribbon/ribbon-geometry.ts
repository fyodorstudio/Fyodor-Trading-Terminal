import type { ITimeScaleApi, Time } from 'lightweight-charts'
import type { OhlcBar } from '../../market-data/contracts/OhlcBar'

/** Exact clock placement within a candle. Session gaps collapse to the next bar. */
export function ribbonCoordinate(scale: ITimeScaleApi<Time>, bars: readonly Pick<OhlcBar, 'time'>[], at: number, duration: number): number | null {
  if (!bars.length) return null
  const seconds = at / 1000
  let lo = 0, hi = bars.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (Number(bars[mid].time) <= seconds) lo = mid + 1; else hi = mid }
  const index = lo - 1
  if (index < 0) return scale.timeToCoordinate(bars[0].time)
  const x = scale.timeToCoordinate(bars[index].time)
  if (x === null) return null
  const next = bars[index + 1] && scale.timeToCoordinate(bars[index + 1].time)
  const spacing = next == null ? scale.options().barSpacing : Number(next) - Number(x)
  return Number(x) + spacing * Math.min(1, Math.max(0, (seconds - Number(bars[index].time)) / duration))
}

/** Hover clocks follow compressed chart bars, rather than interpolating elapsed weekends across a long segment. */
export function ribbonClockAtCoordinate(scale: ITimeScaleApi<Time>, bars: readonly Pick<OhlcBar, 'time'>[], x: number, duration: number): number | null {
  let lo = 0, hi = bars.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1, coordinate = scale.timeToCoordinate(bars[mid].time)
    if (coordinate === null) return null
    if (Number(coordinate) <= x) lo = mid + 1; else hi = mid
  }
  const index = lo - 1, bar = bars[index]
  if (!bar) return bars.length ? Number(bars[0].time) * 1000 : null
  const start = scale.timeToCoordinate(bar.time)
  if (start === null) return null
  const next = bars[index + 1] && scale.timeToCoordinate(bars[index + 1].time)
  const spacing = next == null ? scale.options().barSpacing : Number(next) - Number(start)
  const fraction = spacing > 0 ? Math.max(0, Math.min(1, (x - Number(start)) / spacing)) : 0
  return (Number(bar.time) + fraction * duration) * 1000
}
