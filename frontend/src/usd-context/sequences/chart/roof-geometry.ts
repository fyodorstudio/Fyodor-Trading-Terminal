import type { ITimeScaleApi, Time } from 'lightweight-charts'
import type { OhlcBar } from '../../../market-data/contracts/OhlcBar'
import type { ChartTimeframe } from '../../../market-data/contracts/ChartTimeframe'
import type { ComboSnapshot } from '../core/contracts'
import { timeframeSeconds } from '../../../inspector/inspector-data'

export function roofCoordinate(scale: ITimeScaleApi<Time>, bars: readonly OhlcBar[], at: number, timeframe: ChartTimeframe): number | null {
  const seconds = at / 1000
  let lo = 0, hi = bars.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (Number(bars[mid].time) <= seconds) lo = mid + 1; else hi = mid }
  const bar = bars[lo - 1]
  if (!bar || seconds >= Number(bar.time) + timeframeSeconds[timeframe]) return null
  const x = scale.timeToCoordinate(bar.time)
  return x !== null && Number.isFinite(x) ? Number(x) : null
}

export function visibleRoofCandidates(episodes: readonly ComboSnapshot[], from: number, to: number) {
  let lo = 0, hi = episodes.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (episodes[mid].chartAt < from) lo = mid + 1; else hi = mid }
  const result: ComboSnapshot[] = []
  for (let i = lo; i < episodes.length && episodes[i].chartAt <= to; i++) result.push(episodes[i])
  return result
}
