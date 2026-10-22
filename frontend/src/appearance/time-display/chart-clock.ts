// Chart coordinates are wall-clock values, not UTC instants. Keep storage and
// chart coordinates intact; convert only at display/input/query boundaries.
import clockProfiles from '../../../../config/broker-clock-profiles.json'
export type ChartClockScope = { brokerId: string | null; brokerOffsetSeconds: number }
export const defaultChartClock: ChartClockScope = { brokerId: null, brokerOffsetSeconds: 0 }
const hour = 3600000
type ClockProfile = { version: string; rule: string; firstYear: number; lastYear: number; offsetSeconds?: number }
const profiles: Record<string, ClockProfile> = clockProfiles
export function brokerClockProfile(brokerId: string | null) { return brokerId !== null && Object.hasOwn(profiles, brokerId) ? profiles[brokerId] : undefined }
const transitions = new Map<string, readonly [number, number]>()
function summer(year: number, rule: string) {
  const key = `${rule}/${year}`
  let dates = transitions.get(key)
  if (!dates) {
    const lastSunday = (month: number) => { const end = new Date(Date.UTC(year, month, 31, 1)); return end.getTime() - end.getUTCDay() * 86400000 }
    const sunday = (month: number, ordinal: number, utcHour: number) => {
      const first = new Date(Date.UTC(year, month, 1, utcHour))
      return first.getTime() + ((7 - first.getUTCDay()) % 7 + 7 * (ordinal - 1)) * 86400000
    }
    dates = rule === 'us-ny-close' ? [sunday(2, 2, 7), sunday(10, 1, 6)] : [lastSunday(2), lastSunday(9)]
    transitions.set(key, dates)
  }
  return dates
}
export function chartOffsetAt(utc: number, scope: ChartClockScope) {
  // Unscoped inputs are already UTC (offline/legacy charts). An identified
  // unfamiliar broker must never use today's offset for historical candles.
  if (scope.brokerId === null) return scope.brokerOffsetSeconds * 1000
  const profile = brokerClockProfile(scope.brokerId)
  if (!profile) return null
  const year = new Date(utc).getUTCFullYear()
  if (year < profile.firstYear || year > profile.lastYear) return null
  if (profile.rule === 'fixed') return profile.offsetSeconds === undefined ? null : profile.offsetSeconds * 1000
  if (profile.rule !== 'eu-eet-eest' && profile.rule !== 'us-ny-close') return null
  const [start, end] = summer(year, profile.rule)
  return utc >= start && utc < end ? 3 * hour : 2 * hour
}
export function utcToChartClock(utc: number, scope: ChartClockScope) {
  if (!Number.isFinite(utc)) return null
  const offset = chartOffsetAt(utc, scope)
  return offset === null ? null : utc + offset
}
export function chartClockToUtc(chart: number, scope: ChartClockScope) {
  if (!Number.isFinite(chart)) return null
  if (scope.brokerId === null) return chart - scope.brokerOffsetSeconds * 1000
  const profile = brokerClockProfile(scope.brokerId)
  if (!profile) return null
  const offsets = profile.rule === 'fixed' ? [profile.offsetSeconds! * 1000] : [2 * hour, 3 * hour]
  const candidates = offsets.map(offset => chart - offset).filter(utc => utcToChartClock(utc, scope) === chart)
  // A skipped/duplicated DST wall clock has no unique instant. Never guess.
  return candidates.length === 1 ? candidates[0] : null
}
