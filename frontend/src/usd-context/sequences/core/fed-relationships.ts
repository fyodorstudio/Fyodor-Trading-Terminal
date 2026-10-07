import { inspectorEventChartTime, type InspectorRelease } from '../../../inspector/inspector-data'
import { assessFedScore } from '../../../inspector/scoring/PAIR/EURUSD/USD/FED/assessment/fed-score'
import type { ContextPoint } from '../../core/contracts'
import type { ComboSource } from './contracts'

export function fedRelationshipSources(releases: readonly InspectorRelease[]) {
  const grouped = new Map<number, ComboSource[]>()
  for (const r of releases.filter(r => r.familyId === 'fomc' && !r.timingUncertain && r.chartTime !== null && Number.isFinite(r.chartTime) && r.releaseAt !== null && Number.isFinite(r.releaseAt) &&
    r.events.every(e => inspectorEventChartTime(e) === r.chartTime))) {
    const score = assessFedScore(r)
    if (!score) continue
    const at = r.chartTime! * 1000
    const source: ComboSource = { family: 'fed', sourceId: r.id, sourceLabel: 'Fed decision', chartAt: at, releaseAt: r.releaseAt!,
      total: null, usdDirection: score.direction === 'short' ? 'stronger' : score.direction === 'long' ? 'weaker' : 'uncomputed',
      strength: score.strength === 'weak' ? 'weak' : null, policyAction: { action: score.action, delta: score.delta, actual: score.actual },
      role: 'Numerical rate action, unweighted. Basis points are not macro magnitude points; hold and guidance add no vote.' }
    grouped.set(at, [...grouped.get(at) ?? [], source])
  }
  // An ambiguous meeting cannot silently win by iteration order.
  return new Map([...grouped].map(([at,sources]) => [at, sources.length === 1 ? sources[0] : {
    ...sources[0], sourceId: sources.map(s => s.sourceId).sort().join('|'), sourceLabel: 'Ambiguous Fed meeting',
    usdDirection: 'uncomputed' as const, strength: null,
    policyAction: { action: 'Policy content unavailable', actual: null, delta: null },
    role: 'Multiple meetings share this clock. Their numerical actions are unavailable; no earlier meeting is carried forward as the latest decision.',
  }]))
}

/** A Fed annotation cannot violate the macro timeline's known availability order. */
export function coherentFedSources(sources: ReadonlyMap<number, ComboSource>, macro: readonly { chartAt: number; releaseAt: number }[]) {
  const meetings = [...sources.values()]
  return new Map([...sources].filter(([at, source]) => [...macro, ...meetings].every(other =>
    other.releaseAt < source.releaseAt ? other.chartAt <= at : other.releaseAt > source.releaseAt ? other.chartAt >= at : other.chartAt === at)))
}

/** Extra Roof clocks never become Raycaster/Candy publication updates. */
export function withFedRelationshipStages(points: readonly ContextPoint[], sources: ReadonlyMap<number, ComboSource>) {
  const combined = [...points]
  const clocks = new Set(points.map(p => p.chartAt))
  for (const at of sources.keys()) {
    if (clocks.has(at)) continue
    let lo = 0, hi = points.length
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (points[mid].chartAt <= at) lo = mid + 1; else hi = mid }
    const point = points[lo - 1]
    if (point) combined.push({ ...point, chartAt: at })
  }
  return combined.sort((a,b) => a.chartAt - b.chartAt)
}
