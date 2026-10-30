import type { SymbolQuote } from '../contracts/SymbolQuote'

const fiat = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD', 'CNH', 'SGD', 'HKD', 'NOK', 'SEK', 'DKK',
  'CZK', 'HUF', 'PLN', 'ILS', 'MXN', 'TRY', 'ZAR', 'AED', 'RON', 'THB', 'BRL', 'CLP', 'COP', 'IDR', 'INR', 'KRW', 'TWD'])
export function dailyRangeLabel(quote: SymbolQuote) {
  if (quote.dailyHigh == null || quote.dailyLow == null || !Number.isFinite(quote.bid) || quote.bid <= 0) return null
  const pair = quote.symbol.toUpperCase().split(/[._#-]/)[0]
  const fx = pair.length === 6 && fiat.has(pair.slice(0, 3)) && fiat.has(pair.slice(3))
  const scale = fx ? pair.endsWith('JPY') ? 100 : 10000 : 1
  const format = (value: number) => (Math.max(0, value) * scale).toFixed(fx ? 1 : quote.precision).replace(/\.0$/, '')
  const units = fx ? 'pips' : 'price units'
  return `Today: ${format(quote.dailyHigh - quote.bid)} ${units} below high · ${format(quote.bid - quote.dailyLow)} ${units} above low`
}
