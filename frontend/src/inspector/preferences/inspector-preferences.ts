import { normalizeCurrencyColors, type CurrencyColors } from '../currency-colors'
import { isEventSymbol, type EventSymbol } from '../../economic-calendar/presentation/event-symbols'
import { inspectorFamilies, originalInspectorFamilies } from '../catalog/inspector-families'
import { forexPair as inspectorPair, forexPairCurrencies as inspectorPairCurrencies } from '../../economic-calendar/forex/pairs'
export { forexPair as inspectorPair, forexPairCurrencies as inspectorPairCurrencies } from '../../economic-calendar/forex/pairs'

export type InspectorPreferences = {
  version: 2
  catalogVersion?: 1
  families: string[]
  showSymbols: boolean
  symbolGrouping: 'release' | 'day'
  currencyColors: CurrencyColors
  symbols: Record<string, EventSymbol>
}
export type InspectorPreferenceUpdate = 'save' | 'preview'
// Legacy pair keys remain readable. New saves share families by currency and
// retain grouping/appearance per canonical pair in one atomic storage write.
export const inspectorStorageKey = 'fyodor.inspector.eurusd.v1'
export const gbpInspectorStorageKey = 'fyodor.inspector.gbpusd.v1'
export const inspectorSharedStorageKey = 'fyodor.inspector.shared.v1'
type InspectorPreferenceStore = {
  version: 1
  currencies: Record<string, string[]>
  pairs: Record<string, InspectorPreferences>
}
function readPreferenceStore(): InspectorPreferenceStore {
  const saved = JSON.parse(localStorage.getItem(inspectorSharedStorageKey) ?? '{}')
  return { version: 1,
    currencies: saved?.version === 1 && saved.currencies && typeof saved.currencies === 'object' && !Array.isArray(saved.currencies) ? saved.currencies : {},
    pairs: saved?.version === 1 && saved.pairs && typeof saved.pairs === 'object' && !Array.isArray(saved.pairs) ? saved.pairs : {} }
}
export function inspectorPreferenceKey(symbol: string) {
  return `fyodor.inspector.${(inspectorPair(symbol) ?? symbol).toLowerCase()}.v1`
}
export function inspectorPairFamilies(symbol: string) {
  const currencies: readonly string[] = inspectorPairCurrencies(symbol)
  return inspectorFamilies.filter(family => currencies.includes(family.currency))
}
export function defaultInspectorPreferences(symbol = 'EURUSD'): InspectorPreferences {
  const families = inspectorPairFamilies(symbol)
  return { version: 2, catalogVersion: 1, families: families.map((family) => family.id), showSymbols: true, symbolGrouping: 'release', currencyColors: {},
    symbols: Object.fromEntries(families.map((family) => [family.id, family.symbol])) }
}
export function readInspectorPreferences(symbol = 'EURUSD'): InspectorPreferences {
  const defaults = defaultInspectorPreferences(symbol), families = inspectorPairFamilies(symbol)
  try {
    const store = readPreferenceStore()
    const saved = store.pairs[inspectorPair(symbol) ?? symbol] ?? JSON.parse(localStorage.getItem(inspectorPreferenceKey(symbol)) ?? '{}')
    const selected = Array.isArray(saved.families) ? [...new Set(saved.families.filter((id: unknown) =>
      families.some((family) => family.id === id)))] as string[] : defaults.families
    // Expand legacy defaults and add new coverage once. Existing exclusions
    // survive; catalogVersion preserves subsequent custom selections exactly.
    const oldDefault = inspectorPair(symbol) === 'EURUSD' && saved.version !== 2 && selected.length === originalInspectorFamilies.length &&
      originalInspectorFamilies.every((id) => selected.includes(id))
    const added = saved.catalogVersion === 1 || !selected.length ? [] : families.filter(f => f.sourceLabels || f.id === 'ecb-accounts').map(f => f.id)
    const pairSelected = oldDefault ? defaults.families : [...new Set([...selected, ...added])]
    const sharedSelected = inspectorPairCurrencies(symbol).flatMap(currency => {
      const chosen = Array.isArray(store.currencies[currency]) ? store.currencies[currency] : pairSelected
      return families.filter(family => family.currency === currency && chosen.includes(family.id)).map(family => family.id)
    })
    return { version: 2, catalogVersion: 1, families: sharedSelected,
    showSymbols: typeof saved.showSymbols === 'boolean' ? saved.showSymbols : defaults.showSymbols,
    symbolGrouping: saved.symbolGrouping === 'day' ? 'day' : 'release',
    currencyColors: normalizeCurrencyColors(saved.currencyColors),
    symbols: { ...defaults.symbols, ...Object.fromEntries(Object.entries(saved.symbols ?? {}).filter(([id, symbol]) =>
      families.some((family) => family.id === id) && isEventSymbol(symbol))) as Record<string, EventSymbol> } }
  } catch { return defaults }
}
export function saveInspectorPreferences(symbol: string, preferences: InspectorPreferences) {
  const pair = inspectorPair(symbol)
  if (!pair) return
  const store = readPreferenceStore(), currencies = { ...store.currencies }
  const families = inspectorPairFamilies(symbol)
  for (const currency of inspectorPairCurrencies(symbol)) {
    currencies[currency] = families.filter(family => family.currency === currency && preferences.families.includes(family.id)).map(family => family.id)
  }
  localStorage.setItem(inspectorSharedStorageKey, JSON.stringify({ version: 1, currencies,
    pairs: { ...store.pairs, [pair]: preferences } }))
}
export function supportsInspector(symbol: string): boolean {
  return inspectorPair(symbol) !== null
}
