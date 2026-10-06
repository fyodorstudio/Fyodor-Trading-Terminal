import type { EconomicCalendarEvent } from '../../../calendar-event'

type Row = EconomicCalendarEvent & { release_at: number }
type Publication = { at: number; rows: Row[] }
const indexes = new WeakMap<readonly Row[], Map<string, Publication[]>>()

// Immutable history arrays share this index across all release feature extractions.
// Duplicate rows at the latest timestamp stay ambiguous; never fall back silently.
export function priorReferenceRows(history: readonly Row[], id: string, month: number, before: number): Row[] {
  let index = indexes.get(history)
  if (!index) {
    index = new Map()
    const grouped = new Map<string, Map<number, Row[]>>()
    for (const row of history) {
      if (!Number.isFinite(row.period_seconds) || row.period_seconds <= 0) continue
      const date = new Date(row.period_seconds * 1000)
      if (!Number.isFinite(date.getTime())) continue
      const key = `${row.event_id}/${date.getUTCFullYear() * 12 + date.getUTCMonth()}`
      let publications = grouped.get(key)
      if (!publications) { publications = new Map(); grouped.set(key, publications) }
      publications.set(row.release_at, [...(publications.get(row.release_at) ?? []), row])
    }
    for (const [key, publications] of grouped) index.set(key, [...publications].map(([at, rows]) => ({ at, rows })).sort((a, b) => a.at - b.at))
    indexes.set(history, index)
  }
  const publications = index.get(`${id}/${month}`) ?? []
  let lo = 0, hi = publications.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (publications[mid].at < before) lo = mid + 1
    else hi = mid
  }
  return lo ? publications[lo - 1].rows : []
}
