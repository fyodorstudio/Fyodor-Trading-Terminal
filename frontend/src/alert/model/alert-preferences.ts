import { inspectorFamilies } from '../../inspector/catalog/inspector-families'
import { isMajorCurrency, type MajorCurrency } from '../../economic-calendar/forex/currencies'

export const alertPreferencesKey = 'fyodor.alert.preferences.v1'
export type HighlightVisibility = 'active' | 'archived' | 'limitations'
const highlightVisibilityKey = 'fyodor.alert.highlight-visibility.v1'
export function readHighlightVisibility(): HighlightVisibility {
  try {
    const value = localStorage.getItem(highlightVisibilityKey)
    return value === 'archived' || value === 'limitations' ? value : 'active'
  } catch { return 'active' }
}
export function saveHighlightVisibility(value: HighlightVisibility) {
  try { localStorage.setItem(highlightVisibilityKey, value) } catch { /* Keep session choices when storage is unavailable. */ }
}
export const alertCurrencies: readonly MajorCurrency[] = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD']
export const alertHorizons = [7, 30, 60, 90] as const
export type AlertPreferences = { version: 1; catalogVersion?: 1; families: string[]; currency: 'all' | MajorCurrency; days: typeof alertHorizons[number] }
export function defaultAlertPreferences(): AlertPreferences {
  return { version: 1, catalogVersion: 1, families: inspectorFamilies.map(f => f.id), currency: 'all', days: 7 }
}
export function validAlertPreferences(value: unknown): value is AlertPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as AlertPreferences
  return v.version === 1 && (v.currency === 'all' || isMajorCurrency(v.currency)) &&
    alertHorizons.includes(v.days) && Array.isArray(v.families) &&
    v.families.every(id => typeof id === 'string' && inspectorFamilies.some(f => f.id === id)) && new Set(v.families).size === v.families.length
}
export function readAlertPreferences(): AlertPreferences {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(alertPreferencesKey) ?? 'null')
    if (!validAlertPreferences(saved)) return defaultAlertPreferences()
    return { ...saved, catalogVersion: 1, families: saved.catalogVersion === 1 || !saved.families.length ? saved.families :
      [...new Set([...saved.families, ...inspectorFamilies.filter(f => f.sourceLabels || f.id === 'ecb-accounts').map(f => f.id)])] }
  } catch { return defaultAlertPreferences() }
}
export function saveAlertPreferences(preferences: AlertPreferences) {
  try { localStorage.setItem(alertPreferencesKey, JSON.stringify(preferences)) } catch { /* Keep session choices when storage is unavailable. */ }
}
