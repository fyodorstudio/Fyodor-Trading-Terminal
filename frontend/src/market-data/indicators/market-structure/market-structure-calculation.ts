import type { OhlcBar } from '../../contracts/OhlcBar'
import type { MarketStructurePreferences } from './market-structure-preferences'

type Swing = { side: 'high' | 'low'; start: OhlcBar['time']; price: number }
type StructureSegment = Swing & { end?: OhlcBar['time'] }

export function calculateMarketStructure(
  bars: OhlcBar[],
  strength: number,
  breakBy: MarketStructurePreferences['breakBy'],
) {
  const broken: StructureSegment[] = []
  let high: Swing | undefined
  let low: Swing | undefined

  // The feed can revise the last candle until its successor arrives.
  for (let i = strength * 2; i < bars.length - 1; i++) {
    const bar = bars[i]
    if (high && (breakBy === 'wick' ? bar.high : bar.close) > high.price) {
      broken.push({ ...high, end: bar.time })
      high = undefined
    }
    if (low && (breakBy === 'wick' ? bar.low : bar.close) < low.price) {
      broken.push({ ...low, end: bar.time })
      low = undefined
    }

    const pivot = bars[i - strength]
    let isHigh = true
    let isLow = true
    // Prefer the last candle of an equal-price plateau.
    for (let offset = 1; offset <= strength && (isHigh || isLow); offset++) {
      const left = bars[i - strength - offset]
      const right = bars[i - strength + offset]
      isHigh = isHigh && pivot.high >= left.high && pivot.high > right.high
      isLow = isLow && pivot.low <= left.low && pivot.low < right.low
    }
    if (isHigh) high = { side: 'high', start: pivot.time, price: pivot.high }
    if (isLow) low = { side: 'low', start: pivot.time, price: pivot.low }
  }

  return { broken, high, low }
}
