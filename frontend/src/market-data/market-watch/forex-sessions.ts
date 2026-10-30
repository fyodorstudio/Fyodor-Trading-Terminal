const hour = 3_600_000
const sessions = [
  { name: 'Sydney', zone: 'Australia/Sydney', open: 7, close: 16, color: '#0284c7' },
  { name: 'Tokyo', zone: 'Asia/Tokyo', open: 9, close: 18, color: '#9333ea' },
  { name: 'London', zone: 'Europe/London', open: 8, close: 17, color: '#b45309' },
  { name: 'New York', zone: 'America/New_York', open: 8, close: 17, color: '#059669' },
] as const
const formatters = new Map<string, Intl.DateTimeFormat>()
function localParts(time: number, zone: string) {
  let formatter = formatters.get(zone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    formatters.set(zone, formatter)
  }
  const parts = Object.fromEntries(formatter.formatToParts(time).map(part => [part.type, part.value]))
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
}
function localToUtc(wall: number, zone: string) {
  let utc = wall
  for (let i = 0; i < 3; i++) utc += wall - localParts(utc, zone)
  return utc
}
const clock = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', minute: '2-digit', hour12: true })

export function forexSessions(now: number) {
  const start = Math.floor((now + 7 * hour) / (24 * hour)) * 24 * hour - 7 * hour
  return { now: (now - start) / (24 * hour), sessions: sessions.map(session => {
    const date = new Date(localParts(start, session.zone))
    const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    const windows = [-1, 0, 1, 2].flatMap(offset => {
      const day = midnight + offset * 24 * hour, weekday = new Date(day).getUTCDay()
      if (weekday === 0 || weekday === 6) return []
      const open = localToUtc(day + session.open * hour, session.zone)
      const close = localToUtc(day + session.close * hour, session.zone)
      if (close <= start || open >= start + 24 * hour) return []
      return [{ from: Math.max(0, (open - start) / (24 * hour)), to: Math.min(1, (close - start) / (24 * hour)),
        open, close, label: `${clock.format(open)}–${clock.format(close)} Jakarta${close >= start + 24 * hour ? ' (closes next day)' : ''}` }]
    })
    return { ...session, windows, active: windows.some(window => now >= window.open && now < window.close) }
  }) }
}
