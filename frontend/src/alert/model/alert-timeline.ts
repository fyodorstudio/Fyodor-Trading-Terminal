import type { AlertDayGroup } from './alert-day-model'

// Groups are ordered by exact publication time, with unknown times last.
// The divider follows every elapsed row, including all rows at the same instant.
export function currentTimePosition(groups: readonly Pick<AlertDayGroup, 'at'>[], now: number) {
  let low = 0, high = groups.length
  while (low < high) {
    const middle = (low + high) >>> 1
    const at = groups[middle].at
    if (at !== null && at <= now) low = middle + 1
    else high = middle
  }
  return low
}
