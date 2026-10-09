import type { EconomicCalendarEvent } from '../../../../../../inspector/calendar-event'
import { nativeNumber, observedReading, type TimedReading } from '../../../../../shared/core/historical-release-signals'

const daySeconds = 86400
export const claimsWeekSeconds = 7 * daySeconds
export function claimsReference(e: EconomicCalendarEvent) {
  const period = e.period_seconds
  return Number.isSafeInteger(period) && period > 0 && period % daySeconds === 0 ? period : null
}
export function claimsCount(e: EconomicCalendarEvent | undefined, field: 'actual' | 'revised_previous' = 'actual') {
  if (!e || e.unit !== 0 || e.multiplier !== (e.event_id === '840140002' ? 2 : 1)) return null
  const value = nativeNumber(e, field)
  const count = value === null ? null : value * (e.event_id === '840140002' ? 1000 : 1)
  return count === null || !Number.isFinite(count) || count < 0 || count * 1000 > Number.MAX_SAFE_INTEGER ? null : count
}
export function validClaimsReference(e: TimedReading) {
  const reference = claimsReference(e)
  if (reference === null) return false
  const age = e.release_at / 1000 - reference
  // Provider week labels may be Friday or Saturday; retain the exact source date.
  return age >= daySeconds && age <= (e.event_id === '840140002' ? 21 : 14) * daySeconds
}

type Publication = { at: number; rows: TimedReading[] }
const indexes = new WeakMap<readonly TimedReading[], Map<string, Publication[]>>()
export function priorClaimsWeekValues(history: readonly TimedReading[], current: TimedReading, count = 4) {
  let index = indexes.get(history)
  if (!index) {
    const groups = new Map<string, Map<number, TimedReading[]>>()
    for (const row of history) {
      if (!observedReading(row)) continue
      const period = claimsReference(row)
      if (period === null) continue
      const key = `${row.event_id}/${period}`
      let publications = groups.get(key)
      if (!publications) { publications = new Map(); groups.set(key, publications) }
      publications.set(row.release_at, [...(publications.get(row.release_at) ?? []), row])
    }
    index = new Map([...groups].map(([key, publications]) => [key,
      [...publications].map(([at, rows]) => ({ at, rows })).sort((a, b) => a.at - b.at)]))
    indexes.set(history, index)
  }
  const reference = claimsReference(current)!
  const values = Array.from({ length: count }, (_, i) => i + 1).map(n => {
    const publications = index!.get(`${current.event_id}/${reference - n * claimsWeekSeconds}`) ?? []
    let lo = 0, hi = publications.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (publications[mid].at < current.release_at) lo = mid + 1
      else hi = mid
    }
    const rows = lo ? publications[lo - 1].rows : [], row = rows[0]
    return rows.length === 1 && validClaimsReference(row) ? claimsCount(row) : null
  })
  return values
}

export function priorClaimsWeeks(history: readonly TimedReading[], current: TimedReading, count = 4) {
  const values = priorClaimsWeekValues(history, current, count)
  return values.some(n => n === null) ? null : values as number[]
}
