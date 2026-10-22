import type { EconomicCalendarEvent } from '../../economic-calendar/contracts/calendar-event'
import type { InspectorRelease } from '../../economic-calendar/releases/release'
import { inspectorFamilyById, inspectorFamilyForEvent, inspectorCategories } from '../catalog/inspector-families'
import { groupPolicyEpisodes, isPolicyRateDecision, policyEpisodeRule, policyEpisodeRules } from '../episodes/policy-episodes'
import { groupFrenchCpiReleases } from './french-cpi-release'

function releaseLabel(event: EconomicCalendarEvent, familyId: string): string | null {
  if (inspectorFamilyById.get(familyId)?.sourceLabels) return event.name || `MT5 event ${event.event_id}`
  const policy = policyEpisodeRule(familyId)
  if (policy) return isPolicyRateDecision(event, familyId) ? policy.label : event.name
  if (familyId === 'fed-chair' || familyId === 'ecb-president' || familyId === 'boe-governor' || familyId.endsWith('-speakers')) return event.name
  if (familyId === 'euro-labor') return event.event_id === '999030020' ? 'Euro-area unemployment' : 'Euro-area employment'
  return null
}
export type InspectorEvent = EconomicCalendarEvent & { chart_time_seconds?: number | null; chart_clock_profile?: string | null }
export function isPublishedTentative(event: InspectorEvent, requireChartTime = false) {
  return event.time_mode === 3 && event.actual !== null && Number.isFinite(event.actual) &&
    (!requireChartTime || event.release_at !== null && Number.isFinite(event.release_at) && event.chart_time_seconds !== null) &&
    event.server_time_seconds % 86400 !== 0
}
export function inspectorEventChartTime(event: InspectorEvent): number | null {
  if (event.time_mode !== 0 && !isPublishedTentative(event) && event.server_time_seconds > 0)
    return event.chart_clock_profile === null ? null : Math.floor(event.server_time_seconds / 86400) * 86400
  return event.chart_time_seconds === undefined ? event.release_at === null ? null : event.release_at / 1000 : event.chart_time_seconds
}

export function isInspectorCommentary(event: EconomicCalendarEvent): boolean {
  const family = inspectorFamilyForEvent(event)
  return !!family && (inspectorCategories[0].families as readonly string[]).includes(family.id) &&
    !isPolicyRateDecision(event) &&
    event.actual === null && event.previous === null
}

// Display paired monthly readings before paired annual readings. Catalog
// order differs for PCE and euro-area CPI; original source rows stay intact.
const releaseReadingOrder: Record<string, readonly string[]> = {
  ...Object.fromEntries(policyEpisodeRules.map((rule) => [rule.familyId, [...rule.decisionIds, ...rule.companionIds]])),
  jobs: ['840030016', '840030015', '840030017', '840030018', '840030019', '840030020', '840030023', '840030022', '840030032', '840030024'],
  'us-cpi': ['840030005', '840030006', '840030007', '840030008'],
  pce: ['840010003', '840010001', '840010004', '840010002'],
  ppi: ['840030001', '840030002', '840030003', '840030004'],
  'euro-inflation': ['999030011', '999030010', '999030013', '999030012'],
  'german-inflation': ['276010020', '276010022', '276010021', '276010023'],
}

// Exact publication identity forms the initial releases; verified policy
// companions then attach to a decision within its bounded episode window.
// Reference periods and revision/value identities remain on individual rows.
export function groupInspectorReleases(events: InspectorEvent[], combinePolicy = true, clock: 'chart' | 'publication' = 'chart'): InspectorRelease[] {
  const groups = new Map<string, InspectorRelease>()
  const seen = new Set<string>()
  for (const event of events) {
    const family = inspectorFamilyForEvent(event)
    if (!family || seen.has(event.value_id)) continue
    seen.add(event.value_id)
    const label = releaseLabel(event, family.id) ?? family.label
    const chartTime = inspectorEventChartTime(event)
    const id = JSON.stringify([family.id, event.country_code, event.currency, event.release_at === null ? event.server_time_seconds : event.release_at / 1000,
      event.time_mode, label, event.server_time_seconds <= 0 ? event.value_id : null])
    let group = groups.get(id)
    if (!group) {
      group = { id, familyId: family.id, label, currency: family.currency,
        country: event.country_code, releaseAt: event.release_at, chartTime, serverTime: chartTime ?? event.server_time_seconds,
        // Publication certainty is independent of native candle placement.
        timingUncertain: event.time_mode !== 0 && !isPublishedTentative(event),
        events: [] }
      groups.set(id, group)
    }
    group.events.push(event)
    group.releaseAt ??= event.release_at
    group.chartTime ??= chartTime
    group.timingUncertain ||= event.time_mode !== 0 && !isPublishedTentative(event)
  }
  const publications = groupFrenchCpiReleases([...groups.values()], clock === 'chart')
  const episodes = combinePolicy ? groupPolicyEpisodes(publications, clock === 'chart') : publications
  for (const group of episodes) {
    if (group.familyIds) continue // Publication packages already have their complete cross-family series order.
    const catalogOrder = inspectorFamilyById.get(group.familyId)!.events as readonly string[]
    const principal = releaseReadingOrder[group.familyId] ?? []
    const order = [...principal, ...catalogOrder.filter((id) => !principal.includes(id))]
    group.events.sort((a, b) => order.indexOf(a.event_id) - order.indexOf(b.event_id) ||
      a.period_seconds - b.period_seconds || a.revision - b.revision || a.value_id.localeCompare(b.value_id))
  }
  return episodes.sort((a, b) => a.serverTime - b.serverTime || a.label.localeCompare(b.label))
}
