import type { OhlcBar } from '../../contracts/OhlcBar'

export type ProfileWindow = { from: number; to: number }
export type ProfileMode = 'visible' | 'fixed' | 'cutoff'
export type ProfileSide = 'left' | 'right'
export type ProfileRow = { low: number; high: number; count: number; node?: 'POC' | 'HVN' | 'LVN' }
export type TickProfile = { rows: ProfileRow[]; poc: ProfileRow; count: number }

export function profileCandleWindow(bars: readonly OhlcBar[], from: number, to: number, step: number): ProfileWindow | null {
  const first = bars[Math.max(0, Math.ceil(Math.min(from, to)))]
  const last = bars[Math.min(bars.length - 1, Math.floor(Math.max(from, to)))]
  return first && last && first.time <= last.time ? { from: first.time, to: last.time + step } : null
}

export function trailingProfileWindow(end: number, lookbackMinutes: number): ProfileWindow {
  return { from: Math.max(0, end - lookbackMinutes * 60), to: end }
}

export function movingProfileWindow(bars: readonly OhlcBar[], from: number, to: number, step: number,
  lookbackMinutes: number, anchorRatio: number): (ProfileWindow & { left: number; right: number }) | null {
  if (from > bars.length - 1 || to < 0) return null
  const index = Math.max(0, Math.min(bars.length - 1, Math.floor(from + (to - from) * anchorRatio)))
  const anchor = bars[index]
  if (!anchor) return null

  // The chart collapses gaps between candles to one bar of spacing. Count
  // candle time for the box, then resolve its edges to minute-aligned tick times.
  const seconds = lookbackMinutes * 60
  const candleCount = Math.ceil(seconds / step)
  const firstIndex = index - candleCount + 1
  const open = bars[firstIndex]?.time ?? bars[0].time + firstIndex * step
  const right = index + 0.5
  return { from: Math.max(0, open + candleCount * step - seconds), to: anchor.time + step,
    left: right - seconds / step, right }
}

export function profileFromCutoff(bars: readonly OhlcBar[], cutoff: number, step: number, side: ProfileSide): ProfileWindow | null {
  const first = bars[0], last = bars.at(-1)
  if (!first || !last) return null
  const end = last.time + step
  const from = side === 'left' ? first.time : cutoff
  const to = side === 'left' ? Math.min(cutoff, end) : end
  return from < to ? { from, to } : null
}

export function buildTickProfile(levels: ReadonlyMap<number, number>, digits: number): TickProfile | null {
  if (!levels.size) return null
  let min = Infinity, max = -Infinity, count = 0
  for (const [level, ticks] of levels) {
    min = Math.min(min, level)
    max = Math.max(max, level)
    count += ticks
  }
  const step = Math.max(1, Math.ceil((max - min + 1) / 48))
  const start = Math.floor(min / step) * step
  const size = Math.floor((max - start) / step) + 1
  const counts = new Array<number>(size).fill(0)
  for (const [level, ticks] of levels) counts[Math.floor((level - start) / step)] += ticks
  const peak = Math.max(...counts)
  const pocIndex = counts.indexOf(peak)
  const unit = 10 ** digits
  const rows = counts.map((ticks, i): ProfileRow => {
    const row = { low: (start + i * step - 0.5) / unit, high: (start + (i + 1) * step - 0.5) / unit, count: ticks }
    if (i === pocIndex) return { ...row, node: 'POC' }
    if (i === 0 || i === counts.length - 1) return row
    if (ticks >= peak * 0.35 && ticks > Math.max(counts[i - 1], counts[i + 1])) return { ...row, node: 'HVN' }
    if (ticks <= Math.min(counts[i - 1], counts[i + 1]) * 0.4 && ticks < Math.min(counts[i - 1], counts[i + 1])) return { ...row, node: 'LVN' }
    return row
  })
  return { rows, poc: rows[pocIndex], count }
}
