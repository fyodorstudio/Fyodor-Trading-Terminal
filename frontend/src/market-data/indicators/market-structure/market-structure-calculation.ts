import type { OhlcBar } from '../../contracts/OhlcBar'
import { createAtrCalculator } from '../atr/atr-calculation'
import type { MarketStructurePreferences } from './market-structure-preferences'
import { calculateTrendline, trendlineLookback, type TrendlinePivot } from './market-structure-trendlines'

type Swing = { side: 'high' | 'low'; start: OhlcBar['time']; price: number }
type StructureSegment = Swing & { end?: OhlcBar['time'] }
type SignalKind = 'sweep' | 'pending' | 'confirmed' | 'failed' | 'invalidated' | 'reclaim'
type Signal = Swing & { time: OhlcBar['time']; kind: SignalKind }
type SwingSlot = { level?: Swing; queued?: Swing; closes: number; marginal: boolean; tested: boolean }

function setSwing(slot: SwingSlot, level?: Swing) {
  slot.level = level
  slot.queued = undefined
  slot.closes = 0
  slot.marginal = false
  slot.tested = false
}

function classifyCrossing(slot: SwingSlot, level: Swing, closeDistance: number, wickDistance: number,
  buffer: number | undefined, confirmationCloses: number): SignalKind | undefined {
  if (slot.closes) {
    if (closeDistance <= 0) return 'failed'
    if (++slot.closes >= confirmationCloses) return 'confirmed'
    return
  }

  if (closeDistance > 0) {
    const rounding = Number.EPSILON * Math.abs(level.price) * 2
    if (buffer !== undefined && closeDistance + rounding >= buffer) {
      slot.closes = 1
      slot.marginal = false
      return 'pending'
    }
    slot.marginal = buffer !== undefined
    return
  }

  const reclaimed = slot.marginal
  slot.marginal = false
  if (reclaimed) return 'reclaim'
  if (closeDistance < 0 && wickDistance > 0) return 'sweep'
}

export function calculateMarketStructure(
  bars: OhlcBar[],
  { swingStrength: strength, confirmationCloses, atrBufferPercent, failureWindow, showAutoTrendlines }: MarketStructurePreferences,
) {
  const broken: StructureSegment[] = []
  const replacedTestedLevels: StructureSegment[] = []
  const signals: Signal[] = []
  const recentBreakouts: { level: Swing; expires: number }[] = []
  const high: SwingSlot = { closes: 0, marginal: false, tested: false }
  const low: SwingSlot = { closes: 0, marginal: false, tested: false }
  const sides = [high, low]
  const pivots = { high: [] as TrendlinePivot[], low: [] as TrendlinePivot[] }
  const firstTrendlineIndex = Math.max(0, bars.length - 1 - trendlineLookback)
  const atr = atrBufferPercent > 0 || showAutoTrendlines
    ? createAtrCalculator().sync(bars, 14, 'market-structure').atr
    : undefined
  const previousAtr = (index: number) => {
    const point = atr?.[index - 1]
    return point && 'value' in point ? point.value : undefined
  }
  const breakoutBuffer = (index: number) => {
    if (atrBufferPercent === 0) return 0
    const value = previousAtr(index)
    return value === undefined ? undefined : value * atrBufferPercent / 100
  }

  const replaceSwing = (slot: SwingSlot, swing: Swing, time: OhlcBar['time']) => {
    if (slot.tested && slot.level) replacedTestedLevels.push({ ...slot.level, end: time })
    setSwing(slot, swing)
  }

  // The feed can revise the last candle until its successor arrives.
  for (let i = strength * 2; i < bars.length - 1; i++) {
    const bar = bars[i]
    for (let j = recentBreakouts.length - 1; j >= 0; j--) {
      const { level, expires } = recentBreakouts[j]
      const backThrough = level.side === 'high' ? bar.close < level.price : bar.close > level.price
      if (backThrough) signals.push({ ...level, time: bar.time, kind: 'invalidated' })
      if (backThrough || i === expires) recentBreakouts.splice(j, 1)
    }
    const buffer = breakoutBuffer(i)
    for (const slot of sides) {
      const level = slot.level
      if (!level) continue
      const isHigh = level.side === 'high'
      const closeDistance = isHigh ? bar.close - level.price : level.price - bar.close
      const wickDistance = isHigh ? bar.high - level.price : level.price - bar.low
      const kind = classifyCrossing(slot, level, closeDistance, wickDistance, buffer, confirmationCloses)
      if (kind) signals.push({ ...level, time: bar.time, kind })
      if (kind === 'sweep' || kind === 'failed' || kind === 'reclaim') slot.tested = true
      if (kind === 'failed') {
        if (slot.queued) replaceSwing(slot, slot.queued, bar.time)
        else slot.closes = 0
      } else if (kind === 'confirmed') {
        broken.push({ ...level, end: bar.time })
        if (failureWindow > 0) recentBreakouts.push({ level, expires: i + failureWindow })
        setSwing(slot, slot.queued)
      }
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
    if (isHigh) {
      const swing = { side: 'high', start: pivot.time, price: pivot.high } as const
      if (showAutoTrendlines && i - strength >= firstTrendlineIndex) {
        pivots.high.push({ index: i - strength, confirmedAt: i, price: swing.price })
      }
      if (high.closes) high.queued = swing
      else replaceSwing(high, swing, bar.time)
    }
    if (isLow) {
      const swing = { side: 'low', start: pivot.time, price: pivot.low } as const
      if (showAutoTrendlines && i - strength >= firstTrendlineIndex) {
        pivots.low.push({ index: i - strength, confirmedAt: i, price: swing.price })
      }
      if (low.closes) low.queued = swing
      else replaceSwing(low, swing, bar.time)
    }
  }

  return {
    broken, replacedTestedLevels, signals,
    trendlines: (['high', 'low'] as const).flatMap(side => {
      const line = calculateTrendline(bars, side, pivots[side], confirmationCloses, breakoutBuffer, previousAtr)
      return line ? [line] : []
    }),
    high: high.level, low: low.level,
    pending: sides.flatMap(slot => slot.closes > 0 && slot.level ? [slot.level] : []),
    activeTestedLevels: sides.flatMap(slot => slot.tested && slot.level ? [slot.level] : []),
  }
}
