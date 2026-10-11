// Order follows conventional forex base/quote precedence.
export const majorCurrencies = ['EUR', 'GBP', 'AUD', 'NZD', 'USD', 'CAD', 'CHF', 'JPY'] as const
export type MajorCurrency = typeof majorCurrencies[number]
export const defaultCurrencyColors: Record<MajorCurrency, string> = {
  EUR: '#2563eb', GBP: '#2563eb', AUD: '#0f766e', NZD: '#b45309',
  USD: '#9333ea', CAD: '#be123c', CHF: '#0369a1', JPY: '#7c3aed',
}
export function isMajorCurrency(value: unknown): value is MajorCurrency {
  return typeof value === 'string' && (majorCurrencies as readonly string[]).includes(value)
}
