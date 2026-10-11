import { normalizeCurrencyColors, type CurrencyColors } from '../currency-colors'
import { isEventSymbol, type EventSymbol } from '../../economic-calendar/presentation/event-symbols'
import { normalizeInspectorDetailView, type InspectorDetailView } from '../inspector-detail-view'
import { inspectorFamilies, originalInspectorFamilies } from '../catalog/inspector-families'
import { forexPair as inspectorPair, forexPairCurrencies as inspectorPairCurrencies, hasInspectorScoring } from '../../economic-calendar/forex/pairs'
export { forexPair as inspectorPair, forexPairCurrencies as inspectorPairCurrencies } from '../../economic-calendar/forex/pairs'

export type InspectorPreferences = {
  version: 2
  catalogVersion?: 1
  families: string[]
  showSymbols: boolean
  showHistograms: boolean
  detailView: InspectorDetailView
  currencyColors: CurrencyColors
  symbols: Record<string, EventSymbol>
}
export type InspectorPreferenceUpdate = 'save' | 'preview' | 'view'
// Existing keys remain compatible; each canonical pair owns its saved filters.
export const inspectorStorageKey = 'fyodor.inspector.eurusd.v1'
export const gbpInspectorStorageKey = 'fyodor.inspector.gbpusd.v1'
export function inspectorPreferenceKey(symbol: string) {
  return `fyodor.inspector.${(inspectorPair(symbol) ?? symbol).toLowerCase()}.v1`
}
export function inspectorPairFamilies(symbol: string) {
  const currencies: readonly string[] = inspectorPairCurrencies(symbol)
  return inspectorFamilies.filter(family => currencies.includes(family.currency))
}
export function defaultInspectorPreferences(symbol = 'EURUSD'): InspectorPreferences {
  const families = inspectorPairFamilies(symbol)
  return { version: 2, catalogVersion: 1, families: families.map((family) => family.id), showSymbols: true, showHistograms: true, detailView: 'table', currencyColors: {},
    symbols: Object.fromEntries(families.map((family) => [family.id, family.symbol])) }
}
export function readInspectorPreferences(symbol = 'EURUSD'): InspectorPreferences {
  const defaults = defaultInspectorPreferences(symbol), families = inspectorPairFamilies(symbol)
  try {
    const saved = JSON.parse(localStorage.getItem(inspectorPreferenceKey(symbol)) ?? '{}')
    const selected = Array.isArray(saved.families) ? [...new Set(saved.families.filter((id: unknown) =>
      families.some((family) => family.id === id)))] as string[] : defaults.families
    // Expand legacy defaults and add new coverage once. Existing exclusions
    // survive; catalogVersion preserves subsequent custom selections exactly.
    const oldDefault = inspectorPair(symbol) === 'EURUSD' && saved.version !== 2 && selected.length === originalInspectorFamilies.length &&
      originalInspectorFamilies.every((id) => selected.includes(id))
    const added = saved.catalogVersion === 1 || !selected.length ? [] : families.filter(f => f.sourceLabels || f.id === 'ecb-accounts').map(f => f.id)
    return { version: 2, catalogVersion: 1, families: oldDefault ? defaults.families : [...new Set([...selected, ...added])],
    showHistograms: typeof saved.showHistograms === 'boolean' ? saved.showHistograms : defaults.showHistograms,
    detailView: hasInspectorScoring(symbol) ? normalizeInspectorDetailView(saved.detailView) : 'table',
    showSymbols: typeof saved.showSymbols === 'boolean' ? saved.showSymbols : defaults.showSymbols,
    currencyColors: normalizeCurrencyColors(saved.currencyColors),
    symbols: { ...defaults.symbols, ...Object.fromEntries(Object.entries(saved.symbols ?? {}).filter(([id, symbol]) =>
      families.some((family) => family.id === id) && isEventSymbol(symbol))) as Record<string, EventSymbol> } }
  } catch { return defaults }
}
export function supportsInspector(symbol: string): boolean {
  return inspectorPair(symbol) !== null
}
