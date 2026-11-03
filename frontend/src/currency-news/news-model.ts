export const newsCurrencies = ['EUR', 'GBP', 'AUD', 'NZD', 'USD', 'CAD', 'CHF', 'JPY'] as const
export type NewsCurrency = typeof newsCurrencies[number]
export type NewsSource = { label: string; url: string }
export type NewsItem = { summary: string; published_at: string | null; timing_note: string; sources: NewsSource[] }
export type NewsResult = {
  currency: NewsCurrency; checked_at: string; coverage: 'checked' | 'partial' | 'unavailable'; coverage_note: string;
  items: NewsItem[]; background: NewsItem[]; implication: 'supportive' | 'negative' | 'mixed' | 'no_clear_signal';
  reason: string; window_hours: number; run_id: string; saved_at: string;
}
export type NewsRow = { currency: NewsCurrency; snapshot: NewsResult | null }
export type NewsSnapshot = { schema: 1; revision: string; rows: NewsRow[] }
export type SavedNews = NewsSnapshot & { run_id: string; saved_at: string }
export type NewsHistoryEntry = { run_id: string; saved_at: string; currencies: NewsCurrency[] }
export type NewsHistory = { schema: 1; date: string; runs: NewsHistoryEntry[]; next_before: string | null }

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
  return text(i.summary, 1800) && (i.published_at === null ? text(i.timing_note, 500) : instant(i.published_at)) && text(i.timing_note, 500, true)
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
      || !Number.isInteger(s.window_hours) || s.window_hours < 1 || s.window_hours > 24
      || !['checked', 'partial', 'unavailable'].includes(s.coverage) || !text(s.coverage_note, 1200, s.coverage === 'checked')
      || !['supportive', 'negative', 'mixed', 'no_clear_signal'].includes(s.implication) || !text(s.reason, 1800)
      || !Array.isArray(s.items) || s.items.length > 12 || !s.items.every(item)
      || !Array.isArray(s.background) || s.background.length > 8 || !s.background.every(item)) return false
    const checked = Date.parse(s.checked_at), start = checked - s.window_hours * 3600000
    if (!s.items.length && s.implication !== 'no_clear_signal') return false
    if (s.coverage === 'unavailable' && (s.items.length || s.implication !== 'no_clear_signal')) return false
    return s.items.every(i => i.published_at !== null && Date.parse(i.published_at) >= start && Date.parse(i.published_at) <= checked)
      && s.background.every(i => i.published_at === null || Date.parse(i.published_at) < start)
  })
}

export function validNewsHistory(v: unknown, date: string): v is NewsHistory {
  if (!v || typeof v !== 'object') return false
  const h = v as NewsHistory
  return h.schema === 1 && h.date === date && Array.isArray(h.runs) && h.runs.length <= 100
    && h.runs.every(r => r && hash(r.run_id) && instant(r.saved_at)
      && new Date(Date.parse(r.saved_at) + 7 * 3600000).toISOString().slice(0, 10) === date
      && Array.isArray(r.currencies) && r.currencies.length > 0 && r.currencies.length <= 8
      && new Set(r.currencies).size === r.currencies.length && r.currencies.every(c => newsCurrencies.includes(c)))
    && new Set(h.runs.map(r => r.run_id)).size === h.runs.length
    && (h.next_before === null || h.runs.length > 0 && h.next_before === h.runs.at(-1)?.run_id)
}

export function validSavedNews(v: unknown, id: string): v is SavedNews {
  if (!validNewsSnapshot(v)) return false
  const s = v as SavedNews
  return s.run_id === id && s.revision === id && instant(s.saved_at) && s.rows.some(r => r.snapshot)
    && s.rows.every(r => !r.snapshot || r.snapshot.run_id === id && r.snapshot.saved_at === s.saved_at)
}

const jakarta = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
export const newsTime = (value: string) => jakarta.format(new Date(value))

export function refreshPrompt(scope: NewsCurrency | 'ALL', hours: number) {
  return `Use $assess-trade-now to refresh ${scope === 'ALL' ? 'all eight currencies (EUR, GBP, AUD, NZD, USD, CAD, CHF, JPY)' : scope} in Currency News. Search publications from the last ${hours} hours measured at the actual source-check time. Verify material source bodies, consolidate duplicate reporting, and check contrary news. Keep older background separately dated. Distinguish no qualifying news from incomplete or inaccessible coverage. Save only researched currencies with window_hours=${hours} using pnpm analyst news save --scope ${scope} --input <file>, then read back pnpm analyst news read --scope ${scope} and verify the saved panel API contract. Give concise facts, a qualitative fundamental implication with its reason, and direct sources. Do not generate pair recommendations, D1 forecasts, outcome scores, price scans or reminder changes as part of this news refresh.`
}
