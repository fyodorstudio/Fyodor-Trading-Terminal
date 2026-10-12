import sourceEvents from './source-events.json'
import type { CalendarCategory, CalendarFamily } from './family'
import { majorCurrencies, type MajorCurrency } from '../forex/currencies'

const categories: Record<string, CalendarCategory> = {
  money: 'policy', prices: 'inflation', jobs: 'labor', business: 'growth', consumer: 'growth', gdp: 'growth',
  housing: 'housing', trade: 'trade', government: 'government', market: 'markets', holidays: 'holidays', other: 'other',
}
const countries: Record<string, string> = { EU: 'Euro-area', DE: 'Germany', FR: 'France', IT: 'Italy', ES: 'Spain',
  US: 'US', GB: 'UK', JP: 'Japan', CH: 'Switzerland', CA: 'Canada', AU: 'Australia', NZ: 'New Zealand' }
export const currencyCountries: Record<MajorCurrency, string> = { USD: 'US', EUR: 'EU', GBP: 'GB', JPY: 'JP', CHF: 'CH', CAD: 'CA', AUD: 'AU', NZD: 'NZ' }

// Extend the existing controls without changing their IDs or family membership.
// Source sector and publication-name stems organize the full exported inventory.
export function completeCalendarCatalog(existing: readonly CalendarFamily[]): CalendarFamily[] {
  const registered = new Set(existing.flatMap(f => f.events.map(id => `${f.country}\0${f.currency}\0${id}`)))
  const groups = new Map<string, CalendarFamily>()
  for (const event of sourceEvents) {
    if (registered.has(`${event.country}\0${event.currency}\0${event.id}`)) continue
    const category = categories[event.sector] ?? 'other'
    const name = category === 'holidays' ? 'Holidays' : (event.name || `MT5 event ${event.id}`).replace(/\s+(?:[myq]\/\s*[myq]|s\.a\.)/g, '').trim()
    const key = `${event.country}\0${event.currency}\0${category}\0${name}`
    const group = groups.get(key)
    if (group) group.events = [...group.events, event.id]
    else groups.set(key, { id: `mt5-${event.id}`, label: `${countries[event.country] ?? event.country} · ${name}`,
      country: event.country, currency: event.currency as MajorCurrency, category,
      symbol: category === 'policy' ? 'moon' : category === 'inflation' ? 'star' : category === 'labor' ? 'cloud' : 'umbrella',
      events: [event.id], sourceLabels: true })
  }
  const byId = new Map(sourceEvents.map(event => [event.id, event]))
  return [...existing, ...[...groups.values()].sort((a, b) => a.label.localeCompare(b.label)),
    ...majorCurrencies.map((currency): CalendarFamily => ({ id: `${currency.toLowerCase()}-other`,
      label: `${currency} · Other / new MT5 events`, country: currencyCountries[currency], currency,
      category: 'other', symbol: 'umbrella', events: [], sourceLabels: true, catchAll: true }))]
    .map(family => ({ ...family, search: family.events.map(id => `${byId.get(id)?.name ?? ''} ${id}`).join(' ') }))
}
