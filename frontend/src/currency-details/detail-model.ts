import { isEventTier, type EventTier } from '../event-tiers/event-tiers'
export type DetailSource = { label: string; url: string }
type Stage = 'flash' | 'preliminary' | 'advance' | 'second' | 'final' | 'revised' | 'decision' | 'regular'
export type DetailReading = {
  value_id: string; event_id: string; period: string | null; name: string; value: number | null
  forecast: number | null; previous: number | null; revised_previous: number | null
  at: number | null; date: string; availability: string; captured_at: string
}
export type DetailSchedule = { stage: Stage; period: string | null; at: string | null; date: string; sources: DetailSource[]; note: string }
type Observation = { period: string; stage: Stage; value: number; lower: number | null; released_at: string | null
  released_date: string; verified_at: string; sources: DetailSource[]; note: string
  broker_reference: { source_id: string; value_id: string; basis_note: string } | null }
export type DetailMetric = {
  id: string; currency: string; category: string; label: string; tier: EventTier; frequency: string
  unit: string; definition: string; source: string; source_url?: string; broker: DetailReading | null; broker_next: DetailReading | null
  official: Observation | null; official_latest: boolean
  comparison: 'not_checked' | 'different_period' | 'different_vintage' | 'conflict' | 'matched'
  next_releases: DetailSchedule[]; schedule_known: boolean; schedule_elapsed: boolean
  check: { checked_at: string; coverage: 'checked' | 'partial' | 'unavailable'; coverage_note: string
    sources: DetailSource[]; schedule_checked_at: string | null } | null
}
export type DetailSnapshot = { schema: 1; broker: string; currencies: string[]; revision: string; source_available: boolean
  categories: { id: string; label: string }[]; sources: Record<string, DetailSource & { schedule_url: string }>
  metrics: DetailMetric[]; focus: { currency: string; label: string; reason: string; limitations: string; assessed_at: string; sources: DetailSource[] }[]
  policy_history: { from_date: string; through_date: string; decisions: Record<string, (DetailReading & { source_url: string })[]> } | null }

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n)
const text = (s: unknown): s is string => typeof s === 'string' && !!s.trim()
const day = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
  && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s
const instant = (s: unknown) => typeof s === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(s) && Number.isFinite(Date.parse(s))
const nullable = (value: unknown, check: (v: unknown) => boolean) => value === null || check(value)
const url = (s: unknown) => {
  if (!text(s)) return false
  try { const u = new URL(s); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password && !/\s/.test(s) } catch { return false }
}
const sources = (s: unknown) => Array.isArray(s) && s.length > 0 && s.every(v => record(v) && text(v.label) && url(v.url))
const stages = ['flash', 'preliminary', 'advance', 'second', 'final', 'revised', 'decision', 'regular']
function reading(v: unknown) {
  return record(v) && text(v.value_id) && text(v.event_id) && text(v.name) && nullable(v.period, day)
    && ['value', 'forecast', 'previous', 'revised_previous'].every(k => nullable(v[k], finite))
    && nullable(v.at, finite) && day(v.date) && text(v.availability) && instant(v.captured_at)
}
function schedule(v: unknown) {
  return record(v) && stages.includes(v.stage as string) && nullable(v.period, day) && nullable(v.at, instant)
    && day(v.date) && sources(v.sources) && typeof v.note === 'string'
}
export function validDetail(value: unknown, broker: string, currencies: readonly string[]): value is DetailSnapshot {
  if (!record(value) || value.schema !== 1 || value.broker !== broker || !Array.isArray(value.currencies)
    || value.currencies.join(',') !== currencies.join(',') || !/^[a-f0-9]{64}$/.test(String(value.revision))
    || typeof value.source_available !== 'boolean' || !Array.isArray(value.categories)
    || value.categories.length !== 6 || !value.categories.every(c => record(c) && text(c.id) && text(c.label))
    || !record(value.sources) || !Object.values(value.sources).every(s => record(s) && text(s.label) && url(s.url) && url(s.schedule_url))
    || !Array.isArray(value.metrics) || !Array.isArray(value.focus)) return false
  const categories = value.categories.map(c => c.id)
  const history = value.policy_history
  if (history !== null) {
    if (!record(history) || !day(history.from_date) || !day(history.through_date) || history.from_date > history.through_date
      || currencies.length !== 2 || !currencies.includes('USD') || !currencies.includes('CAD')
      || !record(history.decisions) || Object.keys(history.decisions).sort().join(',') !== 'CAD,USD') return false
    for (const currency of currencies) {
      const rows = history.decisions[currency]
      if (!Array.isArray(rows) || !rows.every(r => reading(r) && record(r) && finite(r.value) && url(r.source_url))
        || new Set(rows.map(r => r.value_id)).size !== rows.length) return false
    }
  }
  const ids = new Set()
  for (const m of value.metrics) {
    if (!record(m) || !text(m.id) || ids.has(m.id) || !currencies.includes(m.currency as string)
      || !categories.includes(m.category) || !isEventTier(m.tier)
      || !text(m.label) || !text(m.definition) || !text(m.source) || !(m.source in value.sources)
      || (m.source_url !== undefined && !url(m.source_url))
      || !text(m.frequency) || typeof m.unit !== 'string' || typeof m.official_latest !== 'boolean'
      || !['not_checked', 'different_period', 'different_vintage', 'conflict', 'matched'].includes(m.comparison as string)
      || !nullable(m.broker, reading) || !nullable(m.broker_next, reading)
      || typeof m.schedule_known !== 'boolean' || typeof m.schedule_elapsed !== 'boolean'
      || !Array.isArray(m.next_releases) || !m.next_releases.every(schedule)) return false
    ids.add(m.id)
    const o = m.official
    if (o !== null && (!record(o) || !day(o.period) || !stages.includes(o.stage as string) || !finite(o.value)
      || !nullable(o.lower, finite) || !nullable(o.released_at, instant) || !day(o.released_date) || !instant(o.verified_at)
      || !sources(o.sources) || typeof o.note !== 'string' || !nullable(o.broker_reference, r => record(r)
        && text(r.source_id) && text(r.value_id) && text(r.basis_note)))) return false
    const c = m.check
    if (c !== null && (!record(c) || !instant(c.checked_at) || !['checked', 'partial', 'unavailable'].includes(c.coverage as string)
      || typeof c.coverage_note !== 'string' || !sources(c.sources) || !nullable(c.schedule_checked_at, instant))) return false
    if (m.official_latest && !o || m.comparison === 'conflict' && (!o || !m.broker)) return false
  }
  return new Set(value.focus.map(f => f.currency)).size === value.focus.length && value.focus.every(f => record(f)
    && currencies.includes(f.currency as string) && text(f.label) && text(f.reason) && text(f.limitations)
    && instant(f.assessed_at) && sources(f.sources))
}

export function detailValue(value: number | null | undefined, unit: string, lower?: number | null) {
  if (value == null) return '—'
  const number = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 3 })
  return `${lower == null ? '' : number(lower) + '–'}${number(value)}${unit}`
}

export function detailRefreshPrompt(scope: string) {
  return `Use $assess-trade-now to refresh Currency News and Detail for ${scope}. Start with pnpm analyst details prepare --scope ${scope}; reuse its source routes and current evidence. Verify new official observations, revisions, next release stages and any MT5 conflicts. Preserve independent metric/news/focus clocks and other currencies. Reuse each decisive source across both panels. Follow the existing global risk workflow. Do not scan prices or change raw MT5 observations.`
}
