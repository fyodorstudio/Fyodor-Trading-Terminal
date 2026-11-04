import type { LineData, UTCTimestamp, WhitespaceData } from 'lightweight-charts'
import type { OhlcBar } from '../../contracts/OhlcBar'
import { changedRecentBarStart } from '../../mt5-feed/market-snapshots'
import type { RsiPreferences, RsiSource } from './rsi-preferences'

type Point = LineData<UTCTimestamp> | WhitespaceData<UTCTimestamp>
type State = { up: number; down: number; sum: number; weighted: number; average?: number }
type Inputs = Pick<RsiPreferences, 'length' | 'source' | 'smoothing' | 'smoothingLength'>

function sourceValue(bar: OhlcBar, source: RsiSource) {
  switch (source) {
    case 'Open': return bar.open
    case 'High': return bar.high
    case 'Low': return bar.low
    case 'HL2': return (bar.high + bar.low) / 2
    case 'HLC3': return (bar.high + bar.low + bar.close) / 3
    case 'OHLC4': return (bar.open + bar.high + bar.low + bar.close) / 4
    default: return bar.close
  }
}

/** Wilder RMA seeded by the first length changes, matching the supplied Pine
 * formula (including flat input returning 100). Keep per-bar state so mutable
 * live candles are recomputed from the preceding closed candle, never fed twice. */
export function createRsiCalculator() {
  let previous: OhlcBar[] = [], signature = ''
  const states: State[] = [], rsi: Point[] = [], average: Point[] = []
  return {
    sync(bars: OhlcBar[], inputs: Inputs, scope: string) {
      const key = `${scope}:${inputs.length}:${inputs.source}:${inputs.smoothing}:${inputs.smoothingLength}`
      const changed = key === signature ? bars === previous ? bars.length : changedRecentBarStart(bars, previous) : null
      const rebuilt = changed === null || bars[0]?.time !== previous[0]?.time || bars.length < previous.length
      const from = rebuilt ? 0 : changed
      const previousLength = previous.length
      states.length = bars.length; rsi.length = bars.length; average.length = bars.length
      const { length, smoothing, smoothingLength: period } = inputs
      for (let i = from; i < bars.length; i++) {
        const prior = states[i - 1]
        const change = i ? sourceValue(bars[i], inputs.source) - sourceValue(bars[i - 1], inputs.source) : 0
        let up = Math.max(change, 0), down = Math.max(-change, 0)
        if (i <= length) { up += prior?.up ?? 0; down += prior?.down ?? 0 }
        if (i === length) { up /= length; down /= length }
        else if (i > length) { up = (prior.up * (length - 1) + up) / length; down = (prior.down * (length - 1) + down) / length }
        const value = i < length ? undefined : down === 0 ? 100 : up === 0 ? 0 : 100 - 100 / (1 + up / down)
        const sum = (prior?.sum ?? 0) + (value ?? 0)
        const weighted = (prior?.weighted ?? 0) + (value ?? 0) * (i + 1)
        let ma: number | undefined
        if (value !== undefined && smoothing !== 'None') {
          const count = i - length + 1
          const windowSum = sum - (states[i - period]?.sum ?? 0)
          if (smoothing === 'EMA') ma = prior?.average === undefined ? value : prior.average + 2 / (period + 1) * (value - prior.average)
          else if (count >= period) {
            if (smoothing === 'SMMA (RMA)' && prior.average !== undefined) ma = (prior.average * (period - 1) + value) / period
            else if (smoothing === 'WMA') ma = (weighted - (states[i - period]?.weighted ?? 0) - (i - period + 1) * windowSum) / (period * (period + 1) / 2)
            else ma = windowSum / period
          }
        }
        states[i] = { up, down, sum, weighted, average: ma }
        rsi[i] = value === undefined ? { time: bars[i].time } : { time: bars[i].time, value }
        average[i] = ma === undefined ? { time: bars[i].time } : { time: bars[i].time, value: ma }
      }
      previous = bars; signature = key
      return { rsi, average, from, rebuilt, previousLength }
    },
  }
}
