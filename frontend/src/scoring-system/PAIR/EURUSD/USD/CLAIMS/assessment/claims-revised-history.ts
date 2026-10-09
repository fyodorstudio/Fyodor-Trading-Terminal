import { hasSuppliedRevision, observedReading, type TimedReading } from '../../../../../shared/core/historical-release-signals'
import { claimsCount, claimsReference, claimsWeekSeconds, validClaimsReference } from './claims-weekly-history'

export type ClaimsObservation = { value: number | null; publishedAt: number; reference: number; kind: 'actual' | 'revision'; sourceId: string }
type Publication = { at: number; values: ClaimsObservation[] }
const indexes = new WeakMap<readonly TimedReading[], Map<string, Publication[]>>()

function historyIndex(history: readonly TimedReading[]) {
  let index = indexes.get(history)
  if (index) return index
  const groups = new Map<string, Map<number, ClaimsObservation[]>>()
  for (const row of history) {
    if (!observedReading(row) || !validClaimsReference(row)) continue
    const reference = claimsReference(row)!
    for (const kind of ['actual', 'revision'] as const) {
      if (kind === 'revision' && !hasSuppliedRevision(row)) continue
      const week = reference - (kind === 'revision' ? claimsWeekSeconds : 0), key = `${row.event_id}/${week}`
      let publications = groups.get(key)
      if (!publications) { publications = new Map(); groups.set(key, publications) }
      const value = { value: claimsCount(row, kind === 'actual' ? 'actual' : 'revised_previous'), publishedAt: row.release_at,
        reference: week, kind, sourceId: row.value_id }
      publications.set(row.release_at, [...(publications.get(row.release_at) ?? []), value])
    }
  }
  index = new Map([...groups].map(([key, publications]) => [key,
    [...publications].map(([at, values]) => ({ at, values })).sort((a, b) => a.at - b.at)]))
  indexes.set(history, index)
  return index
}

export function claimsObservationAsOf(history: readonly TimedReading[], current: TimedReading, reference: number): ClaimsObservation | null {
  // The selected publication owns its current revision even while storage catches up.
  if (reference === claimsReference(current)! - claimsWeekSeconds && hasSuppliedRevision(current)) return {
    value: claimsCount(current, 'revised_previous'), publishedAt: current.release_at, reference, kind: 'revision', sourceId: current.value_id,
  }
  const publications = historyIndex(history).get(`${current.event_id}/${reference}`) ?? []
  let lo = 0, hi = publications.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (publications[mid].at <= current.release_at) lo = mid + 1
    else hi = mid
  }
  const latest = lo ? publications[lo - 1].values : []
  return latest.length === 1 ? latest[0] : null
}
