import type { CSSProperties } from 'react'
import { isMajorCurrency, type MajorCurrency } from '../economic-calendar/forex/currencies'
export { defaultCurrencyColors } from '../economic-calendar/forex/currencies'

export type CurrencyColors = Partial<Record<MajorCurrency, string>>
export function normalizeCurrencyColors(value: unknown): CurrencyColors {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([key, color]) =>
    isMajorCurrency(key) && typeof color === 'string' && /^#[\da-f]{6}$/i.test(color)))
}
export function currencyColorStyle(colors: CurrencyColors = {}): CSSProperties {
  return Object.fromEntries(Object.entries(normalizeCurrencyColors(colors)).map(([currency, color]) =>
    [`--inspector-${currency.toLowerCase()}-color`, color])) as CSSProperties
}
