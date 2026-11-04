export const newsCurrencies = ['EUR', 'GBP', 'AUD', 'NZD', 'USD', 'CAD', 'CHF', 'JPY'] as const
export type NewsCurrency = typeof newsCurrencies[number]
export type NewsSource = { label: string; url: string }
export type NewsItem = {
  story_id?: string | null; summary: string; published_at: string | null; published_date?: string | null;
  timing_note: string; sources: NewsSource[]; bias?: NewsBias | null; reason?: string; bullish_if?: string; bearish_if?: string;
}
export type NewsResult = {
  currency: NewsCurrency; checked_at: string; coverage: 'checked' | 'partial' | 'unavailable'; coverage_note: string;
  items: NewsItem[]; background: NewsItem[]; implication: 'supportive' | 'negative' | 'mixed' | 'no_clear_signal';
  reason: string; window_hours: number | null; run_id: string; saved_at: string;
}
export type NewsRow = { currency: NewsCurrency; snapshot: NewsResult | null }
export type NewsSnapshot = { schema: 1; revision: string; rows: NewsRow[] }
export type SavedNews = NewsSnapshot & { run_id: string; saved_at: string }
export type NewsBias = 'bullish' | 'bearish' | 'conditional' | 'neutral'
export type NewsVersion = { run_id: string; assessed_at: string; collection: 'items' | 'background'; position: number }
export type NewsImplication = {
  currency: NewsCurrency; legacy: boolean; bias: NewsBias; reason: string; bullish_if: string; bearish_if: string;
  coverage_note: string; timing_note: string; versions: NewsVersion[]; selected_run?: string; pending?: boolean;
}
export type NewsStory = {
  id: string; summary: string; published_at: string | null; published_date: string;
  assessed_at: string; order_at: string; sources: NewsSource[]; implications: NewsImplication[];
}
export type NewsFeed = {
  schema: 2; date: string; revision: string; updated_at: string | null; stories: NewsStory[];
  coverage: { currency: NewsCurrency; checked_at: string; coverage: 'checked' | 'partial' | 'unavailable'; note: string }[];
}

const text = (v: unknown, max: number, empty = false): v is string => typeof v === 'string' && v.length <= max && (empty || !!v.trim())
const instant = (v: unknown): v is string => typeof v === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v))
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
function source(v: unknown): v is NewsSource {
  if (!v || typeof v !== 'object') return false
  const s = v as NewsSource
  if (!text(s.label, 160) || !text(s.url, 2000) || /\s/.test(s.url)) return false
  try { const url = new URL(s.url); return ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password } catch { return false }
}
function item(v: unknown): v is NewsItem {
  if (!v || typeof v !== 'object') return false
  const i = v as NewsItem
  return text(i.summary, 1800) && (i.published_at === null || instant(i.published_at)) && text(i.timing_note, 500, true)
    && (i.published_date === undefined || i.published_date === null || calendarDate(i.published_date))
    && (i.story_id === undefined || i.story_id === null || text(i.story_id, 160))
    && (i.bias === undefined || i.bias === null || bias(i.bias) && text(i.reason, 1800)
      && (i.bias === 'conditional' ? text(i.bullish_if, 900) && text(i.bearish_if, 900) : !i.bullish_if && !i.bearish_if))
    && Array.isArray(i.sources) && i.sources.length > 0 && i.sources.length <= 8 && i.sources.every(source)
}
export function validNewsSnapshot(v: unknown): v is NewsSnapshot {
  if (!v || typeof v !== 'object') return false
  const d = v as NewsSnapshot
  if (d.schema !== 1 || !hash(d.revision) || !Array.isArray(d.rows) || d.rows.length !== 8 || new Set(d.rows.map(r => r?.currency)).size !== 8) return false
  return d.rows.every(row => {
    if (!row || !newsCurrencies.includes(row.currency)) return false
    const s = row.snapshot
    if (s === null) return true
    if (!s || s.currency !== row.currency || !instant(s.checked_at) || !instant(s.saved_at) || !hash(s.run_id)
      || !(s.window_hours === null || Number.isInteger(s.window_hours) && s.window_hours >= 1 && s.window_hours <= 24)
      || !['checked', 'partial', 'unavailable'].includes(s.coverage) || !text(s.coverage_note, 1200, s.coverage === 'checked')
      || !['supportive', 'negative', 'mixed', 'no_clear_signal'].includes(s.implication) || !text(s.reason, 1800, s.window_hours === null)
      || !Array.isArray(s.items) || s.items.length > 12 || !s.items.every(item)
      || !Array.isArray(s.background) || s.background.length > 8 || !s.background.every(item)) return false
    const checked = Date.parse(s.checked_at), start = checked - (s.window_hours ?? 0) * 3600000
    if (!s.items.length && s.implication !== 'no_clear_signal') return false
    if (s.coverage === 'unavailable' && (s.items.length || s.implication !== 'no_clear_signal')) return false
    if (s.window_hours === null) return [...s.items, ...s.background].every(i => i.published_at === null || Date.parse(i.published_at) <= checked)
    return s.items.every(i => i.published_at !== null && Date.parse(i.published_at) >= start && Date.parse(i.published_at) <= checked)
      && s.background.every(i => i.published_at === null || Date.parse(i.published_at) < start)
  })
}

export function validSavedNews(v: unknown, id: string): v is SavedNews {
  if (!validNewsSnapshot(v)) return false
  const s = v as SavedNews
  return s.run_id === id && s.revision === id && instant(s.saved_at) && s.rows.some(r => r.snapshot)
    && s.rows.every(r => !r.snapshot || r.snapshot.run_id === id && r.snapshot.saved_at === s.saved_at)
}

const jakarta = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
export const newsTime = (value: string) => jakarta.format(new Date(value))

const calendarDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v
const bias = (v: unknown): v is NewsBias => ['bullish', 'bearish', 'conditional', 'neutral'].includes(v as string)
const jakartaDay = (v: string) => new Date(Date.parse(v) + 7 * 3600000).toISOString().slice(0, 10)
export function validNewsFeed(v: unknown, date: string): v is NewsFeed {
  if (!v || typeof v !== 'object') return false
  const f = v as NewsFeed
  if (f.schema !== 2 || f.date !== date || !calendarDate(date) || !hash(f.revision)
    || !(f.updated_at === null || instant(f.updated_at)) || !Array.isArray(f.stories) || !Array.isArray(f.coverage)) return false
  if (new Set(f.stories.map(s => s?.id)).size !== f.stories.length || new Set(f.coverage.map(c => c?.currency)).size !== f.coverage.length) return false
  return f.stories.every(s => s && text(s.id, 200) && text(s.summary, 1800) && calendarDate(s.published_date) && s.published_date === date
    && instant(s.assessed_at) && instant(s.order_at)
    && (s.published_at === null ? s.order_at === s.assessed_at : instant(s.published_at) && s.order_at === s.published_at && jakartaDay(s.published_at) === date && Date.parse(s.published_at) <= Date.parse(s.assessed_at))
    && Array.isArray(s.sources) && s.sources.length > 0 && s.sources.every(source)
    && Array.isArray(s.implications) && s.implications.length > 0 && s.implications.length <= 8
    && new Set(s.implications.map(i => i?.currency)).size === s.implications.length
    && s.implications.every(i => i && newsCurrencies.includes(i.currency) && typeof i.legacy === 'boolean' && bias(i.bias) && text(i.reason, 4000)
      && text(i.bullish_if, 900, true) && text(i.bearish_if, 900, true) && text(i.coverage_note, 1200, true) && text(i.timing_note, 500, true)
      && (i.legacy || (i.bias === 'conditional' ? !!i.bullish_if.trim() && !!i.bearish_if.trim() : !i.bullish_if && !i.bearish_if))
      && Array.isArray(i.versions) && i.versions.length > 0 && new Set(i.versions.map(p => p?.run_id)).size === i.versions.length
      && i.versions.every(p => p && hash(p.run_id) && instant(p.assessed_at) && ['items', 'background'].includes(p.collection) && Number.isInteger(p.position) && p.position >= 0)))
    && f.coverage.every(c => c && newsCurrencies.includes(c.currency) && instant(c.checked_at)
      && ['checked', 'partial', 'unavailable'].includes(c.coverage) && text(c.note, 1200, c.coverage === 'checked'))
}

const dayFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
export const storyDate = (story: NewsStory) => story.published_at ? newsTime(story.published_at) : dayFormat.format(new Date(story.published_date + 'T00:00:00Z'))
export function newsAge(at: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(at)) / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  const hours = Math.floor(minutes / 60), rest = minutes % 60
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}${rest ? ` ${rest} ${rest === 1 ? 'minute' : 'minutes'}` : ''} ago`
}

export function refreshPrompt(scope: NewsCurrency | 'ALL') {
  return `Use $assess-trade-now to refresh ${scope === 'ALL' ? 'all eight currencies (EUR, GBP, AUD, NZD, USD, CAD, CHF, JPY)' : scope} in Currency News. Prioritize the newest material developments and relevant earlier context, without a fixed lookback cutoff. Verify source bodies and publication dates, consolidate duplicate coverage with a stable story_id, and give each material follow-up its own story_id and dated row. Keep source-faithful headlines or concise factual summaries in items; put all agent interpretation and coverage caveats in the per-currency implication. Use bullish or bearish bias when supported; otherwise give explicit bullish_if and bearish_if scenarios with conditional bias, or neutral when no direction is supported. Save published_at when known, published_date in Jakarta when only the date is known, and null for genuinely unknown publication timing; assessment time supplies ordering and age only, never an invented publication time. File stories on their publication date, falling back to assessment date only when the date is also unknown. Do not renew old facts as fresh. Save only researched currencies without window_hours using pnpm analyst news save --scope ${scope} --input <file>, then read back pnpm analyst news read --scope ${scope} and verify panel delivery. Also follow the skill's global risk workflow: review ongoing risks and the next seven days across currencies, prioritize 48 hours, maintain globally visible custom events, and curate new confirmed high-impact reminders while preserving off choices, pause, lead time and chart hides. Fundamentals only; leave technical levels to the user. No automatic pair selection, D1 forecasts, price scans or outcome scoring.`
}
