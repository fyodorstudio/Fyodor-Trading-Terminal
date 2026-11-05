import { chartClockToUtc, type ChartClockScope } from '../../../appearance/time-display/chart-clock'
import type { OhlcBar } from '../../contracts/OhlcBar'
import { changedRecentBarStart } from '../../mt5-feed/market-snapshots'
import type { VolumePreferences } from './volume-preferences'

export type VolumeRow = { time: OhlcBar['time']; utc: number | null; ticks?: number; relative?: number; samples: number; average?: number }
export type VolumeRange = { from: number; to: number }
type Sample = { day: string; ticks: number | undefined }

/** Baselines contain earlier dates only. The last mutable candle is never
 * committed until a following candle arrives, so polling cannot count it twice.
 * Corrections/prepends rebuild; normal live updates visit just the changed tail. */
export function createVolumeCalculator() {
  let previous: OhlcBar[] = [], signature = '', committed = 0
  const buckets = new Map<string, Sample[]>(), rows: VolumeRow[] = [], sums: number[] = [], counts: number[] = []
  return {
    sync(bars: OhlcBar[], preferences: VolumePreferences, scope: ChartClockScope, step: number) {
      const key = `${scope.brokerId}:${scope.brokerOffsetSeconds}:${step}:${preferences.clock}:${preferences.lookback}:${preferences.minimumSamples}:${preferences.averageLength}`
      const change = key === signature ? bars === previous ? bars.length : changedRecentBarStart(bars, previous) : null
      const rebuilt = change === null || bars[0]?.time !== previous[0]?.time || bars.length < previous.length || change < previous.length - 1
      const from = rebuilt ? 0 : Math.min(change!, previous.length)
      if (rebuilt) { buckets.clear(); committed = 0 }
      const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: preferences.clock, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      const slot = (bar: OhlcBar) => {
        const utc = chartClockToUtc(bar.time * 1000, scope)
        if (utc === null) return { utc, day: '', slot: '' }
        // D1 compares broker daily bars, independent of regional opening hours.
        if (step >= 86400) return { utc, day: new Date(bar.time * 1000).toISOString().slice(0, 10), slot: 'daily' }
        const parts = Object.fromEntries(formatter.formatToParts(utc).map(part => [part.type, part.value]))
        return { utc, day: `${parts.year}-${parts.month}-${parts.day}`, slot: `${parts.hour}:${parts.minute}` }
      }
      let work = 0
      for (let i = from; i < bars.length; i++) {
        // Commit the previous row once, after its candle has closed.
        while (committed < i) {
          const prior = rows[committed], at = slot(bars[committed]); work++
          if (at.slot && prior.ticks !== undefined) {
            const samples = buckets.get(at.slot) ?? []
            // A duplicated local slot during a clock change is ambiguous: omit
            // that day's sample instead of weighting the day twice.
            if (samples.at(-1)?.day === at.day) samples[samples.length - 1] = { day: at.day, ticks: undefined }
            else samples.push({ day: at.day, ticks: prior.ticks })
            if (samples.length > preferences.lookback) samples.shift()
            buckets.set(at.slot, samples)
          }
          committed++
        }
        const bar = bars[i], at = slot(bar); work++
        const ticks = typeof bar.tickVolume === 'number' && Number.isFinite(bar.tickVolume) && bar.tickVolume >= 0 ? bar.tickVolume : undefined
        const samples = (buckets.get(at.slot) ?? []).filter(sample => sample.day < at.day && sample.ticks !== undefined)
        const baseline = samples.length ? samples.reduce((sum, sample) => sum + sample.ticks!, 0) / samples.length : 0
        const relative = ticks !== undefined && samples.length >= preferences.minimumSamples && baseline > 0 ? ticks / baseline : undefined
        sums[i] = (sums[i - 1] ?? 0) + (ticks ?? 0)
        counts[i] = (counts[i - 1] ?? 0) + (ticks === undefined ? 0 : 1)
        const period = preferences.averageLength
        const average = i + 1 >= period && counts[i] - (counts[i - period] ?? 0) === period ? (sums[i] - (sums[i - period] ?? 0)) / period : undefined
        rows[i] = { time: bar.time, utc: at.utc, ticks, relative, samples: samples.length, average }
      }
      rows.length = sums.length = counts.length = bars.length
      const previousLength = previous.length
      previous = bars; signature = key
      return { rows, from, rebuilt, previousLength, work }
    },
  }
}

export function summarizeVolumeRange(bars: OhlcBar[], rows: VolumeRow[], range: VolumeRange, step: number, now: number) {
  let lo = 0, hi = bars.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (bars[mid].time < range.from) lo = mid + 1; else hi = mid }
  const start = lo
  let candles = 0, valid = 0, relativeCount = 0, ticks = 0, relative = 0, high = -Infinity, excluded = 0, endFound = false
  for (let i = start; i < bars.length && bars[i].time <= range.to; i++) {
    if (bars[i].time === range.to) endFound = true
    const row = rows[i]
    if (!row || (i === bars.length - 1 && (row.utc === null || row.utc + step * 1000 > now))) { excluded++; continue }
    candles++; high = Math.max(high, bars[i].high)
    if (row.ticks !== undefined) { ticks += row.ticks; valid++ }
    if (row.relative !== undefined) { relative += row.relative; relativeCount++ }
  }
  const complete = bars[start]?.time === range.from && endFound
  return { candles, ticks: candles > 0 && valid === candles && complete ? ticks : undefined,
    averageRelative: candles > 0 && relativeCount === candles && complete ? relative / candles : undefined,
    relativeCount, high: candles ? high : undefined, minutes: candles * step / 60, excluded }
}
