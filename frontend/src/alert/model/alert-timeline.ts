import type { AlertDayGroup } from './alert-day-model'

export function scheduledAnchors(groups: readonly AlertDayGroup[]) {
  const seen = new Set<number>()
  return groups.flatMap((group, index) => {
    if (group.at === null || seen.has(group.at) || !group.release && !group.external.some(item =>
      !item.archived && item.kind === 'scheduled' && item.status === 'confirmed' && item.risk_status !== 'resolved')) return []
    seen.add(group.at)
    return [{ at: group.at, index, key: group.key }]
  }).sort((a, b) => a.at - b.at)
}
export function nearestScheduledAnchor(anchors: ReturnType<typeof scheduledAnchors>, now: number) {
  let low = 0, high = anchors.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (anchors[middle].at < now) low = middle + 1
    else high = middle
  }
  if (!low) return anchors[0]
  if (low === anchors.length) return anchors[low - 1]
  return now - anchors[low - 1].at < anchors[low].at - now ? anchors[low - 1] : anchors[low]
}
