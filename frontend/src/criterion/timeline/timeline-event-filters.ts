import { defaultFamilySymbol, eventFamilyOptions, isCuratedFamily, sixEventFamilies } from './timeline-event-families'
import type { EventSymbol, TimelineEventGroup } from './timeline-event-view'

// This audited viewer is EURUSD. Currency role colours never encode direction.
export const pairCurrencySides = [
  { id: 'base', currency: 'EUR', label: 'EUR · Base' },
  { id: 'quote', currency: 'USD', label: 'USD · Quote' },
  { id: 'other', currency: '', label: 'Other currencies' },
] as const
export type EventCurrencySide = typeof pairCurrencySides[number]['id']
export const defaultCurrencySides: EventCurrencySide[] = ['base', 'quote']
export const defaultEventFamilies = [...sixEventFamilies, 'ecb', 'euro-inflation']
export type EventFamilyOption = { id: string; label: string; currency: string; symbol: EventSymbol; count: number; curated: boolean }

export function eventCurrencySide(currency: string): EventCurrencySide {
  return pairCurrencySides.find((side) => side.currency === currency && side.id !== 'other')?.id ?? 'other'
}
export function isCurrencySide(value: unknown): value is EventCurrencySide {
  return pairCurrencySides.some((side) => side.id === value)
}
export function eventFamilyKey(group: TimelineEventGroup): string {
  return group.familyId ?? `source:${JSON.stringify([group.countryCode, group.currency, group.family])}`
}
export function isFamilySelection(value: unknown): value is string {
  if (isCuratedFamily(value)) return true
  if (typeof value !== 'string' || !value.startsWith('source:')) return false
  try {
    const parts: unknown = JSON.parse(value.slice(7))
    return Array.isArray(parts) && parts.length === 3 && parts.every((part) => typeof part === 'string')
  } catch { return false }
}
export function buildFamilyOptions(groups: TimelineEventGroup[], shortlist: string[]): EventFamilyOption[] {
  const options = new Map<string, EventFamilyOption>(eventFamilyOptions.map((option) => [option.id,
    { id: option.id, label: option.label, currency: option.currency, symbol: option.symbol, count: 0, curated: true }]))
  for (const group of groups) {
    const id = eventFamilyKey(group)
    const option = options.get(id) ?? { id, label: `${group.family} · ${group.countryCode}`, currency: group.currency,
      symbol: defaultFamilySymbol(group.familyId), count: 0, curated: false }
    option.count++
    options.set(id, option)
  }
  // A saved national family stays editable even when this episode has no
  // releases from it. Its count is zero rather than its checkbox disappearing.
  for (const id of shortlist) {
    if (options.has(id) || !isFamilySelection(id) || !id.startsWith('source:')) continue
    const [country, currency, family] = JSON.parse(id.slice(7)) as string[]
    options.set(id, { id, label: `${family} · ${country}`, currency, symbol: 'star', count: 0, curated: false })
  }
  return [...options.values()]
}
