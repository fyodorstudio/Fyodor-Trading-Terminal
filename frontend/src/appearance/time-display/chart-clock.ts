// Chart coordinates are wall-clock values, not UTC instants. Keep storage and
// scoring coordinates intact; convert only at display/input/query boundaries.
export type ChartClockScope = { brokerId: string | null; brokerOffsetSeconds: number }
export const defaultChartClock: ChartClockScope = { brokerId: null, brokerOffsetSeconds: 0 }
const hour = 3600000
const transitions = new Map<number, readonly [number, number]>()
function summer(year: number) {
  let dates = transitions.get(year)
  if (!dates) {
    const lastSunday = (month: number) => { const end = new Date(Date.UTC(year, month, 31, 1)); return end.getTime() - end.getUTCDay() * 86400000 }
    dates = [lastSunday(2), lastSunday(9)]; transitions.set(year, dates)
  }
  return dates
}
export function chartOffsetAt(utc: number, scope: ChartClockScope) {
  if (scope.brokerId !== 'Elev8-Demo2') return scope.brokerOffsetSeconds * 1000
  const year = new Date(utc).getUTCFullYear()
  if (year < 2014 || year > 2031) return null
  const [start, end] = summer(year)
  return utc >= start && utc < end ? 3 * hour : 2 * hour
}
export function utcToChartClock(utc: number, scope: ChartClockScope) {
  if (!Number.isFinite(utc)) return null
  const offset = chartOffsetAt(utc, scope)
  return offset === null ? null : utc + offset
}
export function chartClockToUtc(chart: number, scope: ChartClockScope) {
  if (!Number.isFinite(chart)) return null
  if (scope.brokerId !== 'Elev8-Demo2') return chart - scope.brokerOffsetSeconds * 1000
  const candidates = [chart - 2 * hour, chart - 3 * hour].filter(utc => utcToChartClock(utc, scope) === chart)
  // A skipped/duplicated DST wall clock has no unique instant. Never guess.
  return candidates.length === 1 ? candidates[0] : null
}
