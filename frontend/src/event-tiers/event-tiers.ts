import catalog from '../../../config/event-tiers.json'

export type EventTier = 'S' | 'A' | 'B' | 'C'
type Publisher = { label: string; url: string }
type Series = { currency: string; country: string; tier: EventTier; publisher?: string }
const series = catalog.series as Record<string, Series>
const publishers = catalog.publishers as Record<string, Publisher>
export const eventTiers = catalog.tiers as { id: EventTier; label: string; events: string }[]
export const currencyTierInfo = catalog.currencies as Record<string, Record<'S' | 'A' | 'B', string>>

type Identity = { event_id: string; currency: string; country_code: string }
export function eventClassification(event: Identity) {
  const entry = series[event.event_id]
  return entry?.currency === event.currency && entry.country === event.country_code ? entry : undefined
}
export function calendarTier(event: Identity): EventTier {
  return eventClassification(event)?.tier ?? 'C'
}
export function eventPublisher(event: Identity): Publisher | undefined {
  const key = eventClassification(event)?.publisher
  return key ? publishers[key] : undefined
}
export function isEventTier(value: unknown): value is EventTier {
  return typeof value === 'string' && eventTiers.some(t => t.id === value)
}
