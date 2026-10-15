import type { TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import { displayDateKey } from '../economic-calendar/time/calendar-display-range'
import type { ExternalSource } from './external-source-model'

export type ExternalDateSort = 'upcoming' | 'earliest' | 'latest'

export function sortExternalDates(items: ExternalSource[], order: ExternalDateSort, now: number, display: TimeDisplayPreference) {
  const today = displayDateKey(now, display)
  const dated = items.map(item => {
    const at = item.event_at ? Date.parse(item.event_at) : null
    const date = at !== null ? displayDateKey(at, display) : item.event_date
    return { item, date, at, upcoming: at !== null ? at >= now : date !== null && date >= today }
  })
  dated.sort((a, b) => {
    if (!a.date || !b.date) return a.date ? -1 : b.date ? 1 : a.item.key.localeCompare(b.item.key)
    if (order === 'upcoming' && a.upcoming !== b.upcoming) return a.upcoming ? -1 : 1
    // An unconfirmed hour is grouped with its source day, never assigned midnight.
    const byDate = a.date.localeCompare(b.date) || (a.at !== null && b.at !== null ? a.at - b.at : a.at === null ? b.at === null ? 0 : -1 : 1)
    const descending = order === 'latest' || order === 'upcoming' && !a.upcoming
    return (descending ? -byDate : byDate) || a.item.key.localeCompare(b.item.key)
  })
  return dated.map(entry => entry.item)
}

export function externalCountdown(item: ExternalSource, now: number, display: TimeDisplayPreference) {
  if (!item.event_at) {
    if (!item.event_date) return 'Unscheduled'
    const today = displayDateKey(now, display)
    const days = Math.round((Date.parse(item.event_date) - Date.parse(today)) / 86_400_000)
    return days === 0 ? 'Today' : days > 0 ? `In ${days} ${days === 1 ? 'day' : 'days'}` : `${-days} ${days === -1 ? 'day' : 'days'} ago`
  }
  const remaining = Date.parse(item.event_at) - now
  if (remaining < 0) return 'Elapsed'
  const seconds = Math.ceil(remaining / 1000)
  const days = Math.floor(seconds / 86400), hours = Math.floor(seconds % 86400 / 3600)
  const minutes = Math.floor(seconds % 3600 / 60), rest = seconds % 60
  return days ? `${days}d ${hours}h ${minutes}m` : hours ? `${hours}h ${minutes}m ${rest}s` : `${minutes}m ${rest}s`
}
