import type { ISeriesApi, Time, UTCTimestamp } from 'lightweight-charts'

export const futureTimelineSeconds = 90 * 86400
type Timeline = readonly { time: number }[]
type TimeSeries = Pick<ISeriesApi<'Line', Time>, 'setData'>
// Lightweight Charts bounds scrolling by the last valued series point, even
// when later whitespace exists. An invisible anchor on its own scale opens the
// whole horizon; its inert value is never a candle, quote or calculation input.
const horizonAnchor = (time: number) => ({ time: time as UTCTimestamp, value: 0 })

// Old whitespace slots may remain only where real candles now occupy them.
// Removing/correcting those candle times must not leave invented history slots.
function filledSlotsPresent(bars: Timeline, anchor: number, last: number, step: number) {
  let lo = 0, hi = bars.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (bars[mid].time <= anchor) lo = mid + 1; else hi = mid }
  for (let time = anchor + step; time <= last; time += step, lo++) {
    if (bars[lo]?.time !== time) return false
  }
  return true
}

export function createFutureTimeline(series: TimeSeries) {
  let state: { anchor: number; last: number; step: number } | null = null
  return {
    clear() {
      if (state) series.setData([])
      state = null
    },
    sync(bars: Timeline, step: number, reset = false, replaced = false) {
      const last = bars.at(-1)?.time
      if (last === undefined || !Number.isFinite(last) || step <= 0 || !Number.isFinite(step)) return
      if (!state || reset || state.step !== step ||
        (last !== state.last && last - state.last !== step) || Math.floor(last / 86400) !== Math.floor(state.anchor / 86400) ||
        (replaced && !filledSlotsPresent(bars, state.anchor, last, step))) {
        // Include the whole 90th calendar day. Keeping its exclusive midnight
        // boundary fixed avoids a native timeline update on every new candle.
        const end = Math.floor(last / 86400) * 86400 + futureTimelineSeconds + 86400
        const count = Math.ceil((end - last) / step) - 1
        series.setData(Array.from({ length: count }, (_, i) => i === count - 1 ? horizonAnchor(last + count * step) :
          ({ time: (last + (i + 1) * step) as UTCTimestamp })))
        state = { anchor: last, last, step }
        return true
      } else if (last !== state.last) {
        state.last = last
      }
      return false
    },
  }
}
