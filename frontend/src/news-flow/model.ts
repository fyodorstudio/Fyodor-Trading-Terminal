import { keywordTags, starterKeywords, upgradeKeywords, matchingKeyword, keywordVersion } from './keywords'
import { upgradeFilterPolicy, encodeFilterPolicy, defaultFilterPolicy, type NewsFilterPolicy } from './filter-policy'
export type NewsSource = { id: string; name: string; url: string; last_success: number | null; error: string; poll_seconds?: number; retry_at?: number; fetch_ms?: number | null; queue_ms?: number | null; collect_enabled?: number | boolean }
export type NewsItem = { id: string; source_id: string; source_name: string; publisher: string; title: string; summary: string; url: string; published_at: number | null; first_seen: number; previous_check_at?: number | null; received_at?: number; timeline_at?: number; pinned?: boolean | number; priority_reason?: string;
  sequence?: number; relevance?: { included: boolean; reason: string; keyword: string; tier?: 'priority' | 'included' | 'excluded'; priority_reason?: string }; policy_banks?: { currency: string; bank: string }[]; stance?: string; stance_evidence?: { origin: string; text: string }[] }
export type NewsPage = { items: NewsItem[]; total: number }
export type NewsMode = 'all' | 'priority' | 'included' | 'excluded'
export type NewsSettings = { hiddenSources: string[]; include: string; exclude: string; mode: NewsMode; presetVersion: number; marketRelevance: boolean; automaticFilters: NewsFilterPolicy; includedColor: string; excludedColor: string; date: string; session: { start: number; end: number } | null; order: 'newest' | 'oldest'; sortBy: 'published' | 'collected'; width: number; browserNotifications: boolean; soundEnabled: boolean; soundMode: 'included' | 'all'; sound: 'chime' | 'bell' | 'pulse' }

const key = 'fyodor.news-flow.v1'
const defaults: NewsSettings = { hiddenSources: [], include: starterKeywords.join(', '), exclude: '', mode: 'all', presetVersion: keywordVersion, marketRelevance: true, automaticFilters: { ...defaultFilterPolicy }, includedColor: '#ef4444', excludedColor: '#737373', date: '', session: null, order: 'newest', sortBy: 'collected', width: 380, browserNotifications: false, soundEnabled: false, soundMode: 'included', sound: 'chime' }

export function readNewsSettings(): NewsSettings {
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) ?? '{}')
    const previous = typeof saved.include === 'string' ? saved.include : ''
    const include = keywordTags(saved.presetVersion >= keywordVersion ? previous : saved.presetVersion >= 1 ? upgradeKeywords(previous, saved.presetVersion) : [previous, ...starterKeywords].join(',')).join(', ')
    const exclude = keywordTags(typeof saved.exclude === 'string' ? saved.exclude : '').join(', ')
    return { hiddenSources: Array.isArray(saved.hiddenSources) ? saved.hiddenSources.filter((id: unknown) => typeof id === 'string') : [],
      include, exclude,
      mode: ['priority', 'included', 'excluded'].includes(saved.mode) ? saved.mode : saved.mode === 'filtered' ? 'included' : 'all', presetVersion: keywordVersion, marketRelevance: saved.presetVersion < 3 || saved.marketRelevance !== false, automaticFilters: upgradeFilterPolicy(saved.automaticFilters, saved.presetVersion ?? 1),
      includedColor: /^#[0-9a-f]{6}$/i.test(saved.includedColor) ? saved.includedColor : defaults.includedColor,
      excludedColor: /^#[0-9a-f]{6}$/i.test(saved.excludedColor) ? saved.excludedColor : defaults.excludedColor,
      date: /^\d{4}-\d{2}-\d{2}$/.test(saved.date) ? saved.date : '',
      session: Number.isFinite(saved.session?.start) && Number.isFinite(saved.session?.end) && saved.session.end > saved.session.start && saved.session.end - saved.session.start <= 36 * 3600_000 ? { start: saved.session.start, end: saved.session.end } : null,
      order: saved.order === 'oldest' ? 'oldest' : 'newest', sortBy: saved.sortBy === 'published' ? 'published' : 'collected', width: Number.isFinite(saved.width) ? Math.min(640, Math.max(280, saved.width)) : 380,
      browserNotifications: saved.browserNotifications === true, soundEnabled: saved.soundEnabled === true, soundMode: saved.presetVersion >= 3 && saved.soundMode === 'all' ? 'all' : 'included', sound: saved.sound === 'bell' || saved.sound === 'pulse' ? saved.sound : 'chime' }
  } catch { return { ...defaults } }
}

export function saveNewsSettings(settings: NewsSettings) {
  try {
    const previous = window.localStorage.getItem(key)
    const version = previous ? JSON.parse(previous).presetVersion ?? 1 : keywordVersion
    const backupKey = `${key}.before-relevance-${version < 3 ? 'v2' : 'v4'}`
    if (previous && version < keywordVersion && !window.localStorage.getItem(backupKey)) window.localStorage.setItem(backupKey, previous)
    window.localStorage.setItem(key, JSON.stringify(settings))
  } catch { /* Keep working for this session. */ }
}

// Start/end come from the app's display clock, so date filtering agrees with timestamps.
export function newsQuery(settings: NewsSettings, sources: NewsSource[], page: number, start: number | null, end: number | null, search = '') {
  const query = new URLSearchParams({ mode: settings.mode, include: settings.include, exclude: settings.exclude, market_relevance: String(settings.marketRelevance),
    filter_policy: encodeFilterPolicy(settings.automaticFilters), order: settings.order, sort_by: settings.sortBy, offset: String(page * 100), limit: '100' })
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
    && /^https?:\/\//.test(item.url) && Number.isFinite(item.first_seen) && (item.published_at === null || Number.isFinite(item.published_at))
    && (item.timeline_at === undefined || Number.isFinite(item.timeline_at))
    && (item.received_at === undefined || Number.isFinite(item.received_at))
    && (item.previous_check_at == null || Number.isFinite(item.previous_check_at))
    && (item.relevance === undefined || item.relevance && typeof item.relevance.included === 'boolean' && typeof item.relevance.reason === 'string' && typeof item.relevance.keyword === 'string')
    && (item.relevance?.tier === undefined || ['priority', 'included', 'excluded'].includes(item.relevance.tier))
    && (item.policy_banks === undefined || Array.isArray(item.policy_banks) && item.policy_banks.every(bank => bank && typeof bank.currency === 'string' && typeof bank.bank === 'string'))
    && (item.stance === undefined || typeof item.stance === 'string')
    && (item.stance_evidence === undefined || Array.isArray(item.stance_evidence) && item.stance_evidence.every(entry => entry && typeof entry.origin === 'string' && typeof entry.text === 'string')))
}

export function headlineClassification(item: NewsItem, settings: NewsSettings) {
  if (item.relevance) return item.relevance
  // Compatibility for old cached responses while the backend is restarting.
  const included = matchingKeyword(item.title, settings.include), excluded = matchingKeyword(item.title, settings.exclude)
  return { included: !!included && !excluded, keyword: excluded || included,
    reason: excluded ? `Excluded keyword · ${excluded}` : included ? `Included · ${included}` : 'No include match' }
}

export function headlineTier(item: NewsItem, settings: NewsSettings) {
  const relevance = headlineClassification(item, settings)
  if (item.pinned && !matchingKeyword(item.title, settings.exclude)) return 'priority'
  return item.relevance?.tier ?? (relevance.included ? 'included' : 'excluded')
}

export function headlineLabel(tier: 'priority' | 'included' | 'excluded') {
  return { priority: 'Priority 1', included: 'Priority 2', excluded: 'Excluded' }[tier]
}

export function headlineReason(reason: string) {
  return reason.replace(/^(?:Included|Excluded) · /, '')
}

// Matches the backend's stable timeline; old responses can omit timeline_at.
export function newsTimestamp(item: NewsItem) {
  return item.timeline_at ?? (item.published_at === null || item.published_at - item.first_seen >= 60000 ? item.first_seen : item.published_at)
}

export function delayedCollection(item: NewsItem) {
  return item.published_at !== null && newsTimestamp(item) === item.published_at && item.first_seen - item.published_at >= 60000
}

export function newsAge(at: number, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - at) / 1000))
  return seconds < 60 ? 'Just now' : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago`
    : seconds < 86400 ? `${Math.floor(seconds / 3600)}h ago` : `${Math.floor(seconds / 86400)}d ago`
}
