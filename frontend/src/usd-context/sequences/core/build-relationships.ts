import type { ContextFamily, ContextPoint, ContextResult } from '../../core/contracts'
import type { ComboSnapshot, ComboSource, ContextRelationships, FreshChange, IsmSourceMap } from './contracts'
import { freshNewsAt, updateFreshNews } from './fresh-news'

/** Derive explanations from already-calculated snapshots; never rescore prices or releases. */
export function buildContextRelationships(points: readonly ContextPoint[], beforeByTime: ReadonlyMap<number, ContextResult>,
  ismSources: IsmSourceMap): ContextRelationships {
  const episodes: ComboSnapshot[] = [], fresh: ContextRelationships['fresh'] = []
  const latestFresh = new Map<ContextFamily, FreshChange>(), seen = new Map<string, string>()
  const claims: ComboSource[] = []
  for (let index = 0; index < points.length; index++) {
    const point = points[index]
    const before = beforeByTime.get(point.chartAt) ?? null
    if (before) {
      updateFreshNews(latestFresh, before, point.result, point.chartAt)
      const claim = point.result.members.find(m => m.family === 'claims' && m.chartAt === point.chartAt)
      if (claim) { claims.push(claim); if (claims.length > 3) claims.shift() }
    }
    const flow = freshNewsAt(latestFresh, point.chartAt)
    fresh.push(flow)
    const add = (kind: ComboSnapshot['kind'], title: string, sources: ComboSource[], explanation: string,
      direction = point.result.direction, strength = point.result.strength, experimental = false) => {
      if (sources.length < 2 || sources.some(s => s.chartAt > point.chartAt)) return
      const signature = sources.map(s => s.sourceId).join('|')
      if (seen.get(kind) === signature) return
      seen.set(kind, signature)
      episodes.push({ id: `${kind}/${point.chartAt}/${signature}`, kind, title, chartAt: point.chartAt,
        sources, before: before ?? points[index - 1]?.result ?? null, after: point.result,
        direction, strength, explanation, experimental, checks: kind === 'labor-inflation' || kind === 'weekly-labor' ? point.result.policy?.checks ?? [] : [] })
    }
    const active = point.result.members.filter(m => m.status === 'active')
    const policy = point.result.policy
    if (policy?.mode === 'labor-priority') add('labor-inflation', 'Labor + inflation priority',
      active.filter(m => ['nfp', 'cpi', 'pce', 'ppi'].includes(m.family)), policy.reason)
    else seen.delete('labor-inflation')
    if (policy?.mode === 'weekly-labor-priority') add('weekly-labor', 'Claims challenge older NFP',
      [...active.filter(m => m.family === 'nfp'), ...claims.map((m, i) => ({ ...m,
        role: i < claims.length - 1 ? 'Confirmation only; no extra vote' : 'Latest Claims vote' }))], policy.reason)
    else seen.delete('weekly-labor')
    const ism = active.find(m => m.family === 'ism' && m.chartAt === point.chartAt)
    const sectors = ism && ismSources.get(ism.sourceId)
    if (sectors?.length === 2) add('ism-sectors', 'Manufacturing + Services', sectors,
      'Both sector publications are known. Their original weighted components resolve one ISM vote; the sector readings are not added again to Raycaster.', ism!.usdDirection, ism!.strength)
    if (flow.agreeingDomains >= 2 && flow.direction !== 'uncomputed') add('fresh-news', 'Fresh-news sequence', flow.members,
      flow.explanation, flow.direction, 'weak', true)
    else seen.delete('fresh-news')
  }
  return { episodes, fresh }
}
