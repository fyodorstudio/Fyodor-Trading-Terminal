import { majorForexPairs } from '../economic-calendar/forex/pairs'

export const thesisMonth = '2026-10'
export const thesisMonths = [{ value: '2026-07', label: 'JUL 2026' }, { value: '2026-10', label: 'OCT 2026' }] as const
export const thesisChanges = ['Baseline', 'Materially strengthened', 'Strengthened', 'Unchanged', 'Weakened', 'Reversed'] as const
export const verdicts = ['STRONG BUY', 'BUY', 'MIXED', 'SELL', 'STRONG SELL'] as const
export type ThesisTarget = { kind: 'highlight' | 'external'; reference: string; source_id: string | null; event_at: string | null; event_date: string | null }
export type ThesisSource = { kind: 'web' | 'local'; label: string; locator: string; note: string }
export type ThesisEntry = {
  id: string; row_id: string; expected_version: string | null; scope: string; as_of_utc: string; saved_utc: string
  title: string; verdict: typeof verdicts[number]; thesis: string; horizon: string; sources: ThesisSource[]
  note: string; provenance: 'assessment' | 'reconstruction'; target: ThesisTarget | null; journal_id: string | null
  change?: typeof thesisChanges[number] | null; change_reason?: string; compared_with?: string | null; as_of_precision?: 'minute' | 'date'
  collection?: 'pair' | 'across'
}
export type ThesisRow = ThesisEntry & { versions: ThesisEntry[]; comparison?: { id: string; as_of_utc: string; verdict: typeof verdicts[number] } | null }
export type ThesisPlannedDay = { scope: string; date: string; checked_utc: string; events: { title: string; at: string | null; note: string; sources: ThesisSource[] }[] }
export const backdropCategories = [{ key: 'policy', label: 'Monetary policy' }, { key: 'inflation', label: 'Inflation' }, { key: 'labor', label: 'Labor / wages' }, { key: 'growth', label: 'Growth / activity' }, { key: 'other', label: 'Other drivers' }] as const
export const reviewCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'] as const
export type BackdropEvidence = { published_on: string | null; summary: string; verified_utc: string; sources: ThesisSource[]; publication_note: string }
export type BackdropCell = { currency: string; category: typeof backdropCategories[number]['key']; evidence: BackdropEvidence[]; gap: string }
export type CurrencyCheckpoint = { title: string; event_at: string | null; event_date: string | null; verified_utc: string; sources: ThesisSource[]; note: string }
export type CurrencyView = { currency: string; bias: string; summary: string; counterweight: string; sources: ThesisSource[]; checkpoints: CurrencyCheckpoint[] }
export type ThesisReviewEntry = { id: string; review_id: string; expected_version: string | null; scope: string; as_of_utc: string; saved_utc: string; takeaway: string; horizon: string; backdrop: BackdropCell[]; opportunity_ids: string[]; limitations: string; note: string; provenance: 'assessment' | 'reconstruction'; currency_views?: CurrencyView[]; planning_as_of_utc?: string | null }
export type ThesisReview = ThesisReviewEntry & { versions: ThesisReviewEntry[]; opportunities: ThesisRow[] }
export type ThesisSnapshot = { schema: 1; scope: string; month: string; source_id: string | null; revision: string; past: ThesisRow[]; planned?: ThesisPlannedDay[]; reviews?: ThesisReview[] }

const timestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value)) && /(?:Z|[+-]\d\d:\d\d)$/.test(value)
const text = (value: unknown): value is string => typeof value === 'string'
function validTarget(value: unknown): value is ThesisTarget {
  if (!value || typeof value !== 'object') return false
  const item = value as ThesisTarget
  return ['highlight', 'external'].includes(item.kind) && text(item.reference) && !!item.reference
    && (item.kind === 'highlight' ? text(item.source_id) && !!item.source_id : item.source_id === null)
    && (item.event_at === null ? typeof item.event_date === 'string' && /^\d{4}-\d\d-\d\d$/.test(item.event_date) : timestamp(item.event_at) && item.event_date === null)
}
export function safeThesisLink(locator: string) {
  try { const url = new URL(locator); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password } catch { return false }
}
function validEntry(value: unknown, scope: string): value is ThesisEntry {
  if (!value || typeof value !== 'object') return false
  const item = value as ThesisEntry
  return (scope === 'ALL' ? majorForexPairs.includes(item.scope) && item.collection === 'across' : item.scope === scope && item.collection !== 'across')
    && (item.collection === undefined || ['pair', 'across'].includes(item.collection))
    && ['id', 'row_id', 'title', 'thesis', 'horizon', 'note'].every(key => text(item[key as keyof ThesisEntry]))
    && verdicts.includes(item.verdict) && ['assessment', 'reconstruction'].includes(item.provenance)
    && timestamp(item.as_of_utc) && timestamp(item.saved_utc) && (item.target === null || validTarget(item.target))
    && (item.change === undefined || item.change === null || thesisChanges.includes(item.change))
    && (item.change_reason === undefined || text(item.change_reason))
    && (item.compared_with === undefined || item.compared_with === null || text(item.compared_with))
    && (item.as_of_precision === undefined || ['minute', 'date'].includes(item.as_of_precision))
    && (item.expected_version === null || text(item.expected_version)) && (item.journal_id === null || text(item.journal_id))
    && Array.isArray(item.sources) && item.sources.length > 0 && item.sources.every(source => source && text(source.label) && text(source.locator) && text(source.note)
      && (source.kind === 'local' || source.kind === 'web' && safeThesisLink(source.locator)))
}
function validRow(value: unknown, scope: string): value is ThesisRow {
  const item = value as ThesisRow
  return validEntry(item, scope) && Array.isArray(item.versions) && item.versions.length > 0
    && item.versions.every(entry => validEntry(entry, scope) && entry.scope === item.scope && entry.row_id === item.row_id)
    && (item.comparison === undefined || item.comparison === null || text(item.comparison.id) && timestamp(item.comparison.as_of_utc) && verdicts.includes(item.comparison.verdict))
}
function validReviewEntry(value: unknown, scope: string): value is ThesisReviewEntry {
  if (!value || typeof value !== 'object') return false
  const item = value as ThesisReviewEntry
  const currencies = scope === 'ALL' ? [...reviewCurrencies] : [scope.slice(0, 3), scope.slice(3)]
  return item.scope === scope && ['id', 'review_id', 'takeaway', 'horizon', 'limitations', 'note'].every(key => text(item[key as keyof ThesisReviewEntry]))
    && timestamp(item.as_of_utc) && timestamp(item.saved_utc) && ['assessment', 'reconstruction'].includes(item.provenance)
    && (item.expected_version === null || text(item.expected_version)) && Array.isArray(item.opportunity_ids) && item.opportunity_ids.every(text)
    && (item.planning_as_of_utc === undefined || item.planning_as_of_utc === null || timestamp(item.planning_as_of_utc) && Date.parse(item.planning_as_of_utc) >= Date.parse(item.as_of_utc))
    && (item.currency_views === undefined || Array.isArray(item.currency_views) && (!item.currency_views.length || item.currency_views.length === currencies.length
      && new Set(item.currency_views.map(view => view?.currency)).size === currencies.length
      && item.currency_views.every(view => view && currencies.includes(view.currency) && [view.bias, view.summary, view.counterweight].every(value => text(value) && !!value.trim())
        && validSources(view.sources) && Array.isArray(view.checkpoints) && view.checkpoints.every(checkpoint => checkpoint && text(checkpoint.title) && !!checkpoint.title.trim()
          && text(checkpoint.note) && timestamp(checkpoint.verified_utc) && timestamp(item.planning_as_of_utc) && Date.parse(checkpoint.verified_utc) <= Date.parse(item.planning_as_of_utc)
          && validSources(checkpoint.sources) && (checkpoint.event_at === null
            ? checkpoint.event_date === null ? !!checkpoint.note.trim() : typeof checkpoint.event_date === 'string' && /^\d{4}-\d\d-\d\d$/.test(checkpoint.event_date)
            : timestamp(checkpoint.event_at) && checkpoint.event_date === null && Date.parse(checkpoint.event_at) > Date.parse(item.planning_as_of_utc))))))
    && Array.isArray(item.backdrop) && item.backdrop.length === currencies.length * 5
    && item.backdrop.every(cell => cell && typeof cell === 'object')
    && new Set(item.backdrop.map(cell => `${cell.currency}:${cell.category}`)).size === item.backdrop.length
    && item.backdrop.every(cell => cell && currencies.includes(cell.currency) && backdropCategories.some(category => category.key === cell.category)
      && text(cell.gap) && Array.isArray(cell.evidence) && (!!cell.evidence.length || !!cell.gap.trim()) && cell.evidence.every(evidence => evidence && text(evidence.summary)
        && (evidence.published_on === null || /^\d{4}-\d\d-\d\d$/.test(evidence.published_on)) && timestamp(evidence.verified_utc) && text(evidence.publication_note)
        && Array.isArray(evidence.sources) && evidence.sources.length > 0 && evidence.sources.every(source => source && text(source.label) && text(source.note) && text(source.locator)
          && (source.kind === 'local' || source.kind === 'web' && safeThesisLink(source.locator)))))
}
function validSources(value: unknown): value is ThesisSource[] {
  return Array.isArray(value) && value.length > 0 && value.some(source => source?.kind === 'web') && value.every(source => source
    && text(source.label) && text(source.note) && text(source.locator) && (source.kind === 'local' || source.kind === 'web' && safeThesisLink(source.locator)))
}
function validReview(value: unknown, scope: string): value is ThesisReview {
  const item = value as ThesisReview
  return validReviewEntry(item, scope) && Array.isArray(item.versions) && item.versions.length > 0
    && item.versions.every(version => validReviewEntry(version, scope) && version.review_id === item.review_id)
    && Array.isArray(item.opportunities) && item.opportunities.every(row => validRow(row, scope) && item.opportunity_ids.includes(row.id) && row.as_of_utc === item.as_of_utc)
    && item.opportunities.length === item.opportunity_ids.length
}
export function validThesisSnapshot(value: unknown, scope: string, month: string, sourceId: string | null): value is ThesisSnapshot {
  if (!value || typeof value !== 'object') return false
  const data = value as ThesisSnapshot
  return data.schema === 1 && data.scope === scope && data.month === month && data.source_id === sourceId && !!data.revision
    && (data.planned === undefined || Array.isArray(data.planned) && data.planned.every(day => day && day.scope === scope
      && typeof day.date === 'string' && day.date.startsWith(month + '-') && /^\d{4}-\d\d-\d\d$/.test(day.date) && Number.isFinite(Date.parse(day.date))
      && timestamp(day.checked_utc) && Array.isArray(day.events) && day.events.every(event => event && text(event.title) && text(event.note)
        && (event.at === null || timestamp(event.at)) && Array.isArray(event.sources) && event.sources.length > 0
        && event.sources.every(source => source && text(source.label) && text(source.locator) && text(source.note)
          && (source.kind === 'local' || source.kind === 'web' && safeThesisLink(source.locator))))))
    && Array.isArray(data.past) && data.past.every(item => validRow(item, scope))
    && (data.reviews === undefined || Array.isArray(data.reviews) && data.reviews.every(review => validReview(review, scope)))
}
export function readThesisPair() {
  try { const pair = localStorage.getItem('fyodor.thesis.pair.v1'); if (pair && majorForexPairs.includes(pair)) return pair } catch { /* Session default. */ }
  return 'NZDCHF'
}
export function readThesisMonth() {
  try { const month = localStorage.getItem('fyodor.thesis.month.v1'); if (thesisMonths.some(item => item.value === month)) return month! } catch { /* Session default. */ }
  return thesisMonth
}

export function readThesisAcross() {
  try { return localStorage.getItem('fyodor.thesis.across.v1') !== 'false' } catch { return true }
}

export function thesisDays(month: string) { return new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate() }
export function readThesisDay(month: string) {
  try { const day = Number(localStorage.getItem('fyodor.thesis.day.v1')); if (day >= 1 && day <= 31) return Math.min(day, thesisDays(month)) } catch { /* Session date. */ }
  const today = thesisDay(new Date().toISOString())
  return today.startsWith(month) ? Number(today.slice(8)) : 1
}

export function selectedThesisReview(data: ThesisSnapshot, date: string) {
  return data.reviews?.filter(review => thesisDay(review.as_of_utc) === date)
    .sort((a, b) => b.as_of_utc.localeCompare(a.as_of_utc) || b.saved_utc.localeCompare(a.saved_utc))[0]
}

export function thesisDay(value: string) {
  return new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 10)
}

export function thesisDateGroups(rows: ThesisRow[]) {
  const groups = new Map<string, ThesisRow[]>()
  for (const row of rows) {
    const date = thesisDay(row.as_of_utc)
    const group = groups.get(date) ?? []
    group.push(row); groups.set(date, group)
  }
  return [...groups].sort(([a], [b]) => b.localeCompare(a))
}

function baseThesisPrompt(scope: string, month: string, row?: ThesisRow) {
  const assessment = row
  const target = row?.target ?? null
  const skill = '$assess-trade-now at .agents/skills/assess-trade-now/SKILL.md'
  const broker = target?.source_id
  return `Follow AGENTS.md and use ${skill}. Assess ${scope} as of now; intraday horizon unless I specify otherwise. The Thesis dock is displaying ${month}; that display month is not an instruction to pretend today is in the past.\n\n` +
    (target ? `Occurrence: ${target.kind} ${target.reference}${target.source_id ? `, broker ${target.source_id}` : ''}. Title: ${row!.title}. Target stage (UTC internally): ${JSON.stringify(target)}. Verify the official timing, publication stages and fresh actuals.\n\n` : '') +
    `Research both currencies on the web; local calendar readings and saved research are optional except for identifying a named Highlight. No candles/OHLC. Reuse prepared context and verify decisive facts. A passed release time is not proof actuals arrived. Answer in chat using the skill's current format.\n\n` +
    `Also save the supported compact verdict, thesis change and its evidence versus the exact earlier assessment version, one or two thesis paragraphs, direct sources, actual assessment cutoff and horizon to the Thesis dock. Use change/compared_with/change_reason; weakening an existing buy/sell case does not establish the opposite case. This prompt authorizes that save. Read docs/THESIS.md and run pnpm analyst thesis read --scope ${scope} --month ${month}${broker ? ` --broker "${broker.replaceAll('"', '')}"` : ''} first. ` +
    (assessment ? `Prior context: row_id ${assessment.row_id}, using its latest expected_version only for a correction. A fresh invocation creates a standalone assessment with target null; retain the occurrence as context. ` : 'Create a standalone assessment with target null. ') +
    `Use pnpm analyst thesis append with a ThesisRequest JSON file inside Lite. Preserve the real as_of_utc and saved time; never backdate a current assessment to fit this displayed month. Use the invocation's actual cutoff; do not anchor every day to 1:00 PM. Unknown historical publication hours use as_of_precision date with an explicit conservative cutoff note. If the actual month is outside JUL/OCT, disclose that it is not yet selectable. Do not alter pins, raw calendar readings or Entry Trade notes.`
}

export function thesisPrompt(scope: string, month: string, row?: ThesisRow) {
  if (scope === 'ALL') return currencyThesisPrompt(`${month}-${String(readThesisDay(month)).padStart(2, '0')}`)
  return baseThesisPrompt(scope, month, row) + `\n\nShared review context: first run pnpm analyst thesis context --scope ${row?.scope ?? scope} to load the latest relevant review and exact prior assessment across months. For an all-currency scan also read --scope ALL. Treat this as dated context, refresh decisive web sources and seek contrary evidence.\n\nFor a fresh invocation, the earlier row/version identifiers identify comparison context: create new standalone assessment rows at the real new cutoff, then save one complete dated review using pnpm analyst thesis review-append --scope ${scope} --input <ReviewRequest.json>. Read docs/THESIS.md for the schema. Link the exact opportunity version IDs; write a short entry-focused takeaway (including lost/conditional opportunities), all five backdrop categories for every reviewed currency, original publication dates, source verification clocks and explicit gaps. Reuse still-relevant evidence without pretending it was freshly checked; the saved review is a complete snapshot. Row/review revisions are for corrections preserving the original review cutoff. Do not overwrite old dated reviews, duplicate shared backdrops per opportunity, or create scheduled upkeep. Upcoming events remain in Alert. This copied prompt authorizes the assessment and review saves, not pins or alarms.`
}

export function currencyThesisPrompt(date: string) {
  return `Follow AGENTS.md and use $assess-trade-now at .agents/skills/assess-trade-now/SKILL.md. The Thesis dock is displaying ${date} in Jakarta. Assess USD, EUR, GBP, JPY, CHF, CAD, AUD and NZD as of the actual invocation time; the selected date does not authorize backdating. If I explicitly request a historical reconstruction, use only evidence available at its stated cutoff and label it. No candles/OHLC.\n\nRead docs/THESIS.md and pnpm analyst thesis context --scope ALL first. Refresh current web evidence across policy/expected rate paths, inflation, labor/wages, growth and material off-calendar drivers. Keep saved interpretation as dated context; seek contrary developments.\n\nSave a new ALL review using pnpm analyst thesis review-append with a ReviewRequest JSON inside Lite. The visible view is ONE table: Currency | Current fundamental backdrop | Confidence / main counterweight | Next material checkpoint. Write currency_views for all eight: a clear bias, concise summary, strongest counterweight and decisive direct sources. Do not invent confidence scores or force a directional call. Research all five categories in backdrop for agent context. No pair/opportunity tables, takeaways, expandable research or conditional sections in this view; opportunity_ids may be empty.\n\nPut only material upcoming checkpoints in each currency's checkpoints, earliest first, using verified event_at UTC or event_date when the hour is unknown. Preserve sources and their verified_utc; set planning_as_of_utc to the actual preparation cutoff. Include the outcome that would support or reverse the bias in the checkpoint note when supported. Unknown/unscheduled times stay unknown. No new actuals or entry confirmation just because release time passed. A directional backdrop does not establish an immediate entry or technical timing. User chart/support observations are execution context, not fundamental proof.\n\nThis prompt authorizes the requested review save only. Preserve old review versions, pair history, raw data, pins, alarms and trade notes. A fresh research cutoff creates a new dated review; corrections append at the original cutoff. Answer in chat and confirm the save. Alert owns reminders; no automatic invocation or daily upkeep.`
}
