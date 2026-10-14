import type { PlannedTradeState, TradeDirection } from '../contracts/entry-trade-types'

export function tradeSide(direction: TradeDirection, entry: number | null, sl: number | null, tp: number | null = null) {
  if (direction !== 'waiting') return direction
  if (entry == null) return null
  if (sl != null && sl !== entry) return sl < entry ? 'long' : 'short'
  if (tp != null && tp !== entry) return tp > entry ? 'long' : 'short'
  return null
}

export function tradeMetrics(plan: Pick<PlannedTradeState, 'direction' | 'entryPrice' | 'slPrice' | 'tpPrice'>, pipMultiplier: number) {
  const { direction, entryPrice: entry, slPrice: sl, tpPrice: tp } = plan
  const side = tradeSide(direction, entry, sl, tp)
  const tpPips = entry != null && entry > 0 && tp != null && tp > 0 && side
    ? (side === 'long' ? tp - entry : entry - tp) * pipMultiplier : null
  const slPips = entry != null && entry > 0 && sl != null && sl > 0 && side
    ? (side === 'long' ? entry - sl : sl - entry) * pipMultiplier : null
  const rrRatio = tpPips != null && slPips != null && slPips > 0 ? tpPips / slPips : null
  return { tpPips, slPips, rrRatio }
}

export const RR_PRESETS = [
  { r: 1.0, label: '1.0R' },
  { r: 1.25, label: '1.25R' },
  { r: 1.5, label: '1.5R' },
  { r: 2.0, label: '2.0R' },
  { r: 3.0, label: '3.0R' },
] as const

interface ComputeTpPriceParams {
  entryPrice: number | null
  slPrice?: number | null
  slPips?: number | null
  targetRr: number | null
  direction: TradeDirection
  pipMultiplier: number
  precision: number
}

export function computeTpPrice({
  entryPrice,
  slPrice,
  slPips,
  targetRr,
  direction,
  pipMultiplier,
  precision,
}: ComputeTpPriceParams): number | null {
  if (entryPrice == null || targetRr == null || targetRr <= 0) {
    return null
  }
  let effectiveSlPips: number | null = null
  const side = tradeSide(direction, entryPrice, slPrice ?? null)
  if (!side) return null
  if (slPips != null && slPips > 0) {
    effectiveSlPips = slPips
  } else if (slPrice != null) {
    effectiveSlPips = side === 'long'
      ? (entryPrice - slPrice) * pipMultiplier
      : (slPrice - entryPrice) * pipMultiplier
  }
  if (effectiveSlPips == null || effectiveSlPips <= 0) {
    return null
  }
  const desiredTpPips = effectiveSlPips * targetRr
  const priceDelta = desiredTpPips / pipMultiplier
  const rawTp = side === 'long' ? entryPrice + priceDelta : entryPrice - priceDelta
  return Number(rawTp.toFixed(precision))
}
