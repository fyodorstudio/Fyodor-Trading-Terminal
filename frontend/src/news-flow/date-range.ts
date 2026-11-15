import { parseDisplayClockInput } from '../appearance/time-display/display-clock-input'
import type { TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import { chartClockToUtc, type ChartClockScope } from '../appearance/time-display/chart-clock'

export type NewsDateSelection = { date: string; start: number; end: number }

export function newsDateBounds(date: string, preference: TimeDisplayPreference): [number | null, number | null] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) return [null, null]
  const next = new Date(`${date}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1)
  return [parseDisplayClockInput(`${date}T00:00`, preference), parseDisplayClockInput(`${next.toISOString().slice(0, 10)}T00:00`, preference)]
}

export function heatmapNewsSelection(date: string, scope: ChartClockScope): NewsDateSelection | null {
  const midnight = Date.parse(`${date}T00:00:00Z`)
  const start = chartClockToUtc(midnight, scope), end = chartClockToUtc(midnight + 86400_000, scope)
  return start === null || end === null ? null : { date, start, end }
}
