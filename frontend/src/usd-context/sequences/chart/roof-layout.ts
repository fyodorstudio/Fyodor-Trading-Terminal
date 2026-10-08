import { comboActivation } from '../core/combo-activation'
import type { ComboSnapshot } from '../core/contracts'
import type { RoofEndpoint } from './roof-symbols'

export type RoofCandidate = { combo: ComboSnapshot; left: number; right: number; endpoints: RoofEndpoint[]; hidden: number; labelX: number }
export type PositionedRoof = RoofCandidate & { lane: number }
const strengthRank = { strong: 3, moderate: 2, weak: 1 }
const pairRank = (c: ComboSnapshot) => Number(c.kind === 'release-relationship' || c.kind === 'fed-relationship')
const overlaps = (a: [number, number], b: [number, number]) => a[0] < b[1] + 8 && b[0] < a[1] + 8
function intervalIndex(occupied: readonly [number, number][], start: number) {
  let lo = 0, hi = occupied.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (occupied[mid][0] < start) lo = mid + 1; else hi = mid }
  return lo
}
function intersects(occupied: readonly [number, number][], span: [number, number]) {
  const at = intervalIndex(occupied, span[0])
  return (at > 0 && overlaps(occupied[at - 1], span)) || (at < occupied.length && overlaps(occupied[at], span))
}
function insert(occupied: [number, number][], span: [number, number]) { occupied.splice(intervalIndex(occupied, span[0]), 0, span) }

/** Display priority only: never changes qualification, scores or snapshots. */
export function layoutRoofs(candidates: readonly RoofCandidate[], focused: boolean, maxRows = Infinity, selectedId?: string) {
  const ranked = [...candidates].sort((a, b) =>
    Number(b.combo.id === selectedId) - Number(a.combo.id === selectedId) || (focused ?
    pairRank(a.combo) - pairRank(b.combo) ||
    (strengthRank[b.combo.strength ?? 'weak'] - strengthRank[a.combo.strength ?? 'weak']) ||
    Number(a.combo.experimental) - Number(b.combo.experimental) || b.combo.chartAt - a.combo.chartAt || a.combo.id.localeCompare(b.combo.id) :
    a.combo.chartAt - b.combo.chartAt || a.combo.id.localeCompare(b.combo.id)))
  const lanes: [number, number][][] = []
  const positioned: PositionedRoof[] = [], overflow: ComboSnapshot[] = []
  const repetitions = new Map<string, [number, number][]>()
  for (const item of ranked) {
    const halfWidth = comboActivation(item.combo).kind === 'publication' ? 85 : 110
    // Reserve grouped-symbol clearance without repacking on pan. The label
    // stays at activation while source connectors follow symbol clusters.
    const label: [number, number] = [item.labelX - halfWidth - 18, item.labelX + halfWidth]
    const span: [number, number] = [Math.min(label[0], item.left - 52), Math.max(label[1], item.right + 36)]
    const families = [...new Set(item.combo.sources.map(s => s.family))].sort().join('|')
    const key = `${item.combo.kind}:${item.combo.decision?.state ?? 'directional'}:${item.combo.direction}:${families}`
    const repeats = repetitions.get(key) ?? []
    const repeated = focused && intersects(repeats, [item.left, item.right])
    let lane = repeated ? -1 : lanes.findIndex(occupied => !intersects(occupied, span))
    if (!repeated && lane === -1 && lanes.length < maxRows) { lane = lanes.length; lanes.push([]) }
    if (lane === -1) { overflow.push(item.combo); continue }
    insert(lanes[lane], span); positioned.push({ ...item, lane })
    if (focused) { insert(repeats, [item.left, item.right]); repetitions.set(key, repeats) }
  }
  return { positioned: positioned.sort((a, b) => a.combo.chartAt - b.combo.chartAt),
    overflow: overflow.sort((a, b) => b.chartAt - a.chartAt || a.id.localeCompare(b.id)) }
}
