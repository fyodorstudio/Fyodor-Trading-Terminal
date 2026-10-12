import type { TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import { timeDisplayZoneLabel } from '../appearance/time-display/time-display-preference'
import { chartClockToUtc, type ChartClockScope } from '../appearance/time-display/chart-clock'
import { displayDateKey } from '../economic-calendar/time/calendar-display-range'
import { inspectorDisplayRange } from '../inspector/inspector-date-range'

export type ResearchSeed = {
  scope: string
  kind: 'historical' | 'upcoming'
  from: string
  to: string
  focus?: string
  focusIds?: string[]
  currency?: string
}
export type SavedReport = { filename: string; path: string; readings: number; context_readings: number; coverage_incomplete: boolean }

export function researchRangeDates(from: number, to: number, clock: ChartClockScope, display: TimeDisplayPreference) {
  const left = chartClockToUtc(Math.min(from, to) * 1000, clock)
  const right = chartClockToUtc(Math.max(from, to) * 1000, clock)
  return left === null || right === null ? null : { from: displayDateKey(left, display), to: displayDateKey(right, display) }
}

export function researchRequest(seed: ResearchSeed, sourceId: string, display: TimeDisplayPreference,
  title: string, from: string, to: string, question: string, contextDays: number, scope: string) {
  const range = inspectorDisplayRange({ from, to }, display)
  if (!range || !title.trim()) throw new Error('Enter a report name and valid dates.')
  return { source_id: sourceId, title: title.trim(), scope, kind: seed.kind, from_date: from, to_date: to,
    from_utc_ms: range.from, to_utc_ms: range.to, timezone: timeDisplayZoneLabel(display), context_days: contextDays,
    question, focus: seed.focus ?? '', focus_ids: seed.focusIds ?? [] }
}
