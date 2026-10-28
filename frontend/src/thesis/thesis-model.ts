import { researchPrompt } from './research-prompt'
import { majorForexPairs } from '../economic-calendar/forex/pairs'
import { commodityIds, type Commodity } from '../external-sources/research-instruments'

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
export type CurrencyNews = { published_on: string; published_at?: string | null; summary: string; verified_utc: string; sources: ThesisSource[] }
export const dailyVerdicts = ['POTENTIAL STRENGTHENING', 'POTENTIAL WEAKENING'] as const
export const directionIntensities = ['strong', 'moderate', 'slight'] as const
export type DirectionAnchor = { title: string; event_at: string | null; event_date: string | null; sources: ThesisSource[]; note: string }
export type DailyDirection = { verdict: typeof dailyVerdicts[number]; reason: string; verified_utc: string; sources: ThesisSource[]; basis?: 'standalone' | null; intensity?: typeof directionIntensities[number] | null; horizon?: string; reassessment?: CurrencyCheckpoint | null; reassessment_gap?: string; evidence_anchor?: DirectionAnchor | null }
export function dailyDirectionLabel(direction: DailyDirection) {
  return direction.basis === 'standalone' && direction.intensity ? `${direction.intensity[0].toUpperCase()}${direction.intensity.slice(1)} ${direction.verdict === 'POTENTIAL STRENGTHENING' ? 'strengthening' : 'weakening'}` : direction.verdict
}
export type OpportunityEvidence = { expected_baseline: string; new_information: string; remaining_case: string; flow_channel: string; flow_basis: 'observed' | 'reported' | 'inferred'; horizon: string; market_feedback: string; verified_utc: string; sources: ThesisSource[] }
export type OpportunityWindow = { summary: string; starts_at: string; ends_at: string; timing_note: string; invalidation: string; stage?: 'active' | 'conditional' | null; activation?: string; evidence?: OpportunityEvidence | null }
export type CurrencyOpportunity = OpportunityWindow & { currency: string }
export type CommodityOpportunity = OpportunityWindow & { instrument: Commodity; symbol: string; provider: string; instrument_type: 'spot' | 'spot_cfd' | 'futures' | 'futures_cfd'; contract_note: string; verdict: 'BUY' | 'SELL' | 'STRONG BUY' | 'STRONG SELL'; checkpoints?: CurrencyCheckpoint[] }
export type CurrencyView = { currency: string; bias?: string; summary?: string; counterweight?: string; sources?: ThesisSource[]; news?: CurrencyNews[]; news_gap?: string; checkpoints: CurrencyCheckpoint[]; direction?: DailyDirection | null }
export type ThesisReviewEntry = { id: string; review_id: string; expected_version: string | null; scope: string; format?: 'assessment' | 'daily_news'; as_of_utc: string; saved_utc: string; takeaway: string; horizon: string; backdrop: BackdropCell[]; opportunity_ids: string[]; limitations: string; note: string; provenance: 'assessment' | 'reconstruction'; currency_views?: CurrencyView[]; planning_as_of_utc?: string | null; entry_opportunities?: CurrencyOpportunity[]; commodity_opportunities?: CommodityOpportunity[]; opportunity_gap?: string }
export type ThesisReview = ThesisReviewEntry & { versions: ThesisReviewEntry[]; opportunities: ThesisRow[] }
export type ThesisSnapshot = { schema: 1; scope: string; month: string; source_id: string | null; revision: string; past: ThesisRow[]; planned?: ThesisPlannedDay[]; reviews?: ThesisReview[] }

export function validDirectionAnchor(anchor: DirectionAnchor, cutoff: string, verified: string) {
  return anchor && typeof anchor.title === 'string' && !!anchor.title.trim()
    && typeof anchor.note === 'string' && !!anchor.note.trim() && validSources(anchor.sources) && anchor.sources.some(source => source.kind === 'web')
    && (anchor.event_at === null ? typeof anchor.event_date === 'string' && /^\d{4}-\d\d-\d\d$/.test(anchor.event_date)
      && anchor.event_date <= thesisDay(cutoff) && anchor.event_date <= thesisDay(verified)
      : timestamp(anchor.event_at) && anchor.event_date === null && Date.parse(anchor.event_at) <= Math.min(Date.parse(cutoff), Date.parse(verified)))
}

const opportunityClock = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
const opportunityTime = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', minute: '2-digit', hour12: true })
export function opportunityWindow(item: OpportunityWindow) {
  return `${opportunityClock.formatRange(new Date(item.starts_at), new Date(item.ends_at))} Jakarta`
}
export function sharedOpportunityWindow(items: CurrencyOpportunity[] = []) {
  const first = items[0]
  return first && items.every(item => Date.parse(item.starts_at) === Date.parse(first.starts_at) && Date.parse(item.ends_at) === Date.parse(first.ends_at)) ? first : undefined
}
export function currencyReviewTiming(review: ThesisReviewEntry) {
  const common = sharedOpportunityWindow(review.entry_opportunities)
  const startsAtCutoff = common && Date.parse(common.starts_at) === Date.parse(review.as_of_utc)
  const parts = [`As of ${opportunityClock.format(new Date(review.as_of_utc))} Jakarta`]
  if (common) parts.push(startsAtCutoff ? `Assessment through ${opportunityTime.format(new Date(common.ends_at))}` : `Assessment window: ${opportunityWindow(common)}`)
  if (review.planning_as_of_utc && review.planning_as_of_utc !== review.as_of_utc) {
    const sameDay = thesisDay(review.planning_as_of_utc) === thesisDay(review.as_of_utc)
    parts.push(`Checkpoints prepared ${(sameDay ? opportunityTime : opportunityClock).format(new Date(review.planning_as_of_utc))}${sameDay ? '' : ' Jakarta'}`)
  }
  return parts.join(' · ')
}

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
  const daily = item.format === 'daily_news'
  return item.scope === scope && (item.format === undefined || ['assessment', 'daily_news'].includes(item.format))
    && (!daily || scope === 'ALL' && Array.isArray(item.currency_views) && item.currency_views.length === 8 && item.opportunity_ids?.length === 0)
    && ['id', 'review_id', 'takeaway', 'horizon', 'limitations', 'note'].every(key => text(item[key as keyof ThesisReviewEntry]))
    && timestamp(item.as_of_utc) && timestamp(item.saved_utc) && ['assessment', 'reconstruction'].includes(item.provenance)
    && validDailyDirections(item) && validCommodityOpportunities(item)
    && (!daily || thesisDay(item.as_of_utc) >= thesisDay(item.saved_utc) || item.provenance === 'reconstruction' && !!item.note.trim())
    && (item.expected_version === null || text(item.expected_version)) && Array.isArray(item.opportunity_ids) && item.opportunity_ids.every(text)
    && (item.planning_as_of_utc === undefined || item.planning_as_of_utc === null || timestamp(item.planning_as_of_utc) && Date.parse(item.planning_as_of_utc) >= Date.parse(item.as_of_utc))
    && (item.currency_views === undefined || Array.isArray(item.currency_views) && (!item.currency_views.length || item.currency_views.length === currencies.length
      && new Set(item.currency_views.map(view => view?.currency)).size === currencies.length
      && item.currency_views.every(view => view && currencies.includes(view.currency)
        && (daily ? [view.bias, view.summary, view.counterweight].every(value => value === undefined || value === '') && (!view.sources || view.sources.length === 0)
          && Array.isArray(view.news) && (view.news.length > 0 || text(view.news_gap) && !!view.news_gap.trim())
          : [view.bias, view.summary, view.counterweight].every(value => text(value) && !!value.trim()) && validSources(view.sources))
        && (view.news_gap === undefined || text(view.news_gap))
        && (view.news === undefined || Array.isArray(view.news) && view.news.every(news => news && text(news.summary) && !!news.summary.trim()
          && news.published_on === thesisDay(item.as_of_utc) && timestamp(news.verified_utc) && Date.parse(news.verified_utc) <= Date.parse(item.saved_utc)
          && thesisDay(news.verified_utc) >= news.published_on && validSources(news.sources)
          && (news.published_at === undefined || news.published_at === null || timestamp(news.published_at) && thesisDay(news.published_at) === news.published_on
            && Date.parse(news.published_at) <= Date.parse(item.as_of_utc) && Date.parse(news.published_at) <= Date.parse(news.verified_utc))))
        && Array.isArray(view.checkpoints) && view.checkpoints.every(checkpoint => checkpoint && text(checkpoint.title) && !!checkpoint.title.trim()
          && text(checkpoint.note) && timestamp(checkpoint.verified_utc) && timestamp(item.planning_as_of_utc) && Date.parse(checkpoint.verified_utc) <= Date.parse(item.planning_as_of_utc)
          && validSources(checkpoint.sources) && (checkpoint.event_at === null
            ? checkpoint.event_date === null ? !daily && !!checkpoint.note.trim() : typeof checkpoint.event_date === 'string' && /^\d{4}-\d\d-\d\d$/.test(checkpoint.event_date)
              && checkpoint.event_date >= thesisDay(daily ? item.as_of_utc : item.planning_as_of_utc)
            : timestamp(checkpoint.event_at) && checkpoint.event_date === null && Date.parse(checkpoint.event_at) > Date.parse(daily ? item.as_of_utc : item.planning_as_of_utc))))))
    && Array.isArray(item.backdrop) && (daily && item.backdrop.length === 0 || item.backdrop.length === currencies.length * 5)
    && item.backdrop.every(cell => cell && typeof cell === 'object')
    && new Set(item.backdrop.map(cell => `${cell.currency}:${cell.category}`)).size === item.backdrop.length
    && item.backdrop.every(cell => cell && currencies.includes(cell.currency) && backdropCategories.some(category => category.key === cell.category)
      && text(cell.gap) && Array.isArray(cell.evidence) && (!!cell.evidence.length || !!cell.gap.trim()) && cell.evidence.every(evidence => evidence && text(evidence.summary)
        && (evidence.published_on === null || /^\d{4}-\d\d-\d\d$/.test(evidence.published_on)) && timestamp(evidence.verified_utc) && text(evidence.publication_note)
        && Array.isArray(evidence.sources) && evidence.sources.length > 0 && evidence.sources.every(source => source && text(source.label) && text(source.note) && text(source.locator)
          && (source.kind === 'local' || source.kind === 'web' && safeThesisLink(source.locator)))))
}
function validDailyDirections(item: ThesisReviewEntry) {
  const opportunities = item.entry_opportunities ?? []
  if (!Array.isArray(opportunities)) return false
  const views = item.currency_views ?? []
  if (!Array.isArray(views)) return false
  const directional = views.some(view => view?.direction != null) || opportunities.length > 0 || !!item.commodity_opportunities?.length
  if (!directional) return true // Preserve saved news-only and pair history.
  if (item.format !== 'daily_news' || views.length !== 8) return false
  if (!opportunities.length && !item.commodity_opportunities?.length && !(text(item.opportunity_gap) && item.opportunity_gap.trim())) return false
  if (!views.every(view => view?.direction && dailyVerdicts.includes(view.direction.verdict)
    && (view.direction.basis == null ? view.direction.intensity == null && !view.direction.horizon : view.direction.basis === 'standalone'
      && directionIntensities.includes(view.direction.intensity!) && text(view.direction.horizon) && !!view.direction.horizon.trim())
    && text(view.direction.reason) && !!view.direction.reason.trim() && validSources(view.direction.sources)
    && timestamp(view.direction.verified_utc) && Date.parse(view.direction.verified_utc) <= Date.parse(item.saved_utc)
    && (view.direction.evidence_anchor == null || validDirectionAnchor(view.direction.evidence_anchor, item.as_of_utc, view.direction.verified_utc))
    && (view.direction.reassessment_gap === undefined || text(view.direction.reassessment_gap))
    && (view.direction.reassessment == null || validCommodityCheckpoint(view.direction.reassessment, item)
      && !!view.direction.reassessment.note.trim() && !view.direction.reassessment_gap?.trim()))) return false
  return opportunities.length <= 8 && new Set(opportunities.map(entry => entry?.currency)).size === opportunities.length
    && opportunities.every(entry => entry && reviewCurrencies.some(currency => currency === entry.currency) && validOpportunityWindow(entry, item))
}
function validOpportunityWindow(entry: OpportunityWindow, item: ThesisReviewEntry) {
  const evidence = entry.evidence
  return [entry.summary, entry.timing_note, entry.invalidation].every(value => text(value) && !!value.trim())
    && timestamp(entry.starts_at) && timestamp(entry.ends_at) && Date.parse(entry.starts_at) < Date.parse(entry.ends_at)
    && thesisDay(entry.starts_at) === thesisDay(item.as_of_utc) && thesisDay(entry.ends_at) === thesisDay(item.as_of_utc)
    && (item.provenance === 'reconstruction' || Date.parse(entry.starts_at) >= Date.parse(item.as_of_utc))
    && (entry.stage == null || ['active', 'conditional'].includes(entry.stage) && text(entry.activation) && !!entry.activation.trim())
    && (evidence == null || ['expected_baseline', 'new_information', 'remaining_case', 'flow_channel', 'horizon', 'market_feedback'].every(key => text(evidence[key as keyof OpportunityEvidence]) && !!String(evidence[key as keyof OpportunityEvidence]).trim())
      && ['observed', 'reported', 'inferred'].includes(evidence.flow_basis) && validSources(evidence.sources)
      && timestamp(evidence.verified_utc) && Date.parse(evidence.verified_utc) <= Date.parse(item.saved_utc))
}
function validCommodityOpportunities(item: ThesisReviewEntry) {
  const entries = item.commodity_opportunities ?? []
  return (item.opportunity_gap === undefined || text(item.opportunity_gap)) && Array.isArray(entries) && entries.length <= 3
    && new Set(entries.map(entry => entry?.instrument)).size === entries.length
    && entries.every(entry => entry && item.scope === 'ALL' && item.format === 'daily_news' && commodityIds.includes(entry.instrument)
      && ['BUY', 'SELL', 'STRONG BUY', 'STRONG SELL'].includes(entry.verdict)
      && [entry.symbol, entry.provider, entry.contract_note].every(value => text(value) && !!value.trim())
      && ['spot', 'spot_cfd', 'futures', 'futures_cfd'].includes(entry.instrument_type)
      && !!entry.stage && !!entry.evidence && validOpportunityWindow(entry, item)
      && (entry.checkpoints === undefined || Array.isArray(entry.checkpoints) && entry.checkpoints.every(checkpoint => validCommodityCheckpoint(checkpoint, item))))
}
function validCommodityCheckpoint(checkpoint: CurrencyCheckpoint, item: ThesisReviewEntry) {
  return checkpoint && text(checkpoint.title) && !!checkpoint.title.trim() && text(checkpoint.note) && validSources(checkpoint.sources)
    && timestamp(checkpoint.verified_utc) && timestamp(item.planning_as_of_utc) && Date.parse(checkpoint.verified_utc) <= Date.parse(item.planning_as_of_utc)
    && (checkpoint.event_at === null ? typeof checkpoint.event_date === 'string' && /^\d{4}-\d\d-\d\d$/.test(checkpoint.event_date) && checkpoint.event_date >= thesisDay(item.as_of_utc)
      : timestamp(checkpoint.event_at) && checkpoint.event_date === null && Date.parse(checkpoint.event_at) > Date.parse(item.as_of_utc))
}
export function opportunitySelectionMessage(review?: ThesisReviewEntry) {
  return review?.opportunity_gap || (review ? 'Entry opportunity assessment not saved in this earlier snapshot.' : 'Not filled')

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

export function currencyNewsItems(review: ThesisReview | undefined, currency: string, selectedDate: string): CurrencyNews[] {
  const view = review?.currency_views?.find(item => item.currency === currency)
  return (view?.news ?? []).filter(item => item.published_on === selectedDate)
}

export function currencyUpcoming(review: ThesisReview | undefined, currency: string) {
  if (!review) return []
  const view = review.currency_views?.find(item => item.currency === currency)
  const checkpoints = [...(view?.checkpoints ?? []), ...(view?.direction?.reassessment ? [view.direction.reassessment] : [])]
  return [...new Map(checkpoints.map(item => [`${item.title}:${item.event_at ?? item.event_date}`, item])).values()]
    .filter(item => item.event_at ? Date.parse(item.event_at) > Date.parse(review.as_of_utc) : !!item.event_date && item.event_date >= thesisDay(review.as_of_utc))
    .sort((a, b) => (a.event_at ?? a.event_date!).localeCompare(b.event_at ?? b.event_date!))
}

export function currencyNewsHeading(date: string) {
  return `${date.slice(8)}:${date.slice(5, 7)}:${date.slice(0, 4)} FUNDAMENTAL`
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
    `Research both currencies on the web; local calendar readings and saved research are optional except for identifying a named Highlight. Pure bias and release-first verdicts are fundamental-first; entry-focused modes permit bounded feedback, respecting fundamental-only/no-candles overrides. Reuse prepared context and verify decisive facts. A passed release time is not proof actuals arrived. Answer in chat using the skill's current format.\n\n` +
    `Also save the supported compact verdict, thesis change and its evidence versus the exact earlier assessment version, one or two thesis paragraphs, direct sources, actual assessment cutoff and horizon to the Thesis dock. Use change/compared_with/change_reason; weakening an existing buy/sell case does not establish the opposite case. This prompt authorizes that save. Read docs/THESIS.md and run pnpm analyst thesis read --scope ${scope} --month ${month}${broker ? ` --broker "${broker.replaceAll('"', '')}"` : ''} first. ` +
    (assessment ? `Prior context: row_id ${assessment.row_id}, using its latest expected_version only for a correction. A fresh invocation creates a standalone assessment with target null; retain the occurrence as context. ` : 'Create a standalone assessment with target null. ') +
    `Use pnpm analyst thesis append with a ThesisRequest JSON file inside Lite. Preserve the real as_of_utc and saved time; never backdate a current assessment to fit this displayed month. Use the invocation's actual cutoff; do not anchor every day to 1:00 PM. Unknown historical publication hours use as_of_precision date with an explicit conservative cutoff note. If the actual month is outside JUL/OCT, disclose that it is not yet selectable. Do not alter pins, raw calendar readings or Entry Trade notes.`
}

export function thesisPrompt(scope: string, month: string, row?: ThesisRow) {
  if (scope === 'ALL') return currencyThesisPrompt(`${month}-${String(readThesisDay(month)).padStart(2, '0')}`)
  return baseThesisPrompt(scope, month, row) + `\n\nShared review context: first run pnpm analyst thesis context --scope ${row?.scope ?? scope} to load the latest relevant review and exact prior assessment across months. For an all-currency scan also read --scope ALL. Treat this as dated context, refresh decisive web sources and seek contrary evidence.\n\nFor a fresh invocation, the earlier row/version identifiers identify comparison context: create new standalone assessment rows at the real new cutoff, then save one complete dated review using pnpm analyst thesis review-append --scope ${scope} --input <ReviewRequest.json>. Read docs/THESIS.md for the schema. Link the exact opportunity version IDs; write a short entry-focused takeaway (including lost/conditional opportunities), all five backdrop categories for every reviewed currency, original publication dates, source verification clocks and explicit gaps. Reuse still-relevant evidence without pretending it was freshly checked; the saved review is a complete snapshot. Row/review revisions are for corrections preserving the original review cutoff. Do not overwrite old dated reviews, duplicate shared backdrops per opportunity, or create scheduled upkeep. Upcoming events remain in Alert. This copied prompt authorizes the assessment and review saves. Assess Trade Now separately governs verified pins and significant Invoke reminders; preserve existing user choices.`
}

export function currencyThesisPrompt(date: string) {
  return researchPrompt(date, date)
}
