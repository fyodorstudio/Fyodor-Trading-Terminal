import type { StoredCalendarEvent } from '../../economic-calendar/storage/useStoredCalendar'
import type { InspectorRelease } from '../../economic-calendar/releases/release'
import { groupInspectorReleases } from '../../inspector/releases/group-releases'
import { selectedPackageSeries } from '../../inspector/episodes/display-episodes'
import type { ExternalSource } from '../../external-sources/external-source-model'
import type { AlertPreferences } from './alert-preferences'

export const dayMs = 86400000
export function jakartaDate(at: number) { return new Date(at + 7 * 3600000).toISOString().slice(0, 10) }
export function moveDate(date: string, days: number) { return new Date(Date.parse(`${date}T00:00:00Z`) + days * dayMs).toISOString().slice(0, 10) }
export function externalDate(item: ExternalSource) {
  return item.event_at ? jakartaDate(Date.parse(item.event_at)) : item.event_date ?? (item.published_utc ? jakartaDate(Date.parse(item.published_utc)) : null)
}
export function publisherName(source: ExternalSource['sources'][number]) {
  if (source.kind === 'web') {
    try {
      const host = new URL(source.locator).hostname.replace(/^www\./, '')
      const known: Record<string, string> = { 'reuters.com': 'Reuters', 'federalreserve.gov': 'Federal Reserve', 'bls.gov': 'BLS',
        'bea.gov': 'BEA', 'bankofengland.co.uk': 'Bank of England', 'ecb.europa.eu': 'ECB', 'boj.or.jp': 'Bank of Japan',
        'rba.gov.au': 'RBA', 'rbnz.govt.nz': 'RBNZ', 'snb.ch': 'SNB', 'bankofcanada.ca': 'Bank of Canada', 'treasury.gov': 'US Treasury' }
      return Object.entries(known).find(([domain]) => host === domain || host.endsWith(`.${domain}`))?.[1] ?? host
    } catch { /* Validated collections provide safe links; retain a truthful label if malformed. */ }
  }
  return source.label || 'Local evidence'
}
export type AlertDayGroup = { key: string; title: string; currency: string; at: number | null; release?: InspectorRelease;
  valueIds: string[]; external: ExternalSource[] }
export function dayGroups(events: StoredCalendarEvent[], outside: ExternalSource[], selectedDate: string, sourceId: string,
  preferences: Pick<AlertPreferences, 'families' | 'currency'>): AlertDayGroup[] {
  // Keep stages separate; a CPI package shares one clock and one bell.
  const groups: AlertDayGroup[] = groupInspectorReleases(events, false, 'publication').flatMap(original => {
    const release = selectedPackageSeries(original, preferences.families)
    if (!release || !preferences.families.includes(release.familyId) && !release.familyIds?.some(id => preferences.families.includes(id))
      || preferences.currency !== 'all' && release.currency !== preferences.currency) return []
    return [{ key: `calendar:${original.id}`, title: release.label, currency: release.currency,
      at: release.timingUncertain ? null : release.releaseAt, release, valueIds: original.events.map(event => event.value_id), external: [] }]
  })
  for (const item of outside) {
    if (externalDate(item) !== selectedDate || preferences.currency !== 'all' && !item.currencies.includes(preferences.currency)) continue
    const at = item.kind === 'scheduled' ? item.status === 'confirmed' && item.event_at ? Date.parse(item.event_at) : null
      : item.event_at || item.published_utc ? Date.parse(item.event_at ?? item.published_utc!) : null
    const reference = item.calendar_reference
    // Only explicit exact-ID links may join sources. Same-time or similar text is insufficient.
    const matches = item.kind === 'scheduled' && item.status === 'confirmed' && reference?.source_id === sourceId && at !== null ? groups.filter(group => group.at === at
      && item.currencies.includes(group.currency) && reference.value_ids.every(id => group.valueIds.includes(id))) : []
    if (matches.length === 1) matches[0].external.push(item)
    else groups.push({ key: `external:${item.key}`, title: item.title, currency: [...item.currencies, ...(item.instruments ?? [])].join(' / '), at,
      valueIds: [], external: [item] })
  }
  return groups.sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity) || a.title.localeCompare(b.title) || a.key.localeCompare(b.key))
}
