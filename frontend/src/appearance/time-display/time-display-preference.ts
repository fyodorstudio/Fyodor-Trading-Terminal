import { TickMarkType, type Time } from 'lightweight-charts'

export type TimeDisplayMode = 'local' | 'utc' | 'fixed-offset'

export type TimeDisplayPreference = {
  mode: TimeDisplayMode
  utcOffsetMinutes: number
}

export const defaultTimeDisplayPreference: TimeDisplayPreference = {
  mode: 'local',
  utcOffsetMinutes: 0,
}

const storageKey = 'fyodor.time-display.v1'

export function readTimeDisplayPreference(): TimeDisplayPreference {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}') as Partial<TimeDisplayPreference>
    const mode = parsed.mode === 'utc' || parsed.mode === 'fixed-offset' ? parsed.mode : 'local'
    const utcOffsetMinutes = typeof parsed.utcOffsetMinutes === 'number'
      ? Math.min(840, Math.max(-720, Math.round(parsed.utcOffsetMinutes / 30) * 30))
      : 0
    return { mode, utcOffsetMinutes }
  } catch {
    return defaultTimeDisplayPreference
  }
}

export function saveTimeDisplayPreference(preference: TimeDisplayPreference) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(preference))
  } catch {
    // The unified display remains active for this session when storage is unavailable.
  }
}

export function formatUtcOffset(offsetMinutes: number) {
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absolute = Math.abs(offsetMinutes)
  const hours = Math.floor(absolute / 60).toString().padStart(2, '0')
  const minutes = (absolute % 60).toString().padStart(2, '0')
  return `UTC${sign}${hours}:${minutes}`
}

export function timeDisplayZoneLabel(preference: TimeDisplayPreference) {
  if (preference.mode === 'utc') return 'UTC'
  if (preference.mode === 'fixed-offset') return formatUtcOffset(preference.utcOffsetMinutes)
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function timeDisplayLabel(preference: TimeDisplayPreference) {
  const zone = timeDisplayZoneLabel(preference)
  return preference.mode === 'local' ? `Local · ${zone}` : zone
}

function displayDate(epochMilliseconds: number, preference: TimeDisplayPreference) {
  if (preference.mode === 'fixed-offset') {
    return { date: new Date(epochMilliseconds + preference.utcOffsetMinutes * 60_000), timeZone: 'UTC' }
  }
  return {
    date: new Date(epochMilliseconds),
    timeZone: preference.mode === 'utc' ? 'UTC' : undefined,
  }
}

export function formatAppTimestamp(
  epochMilliseconds: number,
  preference: TimeDisplayPreference,
  format: 'time' | 'time-short' | 'date-time' | 'date' = 'date-time',
) {
  const { date, timeZone } = displayDate(epochMilliseconds, preference)
  const dateOptions: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }
  const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', second: format === 'time' ? '2-digit' : undefined, hourCycle: 'h23' }
  return new Intl.DateTimeFormat(undefined, {
    ...(format === 'time' || format === 'time-short' ? timeOptions : format === 'date' ? dateOptions : { ...dateOptions, ...timeOptions }),
    timeZone,
  }).format(date)
}

function chartTimeToMilliseconds(time: Time) {
  if (typeof time === 'number') return time * 1000
  if (typeof time === 'string') return new Date(`${time}T00:00:00Z`).getTime()
  return Date.UTC(time.year, time.month - 1, time.day)
}

export function formatChartCrosshairTime(time: Time, preference: TimeDisplayPreference) {
  return formatAppTimestamp(chartTimeToMilliseconds(time), preference, 'date-time')
}

export function formatChartTick(time: Time, tickType: TickMarkType, preference: TimeDisplayPreference) {
  const { date, timeZone } = displayDate(chartTimeToMilliseconds(time), preference)
  const options: Intl.DateTimeFormatOptions = tickType === TickMarkType.Year
    ? { year: 'numeric' }
    : tickType === TickMarkType.Month
      ? { month: 'short' }
      : tickType === TickMarkType.DayOfMonth
        ? { day: '2-digit', month: 'short' }
        : { hour: '2-digit', minute: '2-digit', second: tickType === TickMarkType.TimeWithSeconds ? '2-digit' : undefined, hourCycle: 'h23' }
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone }).format(date)
}
