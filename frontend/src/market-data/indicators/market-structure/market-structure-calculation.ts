import type { OhlcBar } from '../../contracts/OhlcBar'
import { createAtrCalculator } from '../atr/atr-calculation'
import type { MarketStructurePreferences } from './market-structure-preferences'

type Swing = { side: 'high' | 'low'; start: OhlcBar['time']; price: number }
type StructureSegment = Swing & { end?: OhlcBar['time'] }
type SignalKind = 'sweep' | 'pending' | 'confirmed' | 'failed' | 'reclaim'
type Signal = Swing & { time: OhlcBar['time']; kind: SignalKind }
type SwingSlot = { level?: Swing; queued?: Swing; closes: number; marginal: boolean }

function setSwing(slot: SwingSlot, level?: Swing) {
  slot.level = level
  slot.queued = undefined
  slot.closes = 0
  slot.marginal = false
}

function classifyCrossing(slot: SwingSlot, level: Swing, closeDistance: number, wickDistance: number,
  buffer: number | undefined, confirmationCloses: number): SignalKind | undefined {
  if (slot.closes) {
    if (closeDistance <= 0) {
      setSwing(slot, slot.queued ?? level)
      return 'failed'
    }
    if (++slot.closes >= confirmationCloses) {
      setSwing(slot, slot.queued)
      return 'confirmed'
    }
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
  { swingStrength: strength, confirmationCloses, atrBufferPercent }: MarketStructurePreferences,
) {
  const broken: StructureSegment[] = []
  const signals: Signal[] = []
  const high: SwingSlot = { closes: 0, marginal: false }
  const low: SwingSlot = { closes: 0, marginal: false }
  const sides = [high, low]
  const atr = atrBufferPercent > 0
    ? createAtrCalculator().sync(bars, 14, 'market-structure').atr
    : undefined

  // The feed can revise the last candle until its successor arrives.
  for (let i = strength * 2; i < bars.length - 1; i++) {
    const bar = bars[i]
    const previousAtr = atr?.[i - 1]
    let buffer: number | undefined = 0
    if (atr) buffer = previousAtr && 'value' in previousAtr ? previousAtr.value * atrBufferPercent / 100 : undefined
    for (const slot of sides) {
      const level = slot.level
      if (!level) continue
      const isHigh = level.side === 'high'
      const closeDistance = isHigh ? bar.close - level.price : level.price - bar.close
      const wickDistance = isHigh ? bar.high - level.price : level.price - bar.low
      const kind = classifyCrossing(slot, level, closeDistance, wickDistance, buffer, confirmationCloses)
      if (kind) signals.push({ ...level, time: bar.time, kind })
      if (kind === 'confirmed') broken.push({ ...level, end: bar.time })
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
      if (high.closes) high.queued = swing
      else setSwing(high, swing)
    }
    if (isLow) {
      const swing = { side: 'low', start: pivot.time, price: pivot.low } as const
      if (low.closes) low.queued = swing
      else setSwing(low, swing)
    }
  }

  return {
    broken, signals,
    high: high.level, low: low.level,
    pending: sides.flatMap(slot => slot.closes > 0 && slot.level ? [slot.level] : []),
  }
}
