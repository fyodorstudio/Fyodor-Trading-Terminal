import { chartClockToUtc, type ChartClockScope } from '../../../appearance/time-display/chart-clock'
import type { OhlcBar } from '../../contracts/OhlcBar'
import { createForexSessionLookup } from '../../market-watch/forex-sessions'
import { changedRecentBarStart } from '../../mt5-feed/market-snapshots'
import type { VolumePreferences } from './volume-preferences'

export type VolumeRow = { time: OhlcBar['time']; utc: number | null; ticks?: number; relative?: number; samples: number; average?: number; session: string }
type Sample = { day: string; ticks: number | undefined }

/** Baselines contain earlier dates only. The last mutable candle is never
 * committed until a following candle arrives, so polling cannot count it twice.
 * Corrections/prepends rebuild; normal live updates visit just the changed tail. */
export function createVolumeCalculator() {
  let previous: OhlcBar[] = [], signature = '', committed = 0
  const buckets = new Map<string, Sample[]>(), rows: VolumeRow[] = [], sums: number[] = [], counts: number[] = []
  const sessionAt = createForexSessionLookup()
  const slots: Array<{ utc: number | null; day: string; slot: string; session: string }> = []
  return {
    sync(bars: OhlcBar[], preferences: VolumePreferences, scope: ChartClockScope, step: number) {
      const key = `${scope.brokerId}:${scope.brokerOffsetSeconds}:${step}:${preferences.lookback}:${preferences.minimumSamples}:${preferences.averageLength}`
      const change = key === signature ? bars === previous ? bars.length : changedRecentBarStart(bars, previous) : null
      const rebuilt = change === null || bars[0]?.time !== previous[0]?.time || bars.length < previous.length || change < previous.length - 1
      const from = rebuilt ? 0 : Math.min(change!, previous.length)
      if (rebuilt) { buckets.clear(); committed = 0 }
      const slot = (bar: OhlcBar) => {
        const utc = chartClockToUtc(bar.time * 1000, scope)
        if (utc === null) return { utc, day: '', slot: '', session: '' }
        if (step >= 86400) return { utc, day: new Date(bar.time * 1000).toISOString().slice(0, 10), slot: 'daily', session: 'Daily bars' }
        const first = sessionAt(utc), end = utc + step * 1000
        const parts: string[] = [], labels: string[] = []
        let cursor = utc, active = false
        while (cursor < end) {
          const context = sessionAt(cursor), until = Math.min(end, context.to)
          if (until <= cursor) break
          active ||= context.names.length > 0
          // Match the full session mix of a multi-hour candle, without
          // inventing tick counts for the portions on either side of a boundary.
          parts.push(`${context.key}:${(cursor - context.from) / 1000}:${(until - cursor) / 1000}`)
          labels.push(context.key || 'No active session')
          cursor = until
        }
        return { utc, day: new Date(first.from).toISOString(), slot: active ? parts.join('|') : '', session: labels.join(' → ') }
      }
      let work = 0
      for (let i = from; i < bars.length; i++) {
        // Commit the previous row once, after its candle has closed.
        while (committed < i) {
          const prior = rows[committed], at = slots[committed]; work++
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
        const bar = bars[i], at = slot(bar); slots[i] = at; work++
        const ticks = typeof bar.tickVolume === 'number' && Number.isFinite(bar.tickVolume) && bar.tickVolume >= 0 ? bar.tickVolume : undefined
        const samples = (buckets.get(at.slot) ?? []).filter(sample => sample.day < at.day && sample.ticks !== undefined)
        const baseline = samples.length ? samples.reduce((sum, sample) => sum + sample.ticks!, 0) / samples.length : 0
        const relative = ticks !== undefined && samples.length >= preferences.minimumSamples && baseline > 0 ? ticks / baseline : undefined
        sums[i] = (sums[i - 1] ?? 0) + (ticks ?? 0)
        counts[i] = (counts[i - 1] ?? 0) + (ticks === undefined ? 0 : 1)
        const period = preferences.averageLength
        const average = i + 1 >= period && counts[i] - (counts[i - period] ?? 0) === period ? (sums[i] - (sums[i - period] ?? 0)) / period : undefined
        rows[i] = { time: bar.time, utc: at.utc, ticks, relative, samples: samples.length, average, session: at.session }
      }
      rows.length = slots.length = sums.length = counts.length = bars.length
      const previousLength = previous.length
      previous = bars; signature = key
      return { rows, from, rebuilt, previousLength, work }
    },
  }
}
