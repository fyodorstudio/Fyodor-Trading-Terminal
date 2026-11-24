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
type Candidate = {
  first: TrendlinePivot
  slope: number
  span: number
  touches: number
  spacedTouches: number
  lastSpacedTouch: number
  closes: number
  brokenAt?: number
}
type CandleValue = (index: number) => number | undefined
type TrendlineOptions = { includeHistory: boolean; showMajor: boolean; showMinor: boolean; touchSpacing: number }

export const trendlineLookback = 500
const maxPivots = 12
const touchAtrFraction = 0.1

// The chart gives candles equal horizontal spacing, including across session gaps.
const priceAt = (candidate: Candidate, index: number) =>
  candidate.first.price + candidate.slope * (index - candidate.first.index)
const rounding = (price: number) => Number.EPSILON * Math.abs(price) * 4

function touchesLine(candidate: Candidate, pivot: TrendlinePivot, previousAtr: CandleValue) {
  const price = priceAt(candidate, pivot.index)
  return Math.abs(price - pivot.price) <= (previousAtr(pivot.index) ?? 0) * touchAtrFraction + rounding(price)
}

function outranks(candidate: Candidate, current: Candidate | undefined) {
  if (!current) return true
  if (candidate.brokenAt !== undefined && current.brokenAt !== undefined && candidate.brokenAt !== current.brokenAt) {
    return candidate.brokenAt > current.brokenAt
  }
  if (candidate.touches !== current.touches) return candidate.touches > current.touches
  if (candidate.span !== current.span) return candidate.span > current.span
  return candidate.first.index > current.first.index
}

function sameGeometry(first: Candidate, second: Candidate) {
  const price = priceAt(first, second.first.index)
  const tolerance = Math.max(rounding(price), rounding(second.first.price))
  return Math.abs(price - second.first.price) <= tolerance &&
    Math.abs(first.slope - second.slope) <= tolerance / trendlineLookback
}

function toTrendline(candidate: Candidate, side: Side, index: number): Trendline {
  const endIndex = candidate.brokenAt ?? index
  return {
    side, startIndex: candidate.first.index, startPrice: candidate.first.price,
    endIndex, endPrice: priceAt(candidate, endIndex), broken: candidate.brokenAt !== undefined,
  }
}

export function calculateTrendlines(
  bars: OhlcBar[], side: Side, pivots: TrendlinePivot[], confirmationCloses: number,
  breakoutBuffer: CandleValue, previousAtr: CandleValue,
  { includeHistory, showMajor, showMinor, touchSpacing }: TrendlineOptions,
) {
  const history: Trendline[] = []
  const direction = side === 'high' ? 1 : -1
  const lastIndex = bars.length - 1
  const majorOnly = showMajor && !showMinor
  let candidates: Candidate[] = []
  let active: Candidate | undefined
  let firstPivot = 0
  let nextPivot = 0

  const isVisible = (candidate: Candidate) => {
    if (candidate.spacedTouches >= 3) return showMajor
    if (!showMinor) return false
    // A later anchor pair can describe the same major line with fewer touches.
    return showMajor || !candidates.some(major => major.spacedTouches >= 3 &&
      major.brokenAt === candidate.brokenAt && sameGeometry(major, candidate))
  }

  function addSpacedTouch(candidate: Candidate, index: number) {
    if (index - candidate.lastSpacedTouch < touchSpacing) return
    candidate.lastSpacedTouch = index
    candidate.spacedTouches++
  }

  function bestActive() {
    let best: Candidate | undefined
    for (const candidate of candidates) {
      if (candidate.brokenAt !== undefined || !isVisible(candidate)) continue
      if (majorOnly && best && candidate.spacedTouches !== best.spacedTouches) {
        if (candidate.spacedTouches > best.spacedTouches) best = candidate
      } else if (outranks(candidate, best)) {
        best = candidate
      }
    }
    // Keep an eligible major line until a challenger earns more spaced touches.
    if (majorOnly && active && best && active.spacedTouches >= best.spacedTouches &&
      active.brokenAt === undefined && candidates.includes(active)) return active
    return best
  }

  function advance(candidate: Candidate, index: number, buffer: number | undefined) {
    const price = priceAt(candidate, index)
    const distance = direction * (bars[index].close - price)
    const tolerance = rounding(price)
    if (distance <= tolerance) {
      candidate.closes = 0
    } else if ((candidate.closes > 0 || (buffer !== undefined && distance + tolerance >= buffer)) &&
      ++candidate.closes >= confirmationCloses) {
      candidate.brokenAt = index
    }
  }

  for (let index = pivots[0]?.confirmedAt ?? lastIndex; index < lastIndex; index++) {
    const pivot = pivots[nextPivot]?.confirmedAt === index ? pivots[nextPivot++] : undefined
    const buffer = breakoutBuffer(index)
    for (const candidate of candidates) {
      if (candidate.brokenAt !== undefined) continue
      advance(candidate, index, buffer)
      if (pivot && touchesLine(candidate, pivot, previousAtr)) {
        candidate.touches++
        addSpacedTouch(candidate, pivot.index)
      }
    }

    const previousFirst = firstPivot
    firstPivot = Math.max(firstPivot, nextPivot - maxPivots)
    while (firstPivot < nextPivot && pivots[firstPivot].index < index + 1 - trendlineLookback) firstPivot++
    if (firstPivot !== previousFirst) {
      const earliest = firstPivot < nextPivot ? pivots[firstPivot].index : Infinity
      candidates = candidates.filter(candidate => candidate.first.index >= earliest)
    }

    if (pivot) {
      for (let anchor = firstPivot; anchor < nextPivot - 1; anchor++) {
        const first = pivots[anchor]
        const span = pivot.index - first.index
        const slope = (pivot.price - first.price) / span
        if (slope * direction >= 0) continue
        const candidate = { first, slope, span, touches: 2, spacedTouches: 1, lastSpacedTouch: first.index, closes: 0 }
        let crossed = false
        for (let candle = first.index + 1; candle < index; candle++) {
          const price = priceAt(candidate, candle)
          if (direction * (bars[candle].close - price) > rounding(price)) {
            crossed = true
            break
          }
        }
        if (crossed) continue
        for (let touch = anchor + 1; touch < nextPivot - 1; touch++) {
          if (touchesLine(candidate, pivots[touch], previousAtr)) {
            candidate.touches++
            addSpacedTouch(candidate, pivots[touch].index)
          }
        }
        addSpacedTouch(candidate, pivot.index)
        advance(candidate, index, buffer)
        candidates.push(candidate)
      }
    }

    if (includeHistory || majorOnly) {
      const next = bestActive()
      const sameLine = active && next && active.first.index === next.first.index && sameGeometry(active, next)
      if (includeHistory && active && active !== next && !sameLine) history.push(toTrendline(active, side, index))
      active = next
    }
  }

  if (!includeHistory) {
    if (!majorOnly) active = bestActive()
    if (!active) {
      for (const candidate of candidates) {
        if (isVisible(candidate) && outranks(candidate, active)) active = candidate
      }
    }
  }
  return { current: active && toTrendline(active, side, lastIndex), history }
}
