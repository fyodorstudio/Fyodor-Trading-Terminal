import type { InspectorRelease } from '../../economic-calendar/releases/release'
import type { StoredCalendarEvent } from '../../economic-calendar/storage/useStoredCalendar'
import { inspectorFamilies } from '../../inspector/catalog/inspector-families'
import { policyEpisodeRule } from '../../inspector/episodes/policy-episodes'
import { releaseFamilyIds } from '../../inspector/episodes/display-episodes'

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
export function highlightRequest(release: InspectorRelease, sourceId: string) {
  const families = new Set([...releaseFamilyIds(release), ...(release.pmiPublications ?? []).map(item => item.familyId)])
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
