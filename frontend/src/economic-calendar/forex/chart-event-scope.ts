import { forexPair, forexPairCurrencies } from './pairs'
import type { MajorCurrency } from './currencies'

// Calendar relevance is separate from tradable forex-pair identity. Never add
// index/metal aliases to the 28-pair catalog used by research and trade journals.
const singleCurrencyScopes: Record<string, readonly MajorCurrency[]> = {
  JPYX: ['JPY'], EURX: ['EUR'], USDX: ['USD'], 'USDX-F': ['USD'],
  JPN225: ['JPY'], 'JPN225-F': ['JPY'], XAUUSD: ['USD'], 'XAUUSD-F': ['USD'],
}
const chartAliases = Object.keys(singleCurrencyScopes).sort((a, b) => b.length - a.length)
  .map(alias => ({ alias, pattern: new RegExp(`^${alias}(?:[._].*|[a-z]*)$`) }))
export function chartEventSymbol(symbol: string): string | null {
  const pair = forexPair(symbol)
  if (pair) return pair
  // Match the complete instrument before a broker suffix, preserving forward
  // identities and refusing lookalikes such as XAUUSDT or USDX-PERP.
  return chartAliases.find(({ pattern }) => pattern.test(symbol))?.alias ?? null
}
export function chartEventCurrencies(symbol: string): readonly MajorCurrency[] {
  const key = chartEventSymbol(symbol)
  return key && singleCurrencyScopes[key] || forexPairCurrencies(symbol)
}
export function chartEventScope(symbol: string): string | null {
  const key = chartEventSymbol(symbol)
  return key ? forexPair(key) ?? chartEventCurrencies(key)[0] : null
}
