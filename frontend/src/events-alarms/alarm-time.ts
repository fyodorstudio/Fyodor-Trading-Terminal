export const jakartaDisplay = { mode: 'fixed-offset' as const, utcOffsetMinutes: 420, hour12: true }
const dateTime = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
export function alarmTime(at: number) { return dateTime.format(at) }
