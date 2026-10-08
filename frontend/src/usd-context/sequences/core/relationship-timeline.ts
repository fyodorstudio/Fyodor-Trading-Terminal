import type { ContextTimeline } from '../../core/contracts'
import { contextAt } from '../../core/context-lookup'
import type { ComboSnapshot, ComboSource } from './contracts'
import { lookupFreshNews } from './fresh-news'
import { roofSupport, relationshipSupport, supportLabel, relationshipResultLabel, type RelationshipSupport } from './relationship-support'
import { relationshipReading } from '../../core/support-reading'
import { comboActivation } from './combo-activation'

export type RelationshipPoint = { at: number; snapshot: ComboSnapshot; support: RelationshipSupport; label: string;
  explanation: string; evidence: 'weak' | 'moderate' | 'strong' | null; kind: 'publication' | 'aging' | 'expiry'; update: string; actionConflict: boolean }

/** Fixed selected relationship scope, latest known observations. No new votes/scoring.
 * Construct once per selection/history; pointer/viewport lookup is binary. */
export function buildRelationshipTimeline(timeline: ContextTimeline, selected: ComboSnapshot): RelationshipPoint[] {
  const relationships = timeline.relationships
  if (!relationships) return []
  const fresh = selected.kind === 'fresh-news', policy = selected.kind === 'labor-inflation' || selected.kind === 'weekly-labor'
  const families = [...new Set(selected.sources.filter(s => !fresh || s.comparable && s.change !== undefined && s.change !== 0).map(s => s.family))]
  const sectors = new Map(relationships.ismSources?.map(s => [s.sourceId, s.sources]) ?? [])
  const fed = [...(relationships.fedSources ?? [])].sort((a, b) => a.chartAt - b.chartAt)
  const lastTime = timeline.points.at(-1)?.chartAt ?? selected.chartAt
  const times = new Set([selected.chartAt, ...timeline.points.filter(p => p.chartAt >= selected.chartAt).map(p => p.chartAt)])
  const expiryTimes = new Set<number>()
  if (fresh) for (const point of relationships.fresh) for (const source of point.members) {
    if (!families.includes(source.family)) continue
    // Each sector's seven-day boundary is independent of the other sector.
    for (const input of source.participants ?? [source]) {
      const expiry = input.chartAt + 7 * 86400000
      if (expiry > selected.chartAt && expiry <= lastTime) { times.add(expiry); expiryTimes.add(expiry) }
    }
  }
  for (const action of fed) if (families.includes('fed')) {
    if (action.chartAt >= selected.chartAt && action.chartAt <= lastTime) times.add(action.chartAt)
    const expiry = action.chartAt + 45 * 86400000
    if (expiry > selected.chartAt && expiry <= lastTime) { times.add(expiry); expiryTimes.add(expiry) }
  }
  const points: RelationshipPoint[] = []
  for (const at of [...times].sort((a, b) => a - b)) {
    const context = contextAt(timeline, at)
    if (!context) continue
    const flow = fresh ? lookupFreshNews(relationships.fresh, at) : null
    const action = latestAction(fed, at)
    let sources: ComboSource[] = fresh ? flow?.members.filter(s => families.includes(s.family)) ?? [] :
      policy ? context.result.members.filter(s => s.status === 'active') : context.result.members.filter(s => families.includes(s.family))
    if (selected.kind === 'ism-sectors') {
      const ism = context.result.members.find(m => m.family === 'ism')
      sources = ism ? (sectors.get(ism.sourceId) ?? []).map(s => ({ ...s, status: ism.status,
        contribution: (s.contribution ?? 0) * (ism.memory?.retention ?? 1) })) : []
    }
    if (families.includes('fed') && action) sources = [...sources, action]
    const snapshot: ComboSnapshot = at === selected.chartAt ? selected : { ...selected,
      id: `${selected.id}/follow/${at}`, chartAt: at, sources, before: context.result, after: context.result,
      catalogue: { enabled: timeline.enabled, fresh: flow?.members ?? [], fed: action }, activation: { kind: 'aging', removed: [] } }
    const support = at === selected.chartAt ? roofSupport(selected) : selected.kind === 'ism-sectors' ?
      sectorSupport(snapshot) : policy ? roofSupport(snapshot) :
        // Supplying the fixed family selection exposes expiry/missing inputs
        // rather than silently changing the relationship to a surviving subset.
        relationshipSupport(snapshot, families, fresh ? 'fresh' : 'release')
    const expectedPolicy = selected.kind === 'labor-inflation' ? 'labor-priority' : 'weekly-labor-priority'
    if (at !== selected.chartAt && policy && context.result.policy?.mode !== expectedPolicy)
      unavailable(support, 'This priority rule is inactive')
    if (at !== selected.chartAt && families.includes('fed') && !action) unavailable(support, 'Fed action is unavailable or expired')
    const kind = at === selected.chartAt ? comboActivation(selected).kind : expiryTimes.has(at) ? 'expiry' : updateKind(policy ? context.result.members : sources, points.at(-1), at)
    const evidence = !support.direction ? null : support.narrow || support.qualified || fresh ? 'weak' :
      at === selected.chartAt ? selected.strength ?? 'moderate' : policy ? context.result.strength ?? 'moderate' :
      selected.kind === 'ism-sectors' ? context.result.members.find(m => m.family === 'ism')?.strength ?? 'moderate' :
      support.sources.some(s => s.strength === 'weak') ? 'weak' : 'moderate'
    const label = at === selected.chartAt ? selected.kind === 'fed-relationship' ? relationshipResultLabel(selected) : supportLabel(support) :
      families.includes('fed') ? action ? relationshipResultLabel(snapshot, families) : `Fed unavailable · ${supportLabel(support)}` : supportLabel(support)
    const currentAction = at === selected.chartAt ? selected.sources.find(s => s.family === 'fed') : action
    const actionConflict = !!support.direction && !!currentAction && ((currentAction.usdDirection === 'stronger' && support.direction === 'long') ||
      (currentAction.usdDirection === 'weaker' && support.direction === 'short'))
    const update = at === selected.chartAt ? 'Selected roof becomes available. Earlier connecting lines identify its source releases.' :
      kind === 'publication' ? `${(policy ? context.result.members : sources).filter(s => s.chartAt === at).map(s => s.sourceLabel).join(' + ')} updates this relationship.` :
      kind === 'expiry' ? 'A selected input expired. The remaining evidence is shown without replacing the missing input.' :
        'Existing inputs aged or the priority rule changed. No new participating publication.'
    // The synthetic inspection/audit carries its displayed direction and grade.
    const captured = at === selected.chartAt ? selected : { ...snapshot,
      direction: support.direction === 'long' ? 'weaker' as const : support.direction === 'short' ? 'stronger' as const : 'uncomputed' as const,
      strength: evidence, activation: { kind, removed: [] } }
    const point = { at, snapshot: captured, support, label, explanation: relationshipReading(support), evidence, kind, update, actionConflict }
    const previous = points.at(-1)
    if (!previous || fingerprint(point) !== fingerprint(previous)) points.push(point)
  }
  return points
}

function sectorSupport(snapshot: ComboSnapshot) {
  const support = roofSupport(snapshot)
  if (snapshot.sources.filter(s => s.sector && s.status === 'active').length !== 2) unavailable(support, 'An ISM sector is unavailable or expired')
  return support
}
function unavailable(s: RelationshipSupport, reason: string) { s.state = 'insufficient'; s.direction = null; s.qualified = true; s.missing.push(reason) }
function latestAction(sources: ComboSource[], at: number) {
  let lo = 0, hi = sources.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (sources[mid].chartAt <= at) lo = mid + 1; else hi = mid }
  const action = sources[lo - 1]
  return action && at - action.chartAt < 45 * 86400000 ? action : null
}
function updateKind(sources: ComboSource[], previous: RelationshipPoint | undefined, at: number): RelationshipPoint['kind'] {
  if (sources.some(s => s.chartAt === at)) return 'publication'
  if (previous?.support.sources.some(s => !sources.some(now => now.sourceId === s.sourceId && now.status !== 'expired' && now.status !== 'unavailable')) ||
      previous?.support.state !== 'insufficient' && sources.some(s => s.status === 'expired')) return 'expiry'
  return 'aging'
}
function fingerprint(p: RelationshipPoint) {
  return JSON.stringify([p.label, p.evidence, p.support.long, p.support.short, p.support.qualified, p.support.missing, p.actionConflict,
    p.support.sources.map(s => [s.sourceId, s.chartAt]),
    p.snapshot.kind === 'labor-inflation' || p.snapshot.kind === 'weekly-labor' ? p.snapshot.after.policy?.mode : null])
}
