import { useMemo } from 'react'
import type { OhlcBar } from '../../market-data/contracts/OhlcBar'

// Event placement depends on candle times, not changing OHLC prices.
export function useMarkerBars(bars: OhlcBar[]) {
  const times = useMemo(() => bars.map((bar) => Number(bar.time)).join(','), [bars])
  return useMemo(() => times ? times.split(',').map((time) => ({ time: Number(time) as OhlcBar['time'] })) : [], [times])
}
