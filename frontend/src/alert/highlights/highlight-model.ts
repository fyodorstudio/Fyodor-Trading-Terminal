import type { InspectorRelease } from '../../economic-calendar/releases/release'
import type { StoredCalendarEvent } from '../../economic-calendar/storage/useStoredCalendar'
import { inspectorFamilies } from '../../inspector/catalog/inspector-families'
import { policyEpisodeRule } from '../../inspector/episodes/policy-episodes'
import { isInspectorCommentary } from '../../inspector/releases/group-releases'

export type Highlight = {
  id: string; source_id: string; label: string; family_id: string; currency: string
  value_ids: string[]; event_ids: string[]; pinned_utc: string
  events: StoredCalendarEvent[]; release_at: number | null; server_time: number | null; missing_value_ids: string[]
  archived_utc?: string | null; journal?: JournalEntry[]
  prompts?: SavedPrompt[]
}
export type SavedPrompt = { id: string; highlight_id: string; source_id: string; scope: string; saved_utc: string; prepare_prompt: string; release_prompt: string }
export type JournalEntry = {
  id: string; highlight_id: string; source_id: string; phase: 'before' | 'after'; scope: string
  as_of_utc: string; saved_utc: string; body: string; direction: string; confidence: string; counterevidence: string
  expectations: { provider: string; as_of_utc: string; values: string }[]
  sources: { kind: 'web' | 'local'; label: string; locator: string; note: string }[]
  release_prompt: string; prior_highlight_ids: string[]; correction_of: string | null; price_reaction: string
  readings: StoredCalendarEvent[]; calendar_revision: number; reading_vintage: string; missing_value_ids: string[]
  trade_outcome?: string
}
export function highlightPrompt(item: Highlight, scope: string, phase: 'prepare' | 'after' = 'after') {
  const saved = [...(item.prompts ?? [])].reverse().find(entry => entry.scope === scope)
  const researched = [...(item.journal ?? [])].reverse().find(entry => entry.scope === scope)
  const tailored = phase === 'prepare' ? saved?.prepare_prompt : researched && (!saved || researched.saved_utc > saved.saved_utc) ? researched.release_prompt : saved?.release_prompt ?? researched?.release_prompt
  const time = item.release_at === null ? 'Publication time unconfirmed; verify the official schedule.' : `First verified publication: ${new Date(item.release_at).toISOString()} (UTC).`
  const uncertain = item.events.some(event => event.time_mode !== 0) ? ' Some series have unverified hours; distinguish the decision and other publication stages.' : ''
  return `Follow AGENTS.md. Check Highlight ${item.id}, broker ${item.source_id}, ${item.label}, scope ${scope}. ${time}\n\n` +
    (tailored ?? (phase === 'prepare'
      ? `Prepare this Highlight for today's release. Verify the official schedule and separately attributed current expectations. Refresh the central-bank and macro backdrop${scope.length === 6 ? ' for both currencies' : ''}, review the prior comparable release and strongest counterevidence, and explain conditional outcomes and invalidation. Save the Before release investigation. Do not treat forecasts as actuals or force a direction before publication.`
      : `Check this Highlight after publication. Verify actuals and revisions against the official publisher, compare the complete package with separately attributed expectations and the previous comparable release, and refresh the central-bank and macro backdrop${scope.length === 6 ? ' for both currencies' : ''}. Give the fundamental direction, confidence and strongest counterevidence. Keep measured price reaction separate. If actuals are incomplete, identify what is missing. Save the After release investigation.`)) + uncertain
}
export function highlightRequest(release: InspectorRelease, sourceId: string) {
  const families = new Set([release.familyId, ...(release.pmiPublications ?? []).map(item => item.familyId)])
  return { source_id: sourceId, label: release.label, family_id: release.familyId, currency: release.currency,
    value_ids: [...new Set(release.events.map(event => event.value_id))],
    event_ids: [...new Set([...release.events.map(event => event.event_id),
      ...inspectorFamilies.filter(family => families.has(family.id)).flatMap(family => family.events)])],
    join_window_seconds: policyEpisodeRule(release.familyId) ? 3600 : 0 }
}
export function highlightForRelease(items: Highlight[], release: InspectorRelease) {
  const ids = new Set(release.events.map(event => event.value_id))
  return items.find(item => item.value_ids.some(id => ids.has(id)) || item.events.some(event => ids.has(event.value_id)))
}
export function highlightState(item: Highlight, now: number) {
  if (!item.events.length || item.missing_value_ids.length || item.events.some(event => event.availability !== 'observed')) return 'Readings unavailable'
  const numeric = item.events.filter(event => !isInspectorCommentary(event))
  const arrived = numeric.filter(event => event.actual !== null && Number.isFinite(event.actual)).length
  if (numeric.length && arrived === numeric.length) return 'Released'
  if (arrived) return 'Partial release data'
  if (item.release_at === null) return 'Time unconfirmed'
  if (item.release_at > now) return 'Upcoming'
  return numeric.length ? 'Awaiting release data' : 'Event elapsed'
}
