import type { OhlcBar } from '../../market-data/contracts/OhlcBar'

type Timeline = Pick<OhlcBar, 'time'>[]
const timelines = new WeakMap<readonly OhlcBar[], Timeline>()
const recent: Timeline[] = []

// Immutable price snapshots can share their candle timeline. Preserve interior
// time changes as well as append/prepend; never serialize the full bar history.
export function candleTimeline(bars: readonly OhlcBar[]): Timeline {
  const known = timelines.get(bars)
  if (known) return known
  const matching = recent.find(times => times.length === bars.length && bars.every((bar, i) => bar.time === times[i].time))
  const timeline = matching ?? bars.map(({ time }) => ({ time }))
  timelines.set(bars, timeline)
  if (!matching) { recent.unshift(timeline); if (recent.length > 3) recent.pop() }
  return timeline
}
