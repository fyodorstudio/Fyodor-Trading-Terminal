import type { SymbolQuote } from '../contracts/SymbolQuote'
import type { MarketSort } from './market-watch-preferences'

export function sortMarketQuotes(quotes: SymbolQuote[], sort: MarketSort, values?: ReadonlyMap<string, number | null>): SymbolQuote[] {
  if (sort === 'saved') return quotes
  // Stable ties retain the incoming/saved section order; unavailable values go last.
  return [...quotes].sort((a, b) => {
    const left = a.dailyChange == null ? null : values?.get(a.symbol) ?? a.dailyChange
    const right = b.dailyChange == null ? null : values?.get(b.symbol) ?? b.dailyChange
    if (left == null) return right == null ? 0 : 1
    if (right == null) return -1
    return sort === 'highest' ? right - left : sort === 'lowest' ? left - right : Math.abs(right) - Math.abs(left)
  })
}
