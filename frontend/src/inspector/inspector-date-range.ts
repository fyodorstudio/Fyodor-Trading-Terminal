import { calendarDisplayRange, displayWeekDateKeys, type CalendarRangePreset } from './calendar-display-range'
import type { TimeDisplayPreference } from '../appearance/time-display/time-display-preference'

export type InspectorRangePreset = CalendarRangePreset | 'today' | 'this-month' | 'year-to-date'
export const inspectorRangePresets = [
  ['today', 'Today'], ['previous-week', 'Previous week'], ['this-week', 'This week'],
  ['next-week', 'Next week'], ['this-month', 'This month'], ['year-to-date', 'Year to date'],
] as const
export function validInspectorDate(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || Number(key.slice(0, 4)) < 1000) return false
  const date = new Date(`${key}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === key
}
export function shiftInspectorDate(key: string, days: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
}
export function shiftInspectorMonth(month: string, months: number): string {
  const [year, number] = month.split('-').map(Number)
  return new Date(Date.UTC(year, number - 1 + months, 1)).toISOString().slice(0, 7)
}
export function inspectorRangeDates(preset: InspectorRangePreset, today: string, from: string, to: string) {
  const week = displayWeekDateKeys(today)
  switch (preset) {
    case 'today': return { from: today, to: today }
    case 'this-month': return { from: `${today.slice(0, 7)}-01`, to: shiftInspectorDate(`${shiftInspectorMonth(today.slice(0, 7), 1)}-01`, -1) }
    case 'year-to-date': return { from: `${today.slice(0, 4)}-01-01`, to: today }
    case 'previous-week': return { from: shiftInspectorDate(week.start, -7), to: shiftInspectorDate(week.end, -7) }
    case 'next-week': return { from: shiftInspectorDate(week.start, 7), to: shiftInspectorDate(week.end, 7) }
    case 'this-week': return { from: week.start, to: week.end }
    case 'custom': return { from, to }
  }
}
export function inspectorDisplayRange(dates: { from: string; to: string }, display: TimeDisplayPreference) {
  if (!validInspectorDate(dates.from) || !validInspectorDate(dates.to) || dates.from > dates.to) return null
  return calendarDisplayRange('custom', dates.from, dates.from, dates.to, display)
}
export function inspectorRangeLabel(from: string, to: string) {
  if (!validInspectorDate(from) || !validInspectorDate(to) || from > to) return 'Choose dates'
  const format = (key: string, year: boolean) => new Intl.DateTimeFormat(undefined, {
    day: 'numeric', month: 'short', ...(year ? { year: 'numeric' as const } : {}), timeZone: 'UTC',
  }).format(new Date(`${key}T00:00:00Z`))
  return from === to ? format(from, true) : `${format(from, from.slice(0, 4) !== to.slice(0, 4))} – ${format(to, true)}`
}
