import { inspectorPairFamilies } from './inspector-preferences'
import { forexPair } from '../../economic-calendar/forex/pairs'
import { isMajorCurrency } from '../../economic-calendar/forex/currencies'
import { isEventSymbol } from '../../economic-calendar/presentation/event-symbols'
import { isStoredInspectorDetailView } from '../inspector-detail-view'

type Value = Record<string, unknown>
const record = (v: unknown): v is Value => !!v && typeof v === 'object' && !Array.isArray(v)
export function inspectorPreferencePair(key: string): string | null {
  const match = /^fyodor\.inspector\.([a-z]{6})\.v1$/.exec(key)
  return match ? forexPair(match[1]) : null
}
export function validInspectorPreferences(value: unknown, pair: string): boolean {
  if (!record(value)) return false
  const families = inspectorPairFamilies(pair)
  const admitted = (id: unknown) => families.some(f => f.id === id)
  return value.version === 2 && Array.isArray(value.families) && value.families.every(admitted) &&
    typeof value.showSymbols === 'boolean' && (value.showHistograms === undefined || typeof value.showHistograms === 'boolean') &&
    (value.detailView === undefined || isStoredInspectorDetailView(value.detailView)) &&
    (value.currencyColors === undefined || (record(value.currencyColors) && Object.entries(value.currencyColors).every(([id, color]) =>
      isMajorCurrency(id) && typeof color === 'string' && /^#[\da-f]{6}$/i.test(color)))) &&
    record(value.symbols) && Object.entries(value.symbols).every(([id, symbol]) => admitted(id) && isEventSymbol(symbol))
}
