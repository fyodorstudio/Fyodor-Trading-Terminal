import type { TimeDisplayPreference } from './time-display-preference'

export function displayClockInput(utc: number, preference: TimeDisplayPreference) {
  const date = new Date(utc + (preference.mode === 'fixed-offset' ? preference.utcOffsetMinutes * 60000 : 0))
  if (preference.mode !== 'local') return date.toISOString().slice(0, 16)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
export function parseDisplayClockInput(value: string, preference: TimeDisplayPreference) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const utc = Date.parse(value + (preference.mode === 'local' ? '' : 'Z')) - (preference.mode === 'fixed-offset' ? preference.utcOffsetMinutes * 60000 : 0)
  return Number.isFinite(utc) && displayClockInput(utc, preference) === value ? utc : null
}
