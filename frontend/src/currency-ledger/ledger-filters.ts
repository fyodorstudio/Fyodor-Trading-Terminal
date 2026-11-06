import { calendarTier, eventTiers, isEventTier, type EventTier } from '../event-tiers/event-tiers'
import { inspectorFamilies, inspectorFamilyForEvent } from '../inspector/catalog/inspector-families'
import { majorCurrencies } from '../economic-calendar/forex/currencies'
import type { LedgerMetric } from './ledger-model'

export type LedgerFilters = { tiers: EventTier[]; families: string[] }
export const ledgerFilterStorageKey = 'fyodor.ledger.filters.v1'
export function defaultLedgerFilters(): LedgerFilters {
  return { tiers: ['S', 'A', 'B'], families: inspectorFamilies.map(f => f.id) }
}
export function readLedgerFilters(): LedgerFilters {
  const defaults = defaultLedgerFilters()
  try {
    const saved = JSON.parse(localStorage.getItem(ledgerFilterStorageKey) ?? 'null')
    if (saved?.version !== 1 || !Array.isArray(saved.tiers) || !saved.tiers.every(isEventTier)
      || !saved.currencies || typeof saved.currencies !== 'object' || Array.isArray(saved.currencies)) return defaults
    return { tiers: eventTiers.filter(t => saved.tiers.includes(t.id)).map(t => t.id),
      families: inspectorFamilies.filter(f => !Array.isArray(saved.currencies[f.currency]) || saved.currencies[f.currency].includes(f.id)).map(f => f.id) }
  } catch { return defaults }
}
export function saveLedgerFilters(next: LedgerFilters, currencies: readonly string[]) {
  const previous = readLedgerFilters(), selected = new Set(next.families), retained = new Set(previous.families)
  const merged = { tiers: eventTiers.filter(t => next.tiers.includes(t.id)).map(t => t.id),
    families: inspectorFamilies.filter(f => (currencies.includes(f.currency) ? selected : retained).has(f.id)).map(f => f.id) }
  localStorage.setItem(ledgerFilterStorageKey, JSON.stringify({ version: 1, tiers: merged.tiers,
    currencies: Object.fromEntries(majorCurrencies.map(c => [c, inspectorFamilies.filter(f => f.currency === c && merged.families.includes(f.id)).map(f => f.id)])) }))
  return merged
}
export function createLedgerFilter(filters: LedgerFilters) {
  const tiers = new Set(filters.tiers), families = new Set(filters.families)
  return (metric: LedgerMetric) => {
    const identity = { currency: metric.currency, country_code: metric.country ?? '', event_id: metric.event_id ?? metric.entries[0]?.event_id ?? '' }
    const family = inspectorFamilyForEvent(identity)
    // Unclassified/mismatched identities remain C. All events can still reveal
    // the retained raw record through its currency's Other family.
    return tiers.has(calendarTier(identity)) && families.has(family?.id ?? `${metric.currency.toLowerCase()}-other`)
  }
}
