export type NewsSource = { id: string; name: string; url: string; last_success: number | null; error: string }
export type NewsItem = { id: string; source_id: string; source_name: string; publisher: string; title: string; summary: string; url: string; published_at: number | null; first_seen: number }
export type NewsPage = { items: NewsItem[]; total: number }
export type NewsSettings = { hiddenSources: string[]; include: string; exclude: string; match: 'any' | 'all'; date: string; order: 'newest' | 'oldest'; width: number }

const key = 'fyodor.news-flow.v1'
const defaults: NewsSettings = { hiddenSources: [], include: '', exclude: '', match: 'any', date: '', order: 'newest', width: 380 }

export function readNewsSettings(): NewsSettings {
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) ?? '{}')
    return { hiddenSources: Array.isArray(saved.hiddenSources) ? saved.hiddenSources.filter((id: unknown) => typeof id === 'string') : [],
      include: typeof saved.include === 'string' ? saved.include.slice(0, 2000) : '',
      exclude: typeof saved.exclude === 'string' ? saved.exclude.slice(0, 2000) : '',
      match: saved.match === 'all' ? 'all' : 'any', date: /^\d{4}-\d{2}-\d{2}$/.test(saved.date) ? saved.date : '',
      order: saved.order === 'oldest' ? 'oldest' : 'newest', width: Number.isFinite(saved.width) ? Math.min(640, Math.max(280, saved.width)) : 380 }
  } catch { return { ...defaults } }
}

export function saveNewsSettings(settings: NewsSettings) {
  try { window.localStorage.setItem(key, JSON.stringify(settings)) } catch { /* Keep working for this session. */ }
}

// Start/end come from the app's display clock, so date filtering agrees with timestamps.
export function newsQuery(settings: NewsSettings, sources: NewsSource[], page: number, start: number | null, end: number | null) {
  const query = new URLSearchParams({ include: settings.include, exclude: settings.exclude, match: settings.match,
    order: settings.order, offset: String(page * 100), limit: '100' })
  if (settings.hiddenSources.length) {
    const visible = sources.filter(source => !settings.hiddenSources.includes(source.id))
    for (const source of visible) query.append('source', source.id)
    if (!visible.length) query.append('source', '__none__')
  }
  if (start !== null && end !== null) { query.set('start', String(start)); query.set('end', String(end)) }
  return query.toString()
}

export function validNewsPage(value: unknown): value is NewsPage {
  if (!value || typeof value !== 'object') return false
  const page = value as NewsPage
  return Number.isSafeInteger(page.total) && page.total >= 0 && Array.isArray(page.items) && page.items.every(item =>
    item && ['id', 'source_id', 'source_name', 'publisher', 'title', 'summary', 'url'].every(key => typeof item[key as keyof NewsItem] === 'string')
    && /^https?:\/\//.test(item.url) && Number.isFinite(item.first_seen) && (item.published_at === null || Number.isFinite(item.published_at)))
}

export function newsAge(at: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - at) / 1000))
  return seconds < 60 ? 'Just now' : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago`
    : seconds < 86400 ? `${Math.floor(seconds / 3600)}h ago` : `${Math.floor(seconds / 86400)}d ago`
}
