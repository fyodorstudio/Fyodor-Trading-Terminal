import { useMemo } from 'react'
import type { OhlcBar } from '../../market-data/contracts/OhlcBar'
import { candleTimeline } from './candle-timeline'

// Event placement depends on candle times, not changing OHLC prices.
export function useMarkerBars(bars: readonly OhlcBar[]) {
  return useMemo(() => candleTimeline(bars), [bars])
}
