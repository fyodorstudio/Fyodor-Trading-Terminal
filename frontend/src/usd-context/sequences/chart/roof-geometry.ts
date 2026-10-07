import type { OhlcBar } from '../../../market-data/contracts/OhlcBar'
import type { ChartTimeframe } from '../../../market-data/contracts/ChartTimeframe'
import { timeframeSeconds } from '../../../inspector/inspector-data'

export function roofBarIndex(bars: readonly Pick<OhlcBar, 'time'>[], at: number, timeframe: ChartTimeframe): number | null {
  const seconds = at / 1000
  let lo = 0, hi = bars.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (Number(bars[mid].time) <= seconds) lo = mid + 1; else hi = mid }
  const bar = bars[lo - 1]
  if (!bar || seconds >= Number(bar.time) + timeframeSeconds[timeframe]) return null
  return lo - 1
}
