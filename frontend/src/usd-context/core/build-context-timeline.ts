import { groupInspectorReleases, inspectorEventChartTime } from '../../inspector/inspector-data'
import { observedReading } from '../../inspector/scoring/shared/core/historical-release-signals'
import { combineContext } from './combine-context'
import type { ContextInput, ContextFamily, ContextResult, ContextTimeline, FamilyAssessment } from './contracts'
import { buildContextRelationships } from '../sequences/core/build-relationships'
import type { IsmSourceMap } from '../sequences/core/contracts'
import { contextFamilyExpiry, contextVersion, enabledContextFamilies } from './policy'
import { scorePublication, publicationFamily, contextSeriesIds } from './score-publication'
import { explainUpdate } from './explanation'
import { contextDayMs } from './memory/source-retention'
import { claimsConfirmation } from './memory/claims-confirmation'
import { coherentFedSources, fedRelationshipSources, withFedRelationshipStages } from '../sequences/core/fed-relationships'

export function buildContextTimeline({ events, families, settings, asOf }: ContextInput): ContextTimeline {
  const enabled = enabledContextFamilies(families)
  const inventory = events.filter(e => observedReading(e) && e.release_at <= asOf && contextSeriesIds.includes(e.event_id))
  const all = groupInspectorReleases(inventory)
  const selected = all.filter(r => publicationFamily(r.familyId) && families.includes(r.familyId))
  const valid = selected.filter(r => !r.timingUncertain && r.releaseAt !== null && r.chartTime !== null &&
    Number.isFinite(r.chartTime) && r.events.every(e => inspectorEventChartTime(e) === r.chartTime))
    .sort((a, b) => a.releaseAt! - b.releaseAt! || a.id.localeCompare(b.id))
  // Mixing chart clock conventions cannot silently make later data appear earlier.
  for (let i = 1; i < valid.length; i++) if (valid[i].chartTime! < valid[i - 1].chartTime! ||
    (valid[i].releaseAt === valid[i - 1].releaseAt && valid[i].chartTime !== valid[i - 1].chartTime))
    throw new Error('USD history has inconsistent chart clocks; verify this broker’s stored timing.')
  const selectedIds = new Set(selected.flatMap(r => r.events.map(e => e.value_id)))
  const scoringInventory = inventory.filter(e => selectedIds.has(e.value_id))
  const recentClaims: FamilyAssessment[] = []
  const ismSources: IsmSourceMap = new Map()
  const assessments = valid.map(r => {
    const source = scorePublication(r, scoringInventory, settings, sectors => ismSources.set(r.id, sectors))
    if (source.family === 'claims') {
      source.traits = claimsConfirmation(source, recentClaims)
      recentClaims.push(source)
      if (recentClaims.length > 2) recentClaims.shift()
    }
    return source
  })
  const updates = new Map<number, FamilyAssessment[]>()
  for (const source of assessments) updates.set(source.chartAt, [...(updates.get(source.chartAt) ?? []), source])
  const boundaries = assessments.flatMap(a => [a.chartAt, a.chartAt + contextFamilyExpiry(a.family)])
  // Daily broker-calendar aging is precomputed in the worker. Hover stays a
  // binary lookup; no per-mouse-move rescoring or history scan is introduced.
  const firstBoundary = boundaries.length ? Math.min(...boundaries) : 0
  const lastBoundary = boundaries.length ? Math.max(...boundaries) : 0
  for (let day = (Math.floor(firstBoundary / contextDayMs) + 1) * contextDayMs;
    day < lastBoundary; day += contextDayMs) boundaries.push(day)
  const stages = [...new Set(boundaries)].sort((a, b) => a - b)
  const latest: Partial<Record<ContextFamily, FamilyAssessment>> = {}
  const points: ContextTimeline['points'] = []
  let lastPublication: FamilyAssessment | null = null
  const beforeByTime = new Map<number, ContextResult>()
  for (const chartAt of stages) {
    const before = combineContext(latest, enabled, chartAt - 1)
    const incoming = updates.get(chartAt) ?? []
    if (incoming.length) beforeByTime.set(chartAt, before)
    // Same-time publications resolve as one atomic snapshot.
    for (const source of incoming) { latest[source.family] = source; lastPublication = source }
    const result = combineContext(latest, enabled, chartAt)
    const names = incoming.map(s => s.sourceLabel).join(' + ')
    const expired = before.members.some(m => m.status === 'active' && result.members.find(r => r.family === m.family)?.status === 'expired')
    const update = incoming.length ? explainUpdate(names, before, result, incoming.flatMap(source =>
      result.members.filter(m => m.family === source.family))) : expired ?
      'An older assessment has expired; the remaining active evidence determines the context.' :
      'Memory update: older votes lose influence at the broker day boundary; no new release was added.'
    // Superseded expiry boundaries do not create artificial updates.
    if (!incoming.length && points.at(-1)?.result.members.every((m, i) =>
      result.members[i]?.status === m.status && result.members[i]?.contribution === m.contribution)) continue
    points.push({ chartAt, result, latest: lastPublication, update })
  }
  const fedSources = coherentFedSources(fedRelationshipSources(all), assessments)
  return { points, enabled, version: contextVersion, excludedTiming: selected.length - valid.length,
    relationships: buildContextRelationships(withFedRelationshipStages(points, fedSources), beforeByTime, ismSources, fedSources) }
}
