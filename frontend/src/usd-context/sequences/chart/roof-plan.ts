import type { OhlcBar } from '../../../market-data/contracts/OhlcBar'
import type { ChartTimeframe } from '../../../market-data/contracts/ChartTimeframe'
import type { InspectorMarker } from '../../../inspector/inspector-data'
import type { ComboSnapshot } from '../core/contracts'
import { roofBarIndex } from './roof-geometry'
import { layoutRoofs, type RoofCandidate, type PositionedRoof } from './roof-layout'
import { clusterRoofEndpoints, type RoofPublication, type RoofEndpoint } from './roof-symbols'

type RoofAnchor = { combo: ComboSnapshot; start: number; end: number; publications: { index: number; publication: RoofPublication }[]; hidden: number }
type PlanEntry = { column: number; roof: RoofCandidate }
export type RoofPlan = { entries: PlanEntry[]; focused: boolean; maxRows: number; selectedId?: string }
export type RoofOverflowColumn = { column: number; x: number; lane: number; combos: ComboSnapshot[] }
export const roofOverflowWidth = 64
export const roofOverflowRowHeight = 22

export function knownRoofCount(episodes: readonly ComboSnapshot[], now: number) {
  let lo = 0, hi = episodes.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (episodes[mid].chartAt <= now) lo = mid + 1; else hi = mid }
  return lo
}

/** Time/filter indexing is independent of the viewport and OHLC price updates. */
export function prepareRoofAnchors(episodes: readonly ComboSnapshot[], bars: readonly Pick<OhlcBar, 'time'>[], timeframe: ChartTimeframe,
  markers: readonly InspectorMarker[], experimental: boolean, count: number) {
  const visible = new Map(markers.flatMap(m => [m.release.id, ...(m.release.ismPublications?.map(r => r.id) ?? [])].map(id => [id, m] as const)))
  const anchors: RoofAnchor[] = []
  for (let i = 0; i < count; i++) {
    const combo = episodes[i]
    if ((combo.experimental && !experimental) || combo.sources.some(s => s.chartAt > combo.chartAt)) continue
    const end = roofBarIndex(bars, combo.chartAt, timeframe)
    if (end === null) continue
    const sources = combo.sources.filter(s => visible.has(s.sourceId))
    const publications = sources.flatMap(source => {
      const marker = visible.get(source.sourceId)!
      // Monthly ISM symbols stay at Manufacturing even when representing
      // Services. Include that real anchor before packing and viewport culling.
      const index = roofBarIndex(bars, Number.isFinite(marker.time) ? marker.time * 1000 : source.chartAt, timeframe)
      return index === null ? [] : [{ index, publication: { source, symbol: visible.get(source.sourceId)!.symbol } }]
    })
    if (!publications.length) continue
    anchors.push({ combo, start: Math.min(...publications.map(p => p.index)), end, publications, hidden: combo.sources.length - sources.length })
  }
  return anchors
}

/** Cache source geometry once per zoom. Row allocation uses only visible clocks. */
export function createRoofPlan(anchors: readonly RoofAnchor[], spacing: number, focused: boolean, maxRows = Infinity, selectedId?: string): RoofPlan {
  const candidates = anchors.map(a => {
    const right = a.end * spacing, left = Math.min(a.start * spacing, right - 4)
    const points: RoofEndpoint[] = a.publications.map(p => ({ x: p.index * spacing, publications: [p.publication], activation: false }))
    const incoming = a.publications.filter(p => p.publication.source.chartAt === a.combo.chartAt)
    points.push({ x: right, publications: incoming.map(p => p.publication), activation: true,
      symbolX: incoming.length ? Math.min(...incoming.map(p => p.index * spacing)) : undefined })
    return { combo: a.combo, left, right, endpoints: clusterRoofEndpoints(points), hidden: a.hidden, labelX: right }
  })
  const entries = candidates.map((roof, i) => ({ column: anchors[i].end, roof }))
    .sort((a, b) => a.roof.labelX - b.roof.labelX || a.roof.combo.id.localeCompare(b.roof.combo.id))
  return { entries, focused, maxRows, selectedId }
}

/** An offscreen activation neither consumes a row nor contributes to local More. */
export function projectRoofPlan(plan: RoofPlan, offset: number, width: number,
  previousLanes: ReadonlyMap<string, number> = new Map(), maxRows = plan.maxRows) {
  const from = -offset, to = width - offset
  let lo = 0, hi = plan.entries.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (plan.entries[mid].roof.labelX < from) lo = mid + 1; else hi = mid }
  const visible: PlanEntry[] = []
  for (let i = lo; i < plan.entries.length && plan.entries[i].roof.labelX <= to; i++) visible.push(plan.entries[i])
  const layout = layoutRoofs(visible.map(e => e.roof), plan.focused, maxRows, plan.selectedId, previousLanes)
  const hidden = new Set(layout.overflow.map(c => c.id)), columns = new Map<number, RoofOverflowColumn>()
  for (const { column, roof } of visible) {
    if (!hidden.has(roof.combo.id)) continue
    let group = columns.get(column)
    if (!group) { group = { column, x: roof.labelX + offset, lane: 0, combos: [] }; columns.set(column, group) }
    group.combos.push(roof.combo)
  }
  const overflowColumns = [...columns.values()], ends: number[] = []
  for (const group of overflowColumns) {
    group.combos.sort((a, b) => b.chartAt - a.chartAt || a.id.localeCompare(b.id))
    let lane = ends.findIndex(end => group.x - roofOverflowWidth / 2 >= end + 4)
    if (lane < 0) { lane = ends.length; ends.push(-Infinity) }
    group.lane = lane; ends[lane] = group.x + roofOverflowWidth / 2
  }
  const positioned: PositionedRoof[] = layout.positioned.map(p => ({ ...p, left: p.left + offset, right: p.right + offset, labelX: p.labelX + offset,
    endpoints: p.endpoints.map(e => ({ ...e, x: e.x + offset, symbolX: e.symbolX === undefined ? undefined : e.symbolX + offset })) }))
  return { positioned, overflow: layout.overflow, overflowColumns, footerHeight: Math.max(1, ends.length) * roofOverflowRowHeight }
}
