import type { TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'

export type CalendarRangePreset = 'previous-week' | 'this-week' | 'next-week' | 'custom'

export type CalendarDisplayRange = {
  from: number
  to: number
}

type DateParts = {
  year: number
  month: number
  day: number
}

function datePartsAt(epochMilliseconds: number, preference: TimeDisplayPreference): DateParts {
  if (preference.mode === 'fixed-offset') {
    const shifted = new Date(epochMilliseconds + preference.utcOffsetMinutes * 60_000)
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
    }
  }

  const date = new Date(epochMilliseconds)
  if (preference.mode === 'utc') {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
    }
  }
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  }
}

function dateKey(parts: DateParts) {
  return `${parts.year.toString().padStart(4, '0')}-${parts.month.toString().padStart(2, '0')}-${parts.day.toString().padStart(2, '0')}`
}

function parseDateKey(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

function shiftDateKey(value: string, days: number) {
  const parts = parseDateKey(value)
  if (!parts) return value
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days))
  return dateKey({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  })
}

function displayMidnight(value: string, preference: TimeDisplayPreference) {
  const parts = parseDateKey(value)
  if (!parts) return Number.NaN
  if (preference.mode === 'local') {
    return new Date(parts.year, parts.month - 1, parts.day).getTime()
  }
  const utcMidnight = Date.UTC(parts.year, parts.month - 1, parts.day)
  return preference.mode === 'fixed-offset'
    ? utcMidnight - preference.utcOffsetMinutes * 60_000
    : utcMidnight
}

export function displayDateKey(epochMilliseconds: number, preference: TimeDisplayPreference) {
  return dateKey(datePartsAt(epochMilliseconds, preference))
}

export function displayWeekDateKeys(today: string) {
  const parts = parseDateKey(today)
  if (!parts) return { start: today, end: today }
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()
  const daysSinceMonday = (weekday + 6) % 7
  const start = shiftDateKey(today, -daysSinceMonday)
  return { start, end: shiftDateKey(start, 6) }
}

export function calendarDisplayRange(
  preset: CalendarRangePreset,
  today: string,
  customFrom: string,
  customTo: string,
  preference: TimeDisplayPreference,
): CalendarDisplayRange | null {
  const currentWeek = displayWeekDateKeys(today)
  let fromKey = currentWeek.start
  let toExclusiveKey = shiftDateKey(currentWeek.end, 1)

  if (preset === 'previous-week') {
    fromKey = shiftDateKey(currentWeek.start, -7)
    toExclusiveKey = currentWeek.start
  } else if (preset === 'next-week') {
    fromKey = shiftDateKey(currentWeek.start, 7)
    toExclusiveKey = shiftDateKey(currentWeek.start, 14)
  } else if (preset === 'custom') {
    if (!parseDateKey(customFrom) || !parseDateKey(customTo) || customFrom > customTo) return null
    fromKey = customFrom
    toExclusiveKey = shiftDateKey(customTo, 1)
  }

  const from = displayMidnight(fromKey, preference)
  const to = displayMidnight(toExclusiveKey, preference)
  return Number.isFinite(from) && Number.isFinite(to) ? { from, to } : null
}
