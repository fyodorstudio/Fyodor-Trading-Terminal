import { dailyVerdicts, reviewCurrencies, safeThesisLink, thesisDay, type CurrencyCheckpoint, type DailyDirection } from './thesis-model'

export type CurrencySummarySnapshot = { schema: 1; revision: string; review_id: string | null; as_of_utc: string | null;
  rows: { currency: string; verdict: DailyDirection['verdict'] | null; verified_utc: string | null;
    reassessment: CurrencyCheckpoint | null; reassessment_gap: string }[] }

const instant = (value: unknown): value is string => typeof value === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value))
export function validCurrencySummary(value: unknown): value is CurrencySummarySnapshot {
  if (!value || typeof value !== 'object') return false
  const item = value as CurrencySummarySnapshot
  return item.schema === 1 && typeof item.revision === 'string'
    && (item.review_id === null ? item.as_of_utc === null : typeof item.review_id === 'string' && instant(item.as_of_utc))
    && Array.isArray(item.rows) && item.rows.length === 8 && item.rows.every((row, index) => row && row.currency === reviewCurrencies[index]
      && (row.verdict === null ? row.verified_utc === null && row.reassessment === null
        : item.review_id !== null && dailyVerdicts.includes(row.verdict) && instant(row.verified_utc))
      && typeof row.reassessment_gap === 'string' && (row.reassessment === null || validCheckpoint(row.reassessment, item.as_of_utc)))
}

function validCheckpoint(item: CurrencyCheckpoint, cutoff: string | null) {
  return item && cutoff !== null && typeof item.title === 'string' && !!item.title.trim()
    && typeof item.note === 'string' && !!item.note.trim() && instant(item.verified_utc)
    && (item.event_at === null ? typeof item.event_date === 'string' && /^\d{4}-\d\d-\d\d$/.test(item.event_date) && item.event_date >= thesisDay(cutoff)
      : instant(item.event_at) && item.event_date === null && Date.parse(item.event_at) > Date.parse(cutoff))
    && Array.isArray(item.sources) && item.sources.length > 0 && item.sources.some(source => source?.kind === 'web')
    && item.sources.every(source => source && typeof source.label === 'string' && typeof source.note === 'string'
      && typeof source.locator === 'string' && (source.kind === 'local' || source.kind === 'web' && safeThesisLink(source.locator)))
}

const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', month: 'short', day: 'numeric' })
export function currencyUntil(checkpoint: CurrencyCheckpoint | null, now: number) {
  if (!checkpoint) return { label: 'Review not set', due: false }
  if (!checkpoint.event_at) {
    const due = thesisDay(new Date(now).toISOString()) >= checkpoint.event_date!
    return { label: `${checkpoint.title} · ${day.format(new Date(checkpoint.event_date + 'T05:00:00Z'))} · hour unknown${due ? ' · Review due' : ''}`, due }
  }
  const remaining = Date.parse(checkpoint.event_at) - now
  if (remaining <= 0) return { label: `${checkpoint.title} · Review due`, due: true }
  const minutes = Math.ceil(remaining / 60000), days = Math.floor(minutes / 1440), hours = Math.floor(minutes % 1440 / 60)
  const duration = days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`
  return { label: `${checkpoint.title} in ${duration}`, due: false }
}
