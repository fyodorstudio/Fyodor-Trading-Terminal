import type { InspectorRelease } from '../../economic-calendar/releases/release'
import type { StoredCalendarEvent } from '../../economic-calendar/storage/useStoredCalendar'
import { inspectorFamilies } from '../../inspector/catalog/inspector-families'
import { policyEpisodeRule } from '../../inspector/episodes/policy-episodes'
import { isInspectorCommentary } from '../../inspector/releases/group-releases'
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
const noCandleAssessment = 'For upcoming preparation and live/release-time assessment, do not fetch or analyze candles/OHLC, including saved candles, charts or technical indicators. Do not measure price reaction. Use current web evidence as the primary source; calendar readings and saved fundamental research are optional aids. This restriction overrides any candle-measurement instructions in older saved templates. Candle analysis is allowed only for a separate historical price investigation explicitly requested by me.'
const assessmentFormat = 'For the chat response, follow the current $assess-trade-now output format: assessment date/as-of time and horizon, then pair or currency with STRONG BUY / BUY / MIXED / SELL / STRONG SELL and a short dominant-driver thesis with direct sources. A dominant active catalyst can outweigh weaker or older counterevidence; do not default to slight or low-confidence wording. Put any material recent developments newest first. Then use separate sections: UPCOMING EVENTS THAT COULD CHANGE THE THESIS (earliest first, verified Jakarta AM/PM dates/times and what would change the thesis), and PRIOR STALE EVENTS (newest first, original dates and ages). Research at least the next seven days for both currencies and show only material thesis-changing events and reversal triggers. No tables unless requested, mandatory entry-date declarations or confidence/entry/risk checklists. This format overrides older response-format instructions in saved templates; preserve journal schemas and user notes.'
export function highlightAssessmentPrompt(item: Highlight, scope: string) {
  const time = item.release_at === null ? 'Publication time unconfirmed; verify the official schedule.' : `Stored publication time: ${new Date(item.release_at).toISOString()} (UTC); verify the official schedule and publication stages.`
  return `Follow AGENTS.md and use $assess-trade-now at .agents/skills/assess-trade-now/SKILL.md. Assess ${scope} now for an intraday trade unless I specify another horizon. Anchor to Highlight ${item.id}, broker ${item.source_id}, ${item.label}, scope ${scope}. ${time}\n\n` +
    `Research both currencies thoroughly on the web, including their expected policy paths and material off-calendar catalysts such as fiscal/bond stress, energy, funding and haven demand. Reuse loaded guidance, resolve this exact Highlight/current readings for occurrence identity, batch independent searches and bound failed-source retries. Local datasets and saved research are optional beyond that identity check. Verify material facts or disclose gaps; do not run historical price research. Attribute broker forecasts and web expectations separately. For an unpublished-release interpretation, give conditional outcomes until actuals are verified; for the current pair view, a pending release alone does not force waiting.\n\n` +
    assessmentFormat + ` Answer here; do not save research unless I ask. Leave technical execution and risk management to me.\n\n` + noCandleAssessment
}
export function highlightPrompt(item: Highlight, scope: string, phase: 'prepare' | 'after' = 'after') {
  const saved = [...(item.prompts ?? [])].reverse().find(entry => entry.scope === scope)
  const researched = [...(item.journal ?? [])].reverse().find(entry => entry.scope === scope)
  const tailored = phase === 'prepare' ? saved?.prepare_prompt : researched && (!saved || researched.saved_utc > saved.saved_utc) ? researched.release_prompt : saved?.release_prompt ?? researched?.release_prompt
  const time = item.release_at === null ? 'Publication time unconfirmed; verify the official schedule.' : `First verified publication: ${new Date(item.release_at).toISOString()} (UTC).`
  const uncertain = item.events.some(event => event.time_mode !== 0) ? ' Some series have unverified hours; distinguish the decision and other publication stages.' : ''
  return `Follow AGENTS.md. Check Highlight ${item.id}, broker ${item.source_id}, ${item.label}, scope ${scope}. ${time}\n\n` +
    (tailored ?? (phase === 'prepare'
      ? `Prepare this Highlight for today's release. Verify the official schedule and separately attributed current expectations. Refresh the central-bank and macro backdrop${scope.length === 6 ? ' for both currencies' : ''}, review the prior comparable release and material counterevidence, and explain conditional outcomes and invalidation. Save the Before release investigation. Do not treat forecasts as actuals; keep release scenarios conditional and assess the existing pair thesis separately.`
      : `Check this Highlight after publication. Verify actuals and revisions against the official publisher, compare the complete package with separately attributed expectations and the previous comparable release, and refresh the central-bank and macro backdrop${scope.length === 6 ? ' for both currencies' : ''}. Give a direct fundamental thesis and integrate material counterevidence briefly. If actuals are incomplete, identify what is missing. Save the After release investigation with price_reaction empty.`)) + uncertain + `\n\n${assessmentFormat}\n\n${noCandleAssessment}`
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
