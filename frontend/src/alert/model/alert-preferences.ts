import { inspectorFamilies } from '../../inspector/catalog/inspector-families'
import { isMajorCurrency, type MajorCurrency } from '../../economic-calendar/forex/currencies'

export const alertPreferencesKey = 'fyodor.alert.preferences.v1'
export const alertCurrencies: readonly MajorCurrency[] = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD']
export const alertHorizons = [7, 30, 60, 90] as const
export type AlertPreferences = { version: 1; families: string[]; currency: 'all' | MajorCurrency; days: typeof alertHorizons[number] }
export function defaultAlertPreferences(): AlertPreferences {
  return { version: 1, families: inspectorFamilies.map(f => f.id), currency: 'all', days: 7 }
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
    return validAlertPreferences(saved) ? saved : defaultAlertPreferences()
  } catch { return defaultAlertPreferences() }
}
export function saveAlertPreferences(preferences: AlertPreferences) {
  try { localStorage.setItem(alertPreferencesKey, JSON.stringify(preferences)) } catch { /* Keep session choices when storage is unavailable. */ }
}
