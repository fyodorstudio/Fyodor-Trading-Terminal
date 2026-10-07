import type { ContextResult, UsdDirection } from './contracts'
import { decisionLabel } from './interpretation-quality'

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

/** Raw pressure remains available for audit; every combined output uses this gate. */
export function contextResultLabel(symbol: string, result: Pick<ContextResult, 'direction' | 'decision'> | null | undefined) {
  return decisionLabel(result?.decision) ?? contextPairLabel(symbol, result?.direction ?? 'uncomputed')
}
export function contextResultTone(result: Pick<ContextResult, 'direction' | 'decision'> | null | undefined) {
  return result?.decision?.state === 'mixed' ? 'mixed' : result?.decision?.state === 'insufficient' ? 'insufficient' :
    result?.direction === 'stronger' ? 'short' : result?.direction === 'weaker' ? 'long' : 'uncomputed'
}
