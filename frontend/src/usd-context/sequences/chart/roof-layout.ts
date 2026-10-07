import type { ComboSnapshot } from '../core/contracts'

export type RoofCandidate = { combo: ComboSnapshot; left: number; right: number; ticks: number[]; hidden: number; labelX: number }
export type PositionedRoof = RoofCandidate & { lane: number }
const strengthRank = { strong: 3, moderate: 2, weak: 1 }
const overlaps = (a: [number, number], b: [number, number]) => a[0] < b[1] + 8 && b[0] < a[1] + 8

/** Display priority only: never changes qualification, scores or snapshots. */
export function layoutRoofs(candidates: readonly RoofCandidate[], focused: boolean) {
  const ranked = focused ? [...candidates].sort((a, b) =>
    (strengthRank[b.combo.strength ?? 'weak'] - strengthRank[a.combo.strength ?? 'weak']) ||
    Number(a.combo.experimental) - Number(b.combo.experimental) || b.combo.chartAt - a.combo.chartAt || a.combo.id.localeCompare(b.combo.id)) : [...candidates]
  const lanes: [number, number][][] = Array.from({ length: focused ? 2 : 3 }, () => [])
  const positioned: PositionedRoof[] = [], overflow: ComboSnapshot[] = []
  for (const item of ranked) {
    const label: [number, number] = [item.labelX - 85, item.labelX + 85]
    const span: [number, number] = focused ? [Math.min(label[0], item.left), Math.max(label[1], item.right)] : label
    const families = [...new Set(item.combo.sources.map(s => s.family))].sort().join('|')
    const repeated = focused && positioned.some(p => p.combo.kind === item.combo.kind && p.combo.direction === item.combo.direction &&
      [...new Set(p.combo.sources.map(s => s.family))].sort().join('|') === families && overlaps([p.left, p.right], [item.left, item.right]))
    const lane = repeated ? -1 : lanes.findIndex(occupied => !occupied.some(other => overlaps(span, other)))
    if (lane === -1) { overflow.push(item.combo); continue }
    lanes[lane].push(span); positioned.push({ ...item, lane })
  }
  return { positioned: positioned.sort((a, b) => a.combo.chartAt - b.combo.chartAt),
    overflow: overflow.sort((a, b) => b.chartAt - a.chartAt || a.id.localeCompare(b.id)) }
}
