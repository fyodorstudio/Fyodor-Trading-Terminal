import type { OhlcBar } from '../../../market-data/contracts/OhlcBar'
import type { ChartTimeframe } from '../../../market-data/contracts/ChartTimeframe'
import type { InspectorMarker } from '../../../inspector/inspector-data'
import type { ComboSnapshot } from '../core/contracts'
import { roofBarIndex } from './roof-geometry'
import { layoutRoofs, type RoofCandidate, type PositionedRoof } from './roof-layout'
import { clusterRoofSymbols, type RoofPublication } from './roof-symbols'

type RoofAnchor = { combo: ComboSnapshot; start: number; end: number; publications: { index: number; publication: RoofPublication }[]; hidden: number }
type PlanEntry = { left: number; right: number; roof: RoofCandidate; positioned: PositionedRoof | null }
export type RoofPlan = { entries: PlanEntry[]; prefixRight: number[] }

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
      const index = roofBarIndex(bars, source.chartAt, timeframe)
      return index === null ? [] : [{ index, publication: { source, symbol: visible.get(source.sourceId)!.symbol } }]
    })
    if (!publications.length) continue
    anchors.push({ combo, start: Math.min(...publications.map(p => p.index)), end, publications, hidden: combo.sources.length - sources.length })
  }
  return anchors
}

/** Lay out the entire eligible loaded history once per zoom/density, never per pan. */
export function createRoofPlan(anchors: readonly RoofAnchor[], spacing: number, focused: boolean): RoofPlan {
  const candidates = anchors.map(a => {
    const right = a.end * spacing, left = Math.min(a.start * spacing, right - 4)
    const points = a.publications.map(p => ({ x: p.index * spacing, publications: [p.publication], activation: false }))
    points.push({ x: right, publications: [], activation: true })
    return { combo: a.combo, left, right, endpoints: clusterRoofSymbols(points), hidden: a.hidden, labelX: (left + right) / 2 }
  })
  const layout = layoutRoofs(candidates, focused), chosen = new Map(layout.positioned.map(p => [p.combo.id, p]))
    const entries = candidates.map(roof => ({ left: Math.min(roof.left - 16, roof.labelX - 85), right: Math.max(roof.right + 36, roof.labelX + 85),
    roof, positioned: chosen.get(roof.combo.id) ?? null })).sort((a, b) => a.left - b.left || a.roof.combo.id.localeCompare(b.roof.combo.id))
  let right = -Infinity
  const prefixRight = entries.map(e => { right = Math.max(right, e.right); return right })
  return { entries, prefixRight }
}

/** Include crossing brackets even when their source/activation is outside the viewport. */
export function projectRoofPlan(plan: RoofPlan, offset: number, width: number) {
  const from = -offset, to = width - offset
  let lo = 0, hi = plan.entries.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (plan.prefixRight[mid] < from) lo = mid + 1; else hi = mid }
  const positioned: PositionedRoof[] = [], overflow: ComboSnapshot[] = []
  for (let i = lo; i < plan.entries.length && plan.entries[i].left <= to; i++) {
    const entry = plan.entries[i]
    if (entry.right < from) continue
    const p = entry.positioned
    if (p) positioned.push({ ...p, left: p.left + offset, right: p.right + offset, labelX: p.labelX + offset,
      endpoints: p.endpoints.map(e => ({ ...e, x: e.x + offset })) })
    else overflow.push(entry.roof.combo)
  }
  return { positioned: positioned.sort((a, b) => a.combo.chartAt - b.combo.chartAt),
    overflow: overflow.sort((a, b) => b.chartAt - a.chartAt || a.id.localeCompare(b.id)) }
}
