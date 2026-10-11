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
  direction: 'long' | 'short'
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
  if (slPips != null && slPips > 0) {
    effectiveSlPips = slPips
  } else if (slPrice != null) {
    effectiveSlPips = direction === 'long'
      ? (entryPrice - slPrice) * pipMultiplier
      : (slPrice - entryPrice) * pipMultiplier
  }
  if (effectiveSlPips == null || effectiveSlPips <= 0) {
    return null
  }
  const desiredTpPips = effectiveSlPips * targetRr
  const priceDelta = desiredTpPips / pipMultiplier
  const rawTp = direction === 'long' ? entryPrice + priceDelta : entryPrice - priceDelta
  return Number(rawTp.toFixed(precision))
}
