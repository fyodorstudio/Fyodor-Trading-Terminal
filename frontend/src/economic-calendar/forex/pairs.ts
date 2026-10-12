import { majorCurrencies, type MajorCurrency } from './currencies'

const currenciesByPair = new Map<string, readonly [MajorCurrency, MajorCurrency]>()
majorCurrencies.forEach((base, index) => majorCurrencies.slice(index + 1).forEach(quote =>
  currenciesByPair.set(base + quote, [base, quote])))
export const majorForexPairs = [...currenciesByPair.keys()]
export function forexPair(symbol: string): string | null {
  const match = /^([A-Za-z]{6})(?:[._-].*|[a-z]*)$/.exec(symbol)
  const pair = match?.[1].toUpperCase()
  return pair && currenciesByPair.has(pair) ? pair : null
}
const noCurrencies: readonly MajorCurrency[] = []
export function forexPairCurrencies(symbol: string): readonly MajorCurrency[] {
  return currenciesByPair.get(forexPair(symbol) ?? '') ?? noCurrencies
}
