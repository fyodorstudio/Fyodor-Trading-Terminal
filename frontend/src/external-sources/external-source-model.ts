import { majorCurrencies } from '../economic-calendar/forex/currencies'
import { commodityIds, type Commodity } from './research-instruments'

export type ExternalSource = {
  id: string; key: string; title: string; currencies: string[]; instruments?: Commodity[]
  kind: 'scheduled' | 'headline' | 'watch'; status: 'confirmed' | 'reported' | 'unverified'
  facts: string; interpretation: string; event_at: string | null; event_date: string | null
  published_utc: string | null; time_note: string; saved_utc: string; archived: boolean
  sources: { kind: 'web' | 'local'; label: string; locator: string; note: string }[]
  expected_version: string | null; version_count?: number
  chart_icon_request_id?: string | null
  calendar_reference?: { source_id: string; value_ids: string[] } | null
}
export function validExternalItems(value: unknown): value is ExternalSource[] {
  const at = (value: unknown) => value === null || typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
  return Array.isArray(value) && value.every(item => {
    if (!item || typeof item !== 'object') return false
    const entry = item as ExternalSource
    return /^[0-9a-f]{32}$/.test(entry.id) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.key)
      && ['title', 'facts', 'interpretation', 'time_note'].every(key => typeof entry[key as keyof ExternalSource] === 'string')
      && Array.isArray(entry.currencies) && entry.currencies.every(currency => majorCurrencies.some(value => value === currency))
      && (entry.instruments === undefined || Array.isArray(entry.instruments) && entry.instruments.every(id => commodityIds.includes(id)) && new Set(entry.instruments).size === entry.instruments.length)
      && (entry.currencies.length > 0 || !!entry.instruments?.length)
      && ['scheduled', 'headline', 'watch'].includes(entry.kind) && ['confirmed', 'reported', 'unverified'].includes(entry.status)
      && [entry.event_at, entry.published_utc].every(at) && typeof entry.saved_utc === 'string' && at(entry.saved_utc)
      && (entry.chart_icon_request_id == null || typeof entry.chart_icon_request_id === 'string' && /^[0-9a-f]{32}$/.test(entry.chart_icon_request_id))
      && (entry.calendar_reference == null || /^Pepperstone-[A-Za-z0-9._-]+$/.test(entry.calendar_reference.source_id)
        && Array.isArray(entry.calendar_reference.value_ids) && entry.calendar_reference.value_ids.length > 0
        && entry.calendar_reference.value_ids.every(value => typeof value === 'string' && /^\d+$/.test(value)))
      && (entry.event_date === null || typeof entry.event_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.event_date))
      && typeof entry.archived === 'boolean' && Array.isArray(entry.sources) && entry.sources.length > 0
      && entry.sources.every(source => source && ['web', 'local'].includes(source.kind) && typeof source.label === 'string'
        && typeof source.locator === 'string' && typeof source.note === 'string'
        && (source.kind !== 'web' || safeWebUrl(source.locator)))
  })
}
export function safeWebUrl(value: string) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password } catch { return false }
}
