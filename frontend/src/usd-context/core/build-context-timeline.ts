import { groupInspectorReleases, inspectorEventChartTime } from '../../inspector/inspector-data'
import { observedReading } from '../../inspector/scoring/shared/core/historical-release-signals'
import { combineContext } from './combine-context'
import type { ContextInput, ContextFamily, ContextTimeline, FamilyAssessment } from './contracts'
import { contextFamilyExpiry, contextVersion, enabledContextFamilies } from './policy'
import { scorePublication, publicationFamily, contextSeriesIds } from './score-publication'
import { explainUpdate } from './explanation'

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
  const assessments = valid.map(r => scorePublication(r, scoringInventory, settings))
  const updates = new Map<number, FamilyAssessment[]>()
  for (const source of assessments) updates.set(source.chartAt, [...(updates.get(source.chartAt) ?? []), source])
  const stages = [...new Set(assessments.flatMap(a => [a.chartAt, a.chartAt + contextFamilyExpiry(a.family)]))].sort((a, b) => a - b)
  const latest: Partial<Record<ContextFamily, FamilyAssessment>> = {}
  const points: ContextTimeline['points'] = []
  let lastPublication: FamilyAssessment | null = null
  for (const chartAt of stages) {
    const before = combineContext(latest, enabled, chartAt)
    const incoming = updates.get(chartAt) ?? []
    // Same-time publications resolve as one atomic snapshot.
    for (const source of incoming) { latest[source.family] = source; lastPublication = source }
    const result = combineContext(latest, enabled, chartAt)
    const names = incoming.map(s => s.sourceLabel).join(' + ')
    const update = incoming.length ? explainUpdate(names, before, result, result.members.find(m => m.family === incoming.at(-1)!.family)) :
      'An older assessment has expired; the remaining active evidence determines the context.'
    // Superseded expiry boundaries do not create artificial updates.
    if (!incoming.length && points.at(-1)?.result.members.every((m, i) => result.members[i]?.status === m.status)) continue
    points.push({ chartAt, result, latest: lastPublication, update })
  }
  return { points, enabled, version: contextVersion, excludedTiming: selected.length - valid.length }
}
