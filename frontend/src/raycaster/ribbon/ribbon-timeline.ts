import type { ContextPoint, ContextTimeline, Evidence } from '../../usd-context/core/contracts'
import type { EurContextPoint, EurContextTimeline } from '../../pair-context/core/contracts'
import { relativeContext } from '../../pair-context/core/relative-context'
import { contextResultLabel } from '../../usd-context/core/usd-pair'

export type RibbonPoint = { at: number; label: string; direction: 'long' | 'short' | 'mixed' | 'insufficient' | 'uncomputed'; evidence: Evidence | null;
  explanation: string; update: string; kind: 'publication' | 'memory' | 'expiry'; usd: ContextPoint | null; eur: EurContextPoint | null }

/** Merge both clocks once, including atomic simultaneous publications. Pointer movement never scores. */
export function buildRibbonTimeline(usd: ContextTimeline | null, eur: EurContextTimeline | null, relative: boolean, symbol: string): RibbonPoint[] {
  const points: RibbonPoint[] = [], us = usd?.points ?? [], eu = relative ? eur?.points ?? [] : []
  let i = 0, j = 0, u: ContextPoint | null = null, e: EurContextPoint | null = null
  while (i < us.length || j < eu.length) {
    const at = Math.min(us[i]?.chartAt ?? Infinity, eu[j]?.chartAt ?? Infinity)
    const previousUsd = u, previousEur = e
    let newUsd = false, newEur = false
    if (us[i]?.chartAt === at) { u = us[i++]; newUsd = true }
    if (eu[j]?.chartAt === at) { e = eu[j++]; newEur = true }
    const pair = relative ? relativeContext(e, u) : null
    const label = pair?.label ?? contextResultLabel(symbol, u?.result)
    const direction: RibbonPoint['direction'] = (pair?.direction ?? (label === 'Mixed evidence' ? 'mixed' : label === 'Insufficient context' ? 'insufficient' :
      label.endsWith(' Long') ? 'long' : label.endsWith(' Short') ? 'short' : 'uncomputed')) as RibbonPoint['direction']
    const update = [newUsd ? u?.update : null, newEur ? `EUR: ${e?.update}` : null].filter(Boolean).join(' · ')
    const publication = (newUsd && u?.latest?.chartAt === at) ||
      (newEur && (e?.updateKind === 'publication' || (!e?.updateKind && e?.members.some(m => m.chartAt === at))))
    const expired = (newUsd && previousUsd?.result.members.some(m => m.status === 'active' && u?.result.members.find(n => n.family === m.family)?.status === 'expired')) ||
      (newEur && previousEur?.members.some(m => m.status === 'active' && e?.members.find(n => n.slot === m.slot)?.status === 'expired'))
    points.push({ at, label, direction, evidence: (pair?.strength ?? (relative ? null : u?.result.strength ?? null)) as Evidence | null,
      explanation: pair?.explanation ?? u?.result.explanation ?? 'No usable context.', update,
      kind: publication ? 'publication' : expired ? 'expiry' : 'memory', usd: u, eur: e })
  }
  return points
}

export function ribbonIndex(points: readonly RibbonPoint[], at: number) {
  let lo = 0, hi = points.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (points[mid].at <= at) lo = mid + 1; else hi = mid }
  return lo - 1
}
export type RibbonInterval = { from: number; to: number; point: RibbonPoint | null }
export function visibleRibbonIntervals(points: readonly RibbonPoint[], from: number, to: number): RibbonInterval[] {
  if (to <= from) return []
  const intervals: RibbonInterval[] = []
  let i = ribbonIndex(points, from), start = from
  while (start < to) {
    const end = Math.min(points[i + 1]?.at ?? to, to)
    if (end > start) intervals.push({ from: start, to: end, point: points[i] ?? null })
    start = end; i++
  }
  return intervals
}
