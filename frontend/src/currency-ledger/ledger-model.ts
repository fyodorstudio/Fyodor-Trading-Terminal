import { detailValue, type DetailReading } from '../currency-details/detail-model'
import { isMajorCurrency } from '../economic-calendar/forex/currencies'

export type LedgerEntry = DetailReading & { day: string; known_at: number; impact?: 'none' | 'positive' | 'negative' }
export type LedgerMetric = { id: string; currency: string; category: string; label: string; unit: string
  definition: string; frequency: string; source_url: string; entries: LedgerEntry[]; canonical?: boolean; country?: string | null; event_id?: string | null }
export type LedgerData = { schema: 1; broker: string; revision: string; currencies: string[]
  from_date: string; through_date: string; year: number; min_year: number; max_year: number; metrics: LedgerMetric[]
  source_available?: boolean; coverage?: Record<string, { missing: number[][] }> }
export type LedgerSelection = { at: number | null; currency: string; category: string | null }
export type LedgerViewMemory = { tape: Map<string, { left: number; top: number; day: string; request: number }>; cells: Map<string, number> }

export const ledgerCategories = [
  { id: 'policy', label: 'Rates', metrics: ['rate'], scored: ['rate'], negative: [] },
  { id: 'inflation', label: 'Inflation', metrics: ['cpi-yoy', 'cpi-mom', 'core-yoy', 'core-mom', 'pce-yoy', 'pce-mom', 'trim', 'median'], scored: [], negative: [] },
  { id: 'labour', label: 'Labor & wages', metrics: ['unemployment', 'payrolls', 'employment', 'earnings'], scored: ['unemployment', 'payrolls', 'employment'], negative: ['unemployment'] },
  { id: 'growth', label: 'Growth & activity', metrics: ['gdp', 'gdp-quarter', 'services', 'manufacturing'], scored: ['gdp', 'gdp-quarter'], negative: [] },
  { id: 'consumer', label: 'Demand', metrics: ['retail', 'control'], scored: ['retail'], negative: [] },
]
export const ledgerDay = (at: number) => new Date(at + 7 * 3600_000).toISOString().slice(0, 10)
export const ledgerDayEnd = (day: string) => Date.parse(day + 'T23:59:59.999+07:00')
const releaseTime = (e: LedgerEntry) => e.at ?? ledgerDayEnd(e.day)
const suffix = (m: LedgerMetric) => m.id.slice(4)

// A first retained actual may be a backfill. Reconstruction permits it with an
// explicit flag. Later corrections only take effect when captured, never earlier.
function availableReadings(metric: LedgerMetric, at: number, includeNonNumeric = false) {
  const groups = new Map<string, LedgerEntry[]>()
  for (const e of metric.entries) if (includeNonNumeric || e.value !== null) {
    const group = groups.get(e.value_id) ?? []
    group.push(e); groups.set(e.value_id, group)
  }
  const eligible: { entry: LedgerEntry; backfilled: boolean; effective: number }[] = []
  for (const group of groups.values()) {
    const actuals=group.filter(e=>e.value!==null)
    const entries=(actuals.length?actuals:group).slice().sort((a,b)=>a.known_at-b.known_at)
    const captured = entries.filter(e => e.known_at <= at && releaseTime(e) <= at)
    const entry = captured.at(-1) ?? (releaseTime(entries[0]) <= at ? entries[0] : null)
    if (entry) eligible.push({ entry, backfilled: entry.known_at > at,
      effective: Math.max(releaseTime(entry), entry.known_at <= at ? entry.known_at : 0) })
  }
  return eligible
}

export function ledgerPublications(metric: LedgerMetric, at: number) {
  return availableReadings(metric, at, true).sort((a, b) => releaseTime(a.entry) - releaseTime(b.entry)
    || a.entry.value_id.localeCompare(b.entry.value_id))
}
export function ledgerReading(metric: LedgerMetric, at: number) {
  const eligible = availableReadings(metric, at)
  // New reference periods supersede old-period revisions. Never revive an older
  // month merely because its correction was captured after the new publication.
  eligible.sort((a, b) => (a.entry.period ?? a.entry.day).localeCompare(b.entry.period ?? b.entry.day)
    || releaseTime(a.entry) - releaseTime(b.entry) || a.effective - b.effective || a.entry.value_id.localeCompare(b.entry.value_id))
  return eligible.at(-1) ?? null
}

export function ledgerCards(data: LedgerData, at: number) {
  return data.currencies.map(currency => {
    const categories = ledgerCategories.map(category => {
      const metrics = data.metrics.filter(m => m.currency === currency && m.canonical !== false
        && (category.id === 'growth' ? ['growth','activity'].includes(m.category) : m.category === category.id))
      const rows = metrics.map(metric => {
        const selected = ledgerReading(metric, at), entry = selected?.entry
        const previous = entry?.revised_previous ?? entry?.previous ?? null
        const direction = entry?.value != null && previous != null ? Math.sign(Math.round((entry.value - previous) * 1e6)) : null
        const name = suffix(metric)
        // Monthly GDP stays context; each country scores its defined quarterly
        // series' direction without comparing incompatible national magnitudes.
        const growthMeasure = ['CAD','GBP'].includes(currency) ? 'gdp-quarter' : 'gdp'
        const scored = category.id === 'growth' ? name === growthMeasure
          : category.id === 'consumer' ? ['retail','spending'].includes(name) : category.scored.includes(name)
        const score = scored && direction !== null ? 50 + 50 * direction * (category.negative.includes(name) ? -1 : 1) : null
        return { metric, selected, entry, previous, direction, score,
          change: entry ? `${detailValue(previous, metric.unit)} → ${detailValue(entry.value, metric.unit)}` : 'Unassessed' }
      })
      const scores = rows.flatMap(r => r.score === null ? [] : [r.score])
      const score = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
      const expected = category.id === 'labour' ? Math.max(1,metrics.filter(m=>['unemployment','payrolls','employment'].includes(suffix(m))).length) : category.id === 'inflation' ? 0 : 1
      return { ...category, rows, score, assessed: scores.length, expected }
    })
    const assessed = categories.filter(c => c.score !== null)
    return { currency, categories, score: assessed.length ? assessed.reduce((sum, c) => sum + c.score!, 0) / assessed.length : null,
      assessed: assessed.length, backfilled: categories.some(c => c.rows.some(r => r.selected?.backfilled)) }
  })
}

export function validLedger(value: unknown, broker: string, year?: number, currencies?: readonly string[]): value is LedgerData {
  if (!value || typeof value !== 'object') return false
  const v = value as LedgerData
  const day = (s: unknown) => typeof s === 'string' && /^\d{4}-\d\d-\d\d$/.test(s) && Number.isFinite(Date.parse(s))
  const number = (n: unknown) => n === null || typeof n === 'number' && Number.isFinite(n)
  const url = (s: string) => { try { const u = new URL(s); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password } catch { return false } }
  return v.schema === 1 && v.broker === broker && /^[a-f0-9]{64}$/.test(v.revision)
    && Number.isInteger(v.year) && Number.isInteger(v.min_year) && Number.isInteger(v.max_year)
    && v.min_year >= 2015 && v.year >= v.min_year && v.year <= v.max_year && v.max_year <= 2100 && (year === undefined || v.year === year)
    && v.from_date === `${v.year}-01-01` && v.through_date === `${v.year}-12-31`
    && Array.isArray(v.currencies) && v.currencies.length>0 && new Set(v.currencies).size===v.currencies.length && v.currencies.every(isMajorCurrency)
    && (!currencies || v.currencies.join(',')===currencies.join(',')) && day(v.from_date) && day(v.through_date) && v.from_date <= v.through_date
    && (v.source_available===undefined || typeof v.source_available==='boolean')
    && (v.coverage===undefined || !!v.coverage && typeof v.coverage==='object' && Object.entries(v.coverage).every(([currency,c])=>v.currencies.includes(currency)
      && !!c && Array.isArray(c.missing) && c.missing.every(interval=>Array.isArray(interval)&&interval.length===2&&interval.every(Number.isFinite)&&interval[0]<=interval[1])))
    && Array.isArray(v.metrics) && new Set(v.metrics.map(m => m?.id)).size === v.metrics.length && v.metrics.every(m => m && v.currencies.includes(m.currency)
      && typeof m.id === 'string' && m.id.startsWith(m.currency.toLowerCase() + '.') && ['label', 'unit', 'definition', 'frequency', 'category'].every(k => typeof m[k as keyof LedgerMetric] === 'string')
      && (m.canonical===undefined || typeof m.canonical==='boolean') && (m.country===undefined || m.country===null || typeof m.country==='string')
      && (m.event_id===undefined || m.event_id===null || typeof m.event_id==='string')
      && url(m.source_url) && Array.isArray(m.entries) && m.entries.every(e => e && typeof e.value_id === 'string' && !!e.value_id && typeof e.event_id === 'string' && typeof e.name === 'string'
        && day(e.day) && day(e.date) && (e.period === null || day(e.period)) && Number.isFinite(e.known_at) && Number.isFinite(Date.parse(e.captured_at))
        && (e.impact===undefined || ['none','positive','negative'].includes(e.impact))
        && ['value', 'previous', 'revised_previous', 'forecast', 'at'].every(k => number(e[k as keyof LedgerEntry]))))
}
