import type { ComboSnapshot, ComboSource, RelationshipFamily } from './contracts'
import { contextWeights } from '../../core/policy'
import { relationshipName } from './relationship-registry'

export type RelationshipMode = 'release' | 'fresh'
export type RelationshipSupport = { state: 'aligned' | 'conflicted' | 'balanced' | 'unchanged' | 'insufficient';
  direction: 'long' | 'short' | null; long: number; short: number; net: number; separation: number;
  leaders: string[]; missing: string[]; narrow: boolean; qualified: boolean; sources: ComboSource[] }

/** No extra vote or missing-weight redistribution. Fed rates remain unweighted context. */
export function relationshipSupport(combo: ComboSnapshot, requested?: readonly RelationshipFamily[], mode: RelationshipMode = 'release', policyWeights = false): RelationshipSupport {
  const fresh = mode === 'fresh' || combo.kind === 'fresh-news'
  const selected = requested ? [...new Set(requested)] : [...new Set(combo.sources.filter(s => s.family !== 'fed' &&
    (!fresh || s.change !== 0 && s.change !== undefined)).map(s => s.family))]
  const input: readonly ComboSource[] = requested ? mode === 'fresh' ? combo.catalogue?.fresh ?? [] : combo.after.members : combo.sources
  const sources = input.filter(s => selected.includes(s.family) && s.family !== 'fed')
  const missing: string[] = [], usable: { source: ComboSource; vote: number }[] = []
  for (const family of selected.filter(f => f !== 'fed')) {
    const members = sources.filter(s => s.family === family)
    const available = members.filter(s => Number.isFinite(s.chartAt) && s.chartAt <= combo.chartAt &&
      (mode === 'fresh' ? s.comparable && s.change !== undefined && combo.chartAt - s.chartAt < 7 * 86400000 :
        s.status !== 'expired' && s.status !== 'unavailable' && s.total !== null && Number.isFinite(s.total)))
    if (!available.length) missing.push(relationshipName(family))
    for (const source of available) {
      const vote = mode === 'fresh' || (!requested && combo.kind === 'fresh-news') ? source.change : policyWeights ? source.contribution :
        source.sector ? source.contribution ?? source.total! * (source.sector === 'services' ? .7 : .3) :
          source.total! * contextWeights[family as keyof typeof contextWeights] / 100 *
          (source.memory?.retention ?? 1)
      if (vote === undefined || !Number.isFinite(vote)) { missing.push(source.sourceLabel); continue }
      usable.push({ source, vote })
    }
  }
  const clean = (n: number) => Math.round(n * 1e12) / 1e12
  const long = clean(usable.reduce((sum, x) => sum + Math.max(0, -x.vote), 0))
  const short = clean(usable.reduce((sum, x) => sum + Math.max(0, x.vote), 0))
  const net = clean(short - long), gross = short + long, separation = gross ? Math.abs(net) / gross : 0
  const direction = net > 0 ? 'short' : net < 0 ? 'long' : null
  const state = missing.length || !usable.length ? 'insufficient' : !gross ? 'unchanged' : net === 0 ? 'balanced' :
    long > 0 && short > 0 ? 'conflicted' : 'aligned'
  const leaders = usable.filter(x => Math.sign(x.vote) === Math.sign(net) && x.vote !== 0)
    .sort((a, b) => Math.abs(b.vote) - Math.abs(a.vote)).map(x => x.source.sourceLabel)
  return { state, direction: state === 'insufficient' ? null : direction, long, short, net, separation, leaders, missing: [...new Set(missing)],
    narrow: state === 'conflicted' && separation < 1 / 3,
    qualified: missing.length > 0 || usable.some(x => (x.source.coverage ?? 1) < 1), sources: usable.map(x => x.source) }
}

export function supportLabel(s: RelationshipSupport) {
  const side = s.direction === 'long' ? 'Long' : 'Short'
  return s.state === 'insufficient' ? 'Insufficient evidence' : s.state === 'unchanged' ? 'Unchanged · No lead' :
    s.state === 'balanced' ? 'Balanced conflict · No lead' : s.state === 'conflicted' ? `Conflicted · ${side} leads` : `Aligned · ${side}`
}

export function roofSupport(combo: ComboSnapshot) {
  if (combo.kind === 'labor-inflation' || combo.kind === 'weekly-labor') {
    const support = relationshipSupport(combo, combo.after.members.filter(s => s.status === 'active').map(s => s.family), 'release', true)
    support.qualified ||= combo.after.missing.length > 0 || combo.after.members.some(s => s.status !== 'active')
    return support
  }
  return relationshipSupport(combo, undefined, combo.kind === 'fresh-news' ? 'fresh' : 'release')
}

export function roofResultLabel(combo: ComboSnapshot) {
  if (combo.kind === 'labor-inflation' || combo.kind === 'weekly-labor') return supportLabel(roofSupport(combo))
  return relationshipResultLabel(combo, undefined, combo.kind === 'fresh-news' ? 'fresh' : 'release')
}

/** A rate action is named alongside macro support, never converted into magnitude points. */
export function relationshipResultLabel(combo: ComboSnapshot, requested?: readonly RelationshipFamily[], mode: RelationshipMode = 'release') {
  const support = relationshipSupport(combo, requested, mode)
  const includeFed = requested ? requested.includes('fed') : combo.sources.some(s => s.family === 'fed')
  if (!includeFed) return supportLabel(support)
  const fed = requested ? combo.catalogue?.fed : combo.sources.find(s => s.family === 'fed')
  if (!fed?.policyAction || fed.chartAt > combo.chartAt) return `Fed unavailable · ${supportLabel(support)}`
  const action = fed.policyAction.action
  const opposed = support.direction && ((fed.usdDirection === 'stronger' && support.direction === 'long') ||
    (fed.usdDirection === 'weaker' && support.direction === 'short'))
  return opposed ? `Conflicted · ${support.direction === 'long' ? 'Long' : 'Short'} leads in macro evidence · ${action}` :
    `${action} · ${supportLabel(support)}`
}

export function relationshipAvailability(combo: ComboSnapshot, family: RelationshipFamily, mode: RelationshipMode) {
  if (family === 'fed') return combo.catalogue?.fed ? mode === 'fresh' ? 'Rate action only; no comparable macro score change' :
    `${combo.catalogue.fed.policyAction?.action ?? 'Policy unavailable'}; unweighted` : 'No eligible Fed meeting within 45 days'
  if (combo.catalogue && !combo.catalogue.enabled.includes(family)) return 'Input disabled'
  const member = combo.after.members.find(s => s.family === family)
  if (!member) return 'No preceding publication available'
  if (member.chartAt > combo.chartAt) return 'Publication not yet available'
  if (member.status === 'expired') return 'Preceding publication expired'
  if (member.status === 'unavailable' || member.total === null) return 'Standalone evidence unavailable'
  if (mode === 'fresh') {
    const fresh = combo.catalogue?.fresh.find(s => s.family === family)
    if (!fresh || combo.chartAt - fresh.chartAt >= 7 * 86400000) return 'No support change within seven days'
    if (!fresh.comparable) return fresh.role ?? 'No comparable predecessor'
    return fresh.change === 0 ? 'Comparable; unchanged support' : 'Comparable support change available'
  }
  return (member.coverage ?? 1) < 1 ? 'Available; partial standalone evidence' : 'Available'
}
