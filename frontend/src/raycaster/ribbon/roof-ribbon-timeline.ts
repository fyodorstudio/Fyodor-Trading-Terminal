import type { ContextTimeline } from '../../usd-context/core/contracts'
import { contextAt } from '../../usd-context/core/context-lookup'
import type { ComboSnapshot } from '../../usd-context/sequences/core/contracts'
import { buildRelationshipTimeline } from '../../usd-context/sequences/core/relationship-timeline'
import type { RibbonPoint } from './ribbon-timeline'

type Projection = { current: boolean; points: readonly RibbonPoint[] }
const empty: Projection = { current: false, points: [] }
const projections = new WeakMap<ContextTimeline, WeakMap<ComboSnapshot, Projection>>()

/** Selection/history identity cache also covers stale snapshots. Hover and pan
 * never rebuild the relationship or compare whole-history fingerprints. */
export function selectedRoofProjection(timeline: ContextTimeline | null, selected: ComboSnapshot | null | undefined): Projection {
  if (!timeline || !selected) return empty
  const entries = projections.get(timeline) ?? new WeakMap<ComboSnapshot, Projection>()
  const cached = entries.get(selected)
  if (cached) return cached
  const current = timeline.relationships?.episodes.find(c => c.id === selected.id)
  const matches = !!current && JSON.stringify(current) === JSON.stringify(selected)
  const projection = { current: matches, points: matches ? buildRoofRibbonTimeline(timeline, selected) : [] }
  entries.set(selected, projection); projections.set(timeline, entries)
  return projection
}

export function buildRoofRibbonTimeline(timeline: ContextTimeline, selected: ComboSnapshot): RibbonPoint[] {
  return buildRelationshipTimeline(timeline, selected).map(p => ({ at: p.at,
    label: p.label, direction: p.actionConflict ? 'conflicted' : p.support.state === 'aligned' ? p.support.direction! : p.support.state,
    evidence: p.evidence, explanation: p.explanation, update: p.update,
    kind: p.kind === 'aging' ? 'memory' : p.kind, usd: contextAt(timeline, p.at), eur: null, relationship: p }))
}
