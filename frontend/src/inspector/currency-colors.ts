import type { CSSProperties } from 'react'

export type CurrencyColors = Partial<Record<'EUR' | 'USD', string>>
export const defaultCurrencyColors = { EUR: '#2563eb', USD: '#9333ea' }
export function normalizeCurrencyColors(value: unknown): CurrencyColors {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([key, color]) =>
    (key === 'EUR' || key === 'USD') && typeof color === 'string' && /^#[\da-f]{6}$/i.test(color)))
}
export function currencyColorStyle(colors: CurrencyColors = {}): CSSProperties {
  return Object.fromEntries(Object.entries(normalizeCurrencyColors(colors)).map(([currency, color]) =>
    [`--inspector-${currency.toLowerCase()}-color`, color])) as CSSProperties
}
