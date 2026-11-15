import { keywordTags, starterKeywords } from './keywords'
export type NewsSource = { id: string; name: string; url: string; last_success: number | null; error: string; poll_seconds?: number; retry_at?: number }
export type NewsItem = { id: string; source_id: string; source_name: string; publisher: string; title: string; summary: string; url: string; published_at: number | null; first_seen: number; pinned?: boolean | number; priority_reason?: string }
export type NewsPage = { items: NewsItem[]; total: number }
export type NewsMode = 'all' | 'included' | 'excluded'
export type NewsSettings = { hiddenSources: string[]; include: string; exclude: string; mode: NewsMode; presetVersion: number; includedColor: string; excludedColor: string; date: string; session: { start: number; end: number } | null; order: 'newest' | 'oldest'; width: number; soundEnabled: boolean; sound: 'chime' | 'bell' | 'pulse' }

const key = 'fyodor.news-flow.v1'
const defaults: NewsSettings = { hiddenSources: [], include: starterKeywords.join(', '), exclude: '', mode: 'all', presetVersion: 1, includedColor: '#ef4444', excludedColor: '#737373', date: '', session: null, order: 'newest', width: 380, soundEnabled: false, sound: 'chime' }

export function readNewsSettings(): NewsSettings {
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) ?? '{}')
    const previous = typeof saved.include === 'string' ? saved.include : ''
    const include = keywordTags(saved.presetVersion === 1 ? previous : [previous, ...starterKeywords].join(',')).join(', ')
    const exclude = keywordTags(typeof saved.exclude === 'string' ? saved.exclude : '').join(', ')
    return { hiddenSources: Array.isArray(saved.hiddenSources) ? saved.hiddenSources.filter((id: unknown) => typeof id === 'string') : [],
      include, exclude,
      mode: saved.mode === 'included' || saved.mode === 'excluded' ? saved.mode : saved.mode === 'filtered' ? 'included' : 'all', presetVersion: 1,
      includedColor: /^#[0-9a-f]{6}$/i.test(saved.includedColor) ? saved.includedColor : defaults.includedColor,
      excludedColor: /^#[0-9a-f]{6}$/i.test(saved.excludedColor) ? saved.excludedColor : defaults.excludedColor,
      date: /^\d{4}-\d{2}-\d{2}$/.test(saved.date) ? saved.date : '',
      session: Number.isFinite(saved.session?.start) && Number.isFinite(saved.session?.end) && saved.session.end > saved.session.start && saved.session.end - saved.session.start <= 36 * 3600_000 ? { start: saved.session.start, end: saved.session.end } : null,
      order: saved.order === 'oldest' ? 'oldest' : 'newest', width: Number.isFinite(saved.width) ? Math.min(640, Math.max(280, saved.width)) : 380,
      soundEnabled: saved.soundEnabled === true, sound: saved.sound === 'bell' || saved.sound === 'pulse' ? saved.sound : 'chime' }
  } catch { return { ...defaults } }
}

export function saveNewsSettings(settings: NewsSettings) {
  try { window.localStorage.setItem(key, JSON.stringify(settings)) } catch { /* Keep working for this session. */ }
}

// Start/end come from the app's display clock, so date filtering agrees with timestamps.
export function newsQuery(settings: NewsSettings, sources: NewsSource[], page: number, start: number | null, end: number | null, search = '') {
  const query = new URLSearchParams({ mode: settings.mode, include: settings.mode !== 'all' ? settings.include : '', exclude: settings.mode !== 'all' ? settings.exclude : '',
    order: settings.order, offset: String(page * 100), limit: '100' })
  if (settings.hiddenSources.length) {
    const visible = sources.filter(source => !settings.hiddenSources.includes(source.id))
    for (const source of visible) query.append('source', source.id)
    if (!visible.length) query.append('source', '__none__')
  }
  if (start !== null && end !== null) { query.set('start', String(start)); query.set('end', String(end)) }
  if (search.trim()) query.set('search', search.trim())
  return query.toString()
}

export function validNewsPage(value: unknown): value is NewsPage {
  if (!value || typeof value !== 'object') return false
  const page = value as NewsPage
  return Number.isSafeInteger(page.total) && page.total >= 0 && Array.isArray(page.items) && page.items.every(item =>
    item && ['id', 'source_id', 'source_name', 'publisher', 'title', 'summary', 'url'].every(key => typeof item[key as keyof NewsItem] === 'string')
    && /^https?:\/\//.test(item.url) && Number.isFinite(item.first_seen) && (item.published_at === null || Number.isFinite(item.published_at)))
}

export function newsAge(at: number, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - at) / 1000))
  return seconds < 60 ? 'Just now' : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago`
    : seconds < 86400 ? `${Math.floor(seconds / 3600)}h ago` : `${Math.floor(seconds / 86400)}d ago`
}
