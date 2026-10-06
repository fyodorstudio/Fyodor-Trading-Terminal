import type { UsdDirection } from './contracts'

const majors = ['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'USDJPY', 'USDCHF', 'USDCAD']
export function usdPair(symbol: string) {
  const pair = majors.find(p => symbol.slice(0, 6).toUpperCase() === p && /^(?:[._-].*|[a-z]*)$/.test(symbol.slice(6)))
  return pair ? { symbol, pair, usdSide: pair.startsWith('USD') ? 'base' as const : 'quote' as const } : null
}
export function contextPairLabel(symbol: string, direction: UsdDirection) {
  const pair = usdPair(symbol)
  if (!pair || direction === 'uncomputed') return 'Uncomputed'
  const long = pair.usdSide === 'base' ? direction === 'stronger' : direction === 'weaker'
  return `${symbol} ${long ? 'Long' : 'Short'}`
}
