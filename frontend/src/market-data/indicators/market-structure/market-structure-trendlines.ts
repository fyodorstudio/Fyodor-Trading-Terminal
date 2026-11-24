import type { OhlcBar } from '../../contracts/OhlcBar'

type Side = 'high' | 'low'
export type TrendlinePivot = { index: number; confirmedAt: number; price: number }
type Trendline = {
  side: Side
  startIndex: number
  startPrice: number
  endIndex: number
  endPrice: number
  broken: boolean
}
type Candidate = { line: Trendline; touches: number; span: number }
type CandleValue = (index: number) => number | undefined

export const trendlineLookback = 500
const maxPivots = 12
const touchAtrFraction = 0.1

function outranks(candidate: Candidate, current: Candidate | undefined) {
  if (!current) return true
  if (candidate.line.broken && candidate.line.endIndex !== current.line.endIndex) {
    return candidate.line.endIndex > current.line.endIndex
  }
  if (candidate.touches !== current.touches) return candidate.touches > current.touches
  if (candidate.span !== current.span) return candidate.span > current.span
  return candidate.line.startIndex > current.line.startIndex
}

export function calculateTrendline(
  bars: OhlcBar[], side: Side, swings: TrendlinePivot[], confirmationCloses: number,
  breakoutBuffer: CandleValue, previousAtr: CandleValue,
): Trendline | undefined {
  const pivots = swings.slice(-maxPivots)
  const direction = side === 'high' ? 1 : -1
  const lastIndex = bars.length - 1
  let active: Candidate | undefined
  let broken: Candidate | undefined

  for (const [firstIndex, first] of pivots.entries()) {
    for (let secondIndex = firstIndex + 1; secondIndex < pivots.length; secondIndex++) {
      const second = pivots[secondIndex]
      const span = second.index - first.index
      const slope = (second.price - first.price) / span
      if (slope * direction >= 0) continue
      // The chart gives each candle the same horizontal spacing, including across session gaps.
      const priceAt = (index: number) => first.price + slope * (index - first.index)
      const rounding = (price: number) => Number.EPSILON * Math.abs(price) * 4
      let crossesBeforeConfirmation = false
      let endIndex = lastIndex
      let closes = 0

      for (let index = first.index + 1; index < lastIndex; index++) {
        const price = priceAt(index)
        const distance = direction * (bars[index].close - price)
        const tolerance = rounding(price)
        if (distance <= tolerance) {
          closes = 0
          continue
        }
        if (index < second.confirmedAt) {
          crossesBeforeConfirmation = true
          break
        }
        const buffer = closes === 0 ? breakoutBuffer(index) : 0
        if (buffer !== undefined && distance + tolerance >= buffer && ++closes >= confirmationCloses) {
          endIndex = index
          break
        }
      }
      if (crossesBeforeConfirmation) continue

      let touches = 2
      for (let index = firstIndex + 1; index < pivots.length; index++) {
        if (index === secondIndex) continue
        const pivot = pivots[index]
        if (pivot.confirmedAt > endIndex) break
        const price = priceAt(pivot.index)
        const tolerance = (previousAtr(pivot.index) ?? 0) * touchAtrFraction + rounding(price)
        if (Math.abs(price - pivot.price) <= tolerance) touches++
      }

      const line = {
        side, startIndex: first.index, startPrice: first.price, endIndex, endPrice: priceAt(endIndex),
        broken: endIndex < lastIndex,
      }
      const candidate = { line, touches, span }
      if (line.broken) {
        if (outranks(candidate, broken)) broken = candidate
      } else if (outranks(candidate, active)) {
        active = candidate
      }
    }
  }
  return (active ?? broken)?.line
}
