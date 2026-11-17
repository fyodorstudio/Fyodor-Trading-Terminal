import type { LineData, UTCTimestamp, WhitespaceData } from 'lightweight-charts'
import type { OhlcBar } from '../../contracts/OhlcBar'
import { changedRecentBarStart } from '../../mt5-feed/market-snapshots'

type Point = LineData<UTCTimestamp> | WhitespaceData<UTCTimestamp>

/** Wilder RMA of true range, seeded by the first length ranges. The first
 * candle uses high-low; subsequent candles also include gaps from prior close.
 * Replay live candles from their preceding state so ticks never compound. */
export function createAtrCalculator() {
  let previous: OhlcBar[] = [], signature = ''
  const states: number[] = [], atr: Point[] = []
  return {
    sync(bars: OhlcBar[], length: number, scope: string) {
      const key = `${scope}:${length}`
      const changed = key === signature ? bars === previous ? bars.length : changedRecentBarStart(bars, previous) : null
      const rebuilt = changed === null || bars[0]?.time !== previous[0]?.time || bars.length < previous.length
      const from = rebuilt ? 0 : changed
      const previousLength = previous.length
      states.length = bars.length; atr.length = bars.length
      for (let i = from; i < bars.length; i++) {
        const bar = bars[i], priorClose = bars[i - 1]?.close
        const range = priorClose === undefined ? bar.high - bar.low :
          Math.max(bar.high - bar.low, Math.abs(bar.high - priorClose), Math.abs(bar.low - priorClose))
        const state = i < length ? (states[i - 1] ?? 0) + range : (states[i - 1] * (length - 1) + range) / length
        states[i] = i === length - 1 ? state / length : state
        atr[i] = i < length - 1 ? { time: bar.time } : { time: bar.time, value: states[i] }
      }
      previous = bars; signature = key
      return { atr, from, rebuilt, previousLength }
    },
  }
}
