import type { ContextFamily, ContextPoint, ContextResult } from '../context/usd/contracts'
import type { ComboSnapshot, ComboSource, ContextRelationships, FreshChange, IsmSourceMap } from './contracts'
import { describeComboActivation } from './combo-activation'
import { freshNewsAt, updateFreshNews } from './fresh-news'
import { createIsmFreshMemory, updateIsmFresh } from './ism-fresh'
import { relationshipDomain, relationshipPairs } from './relationship-registry'
import { relationshipSupport } from './relationship-support'

/** Derive explanations from already-calculated snapshots; never rescore prices or releases. */
export function buildContextRelationships(points: readonly ContextPoint[], beforeByTime: ReadonlyMap<number, ContextResult>,
  ismSources: IsmSourceMap, fedSources: ReadonlyMap<number, ComboSource> = new Map()): ContextRelationships {
  const episodes: ComboSnapshot[] = [], fresh: ContextRelationships['fresh'] = []
  const latestFresh = new Map<ContextFamily, FreshChange>(), seen = new Map<string, string>()
  const claims: ComboSource[] = []
  const ismFresh = createIsmFreshMemory()
  const fedHistory = [...fedSources].sort((a, b) => a[0] - b[0])
  let fedIndex = 0
  let latestFed: ComboSource | null = null
  for (let index = 0; index < points.length; index++) {
    const point = points[index]
    const before = beforeByTime.get(point.chartAt) ?? null
    if (before) {
      updateFreshNews(latestFresh, before, point.result, point.chartAt)
      const ism = point.result.members.find(m => m.family === 'ism' && m.chartAt === point.chartAt)
      const sectors = ism && ismSources.get(ism.sourceId)
      if (ism && sectors) {
        const change = updateIsmFresh(ismFresh, sectors, ism, before.members.find(m => m.family === 'ism'), point.chartAt)
        if (change) latestFresh.set('ism', change)
      }
      const claim = point.result.members.find(m => m.family === 'claims' && m.chartAt === point.chartAt)
      if (claim) { claims.push(claim); if (claims.length > 3) claims.shift() }
    }
    const flow = freshNewsAt(latestFresh, point.chartAt)
    const fed = fedSources.get(point.chartAt)
    while (fedIndex < fedHistory.length && fedHistory[fedIndex][0] <= point.chartAt) latestFed = fedHistory[fedIndex++][1]
    const catalogue = { enabled: [...new Set([...point.result.members.map(m => m.family), ...point.result.missing])],
      fresh: flow.members, fed: latestFed && point.chartAt - latestFed.chartAt < 45 * 86400000 ? latestFed : null }
    const previousFresh = fresh.at(-1)
    fresh.push(flow)
    const add = (kind: ComboSnapshot['kind'], title: string, sources: ComboSource[], explanation: string,
      direction = point.result.direction, strength = point.result.strength, experimental = false, decision: ComboSnapshot['decision'] | null = point.result.decision) => {
      if (sources.length < 2 || sources.some(s => s.chartAt > point.chartAt)) return
      const signature = sources.map(s => s.sourceId).join('|')
      if (seen.get(kind) === signature) return
      seen.set(kind, signature)
      episodes.push({ id: `${kind}/${point.chartAt}/${signature}`, kind, title, chartAt: point.chartAt,
        activation: describeComboActivation(kind, sources, point.chartAt, previousFresh, points[index - 1]?.result, point.result),
        sources, before: before ?? points[index - 1]?.result ?? null, after: point.result,
        direction, strength, explanation, experimental, catalogue, decision: decision ?? undefined, checks: kind === 'labor-inflation' || kind === 'weekly-labor' ? point.result.policy?.checks ?? [] : [] })
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
      'Both sector publications are known. Their original weighted components resolve one ISM vote; the sector readings are not added again to Raycaster.', ism!.usdDirection, ism!.strength, false,
      null)
    const freshDomains = new Set(flow.members.filter(m => m.comparable && m.change !== 0).map(m => relationshipDomain(m.family)))
    if (freshDomains.size >= 2 && flow.total !== null) add('fresh-news', 'Fresh-news sequence', flow.members,
      'Comparable changes across economic domains within seven days. Roof v4 exposes the weighted lead or exact balance; the legacy accumulated-context direction gate remains separate. Calibration, renewal and availability effects do not vote.',
      flow.direction, flow.total !== 0 ? 'weak' : null, true, flow.decision)
    else seen.delete('fresh-news')
    // Pair annotations are publication snapshots, not independent votes. Missing
    // pairs and arbitrary larger subsets remain inspectable in the catalogue.
    if (before || fed) for (const pair of relationshipPairs) {
      const sources = pair.families.flatMap<ComboSource>(f => f === 'fed' ? catalogue.fed ? [catalogue.fed] : [] :
        point.result.members.filter(m => m.family === f && m.status === 'active'))
      if (sources.length !== 2 || !sources.some(s => s.chartAt === point.chartAt)) continue
      const kind = pair.families.includes('fed') ? 'fed-relationship' : 'release-relationship'
      const combo: ComboSnapshot = { id: `${kind}/${pair.id}/${point.chartAt}/${sources.map(s => s.sourceId).join('|')}`,
        kind, title: pair.label, chartAt: point.chartAt, sources, activation: describeComboActivation(kind, sources, point.chartAt, previousFresh, points[index - 1]?.result, point.result), before: before ?? points[index - 1]?.result ?? null, after: point.result, catalogue,
        direction: 'uncomputed', strength: null, explanation: 'Available standalone interpretations at their retained base family weights. This annotation adds no context vote.',
        checks: [], experimental: false }
      const support = relationshipSupport(combo)
      combo.direction = support.direction === 'short' ? 'stronger' : support.direction === 'long' ? 'weaker' : 'uncomputed'
      combo.strength = support.direction && support.state !== 'insufficient' ? support.narrow || support.qualified || sources.some(s => s.strength === 'weak') ? 'weak' : 'moderate' : null
      episodes.push(combo)
    }
  }
  return { episodes: episodes.sort((a,b) => a.chartAt - b.chartAt || a.id.localeCompare(b.id)), fresh,
    ismSources: [...ismSources].map(([sourceId, sources]) => ({ sourceId, sources })), fedSources: fedHistory.map(([, source]) => source) }
}
