export const newsCurrencies = ['EUR', 'GBP', 'AUD', 'NZD', 'USD', 'CAD', 'CHF', 'JPY'] as const
export type NewsCurrency = typeof newsCurrencies[number]
export type NewsEntry = { id: string; date: string; currencies: NewsCurrency[]; title: string; details: string; url: string }
export type NewsDraft = Omit<NewsEntry, 'id'>
export function validNews(value: unknown): value is { items: NewsEntry[] } {
  if (!value || typeof value !== 'object' || !('items' in value) || !Array.isArray(value.items)) return false
  return new Set(value.items.map(item => item?.id)).size === value.items.length && value.items.every(item => {
    if (!item || typeof item.id !== 'string' || !item.id || typeof item.date !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(item.date)
      || !Array.isArray(item.currencies) || !item.currencies.length || !item.currencies.every((c: NewsCurrency) => newsCurrencies.includes(c))
      || !['title', 'details', 'url'].every(k => typeof item[k] === 'string')) return false
    if (!item.url) return true
    try { const u = new URL(item.url); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password } catch { return false }
  })
}
