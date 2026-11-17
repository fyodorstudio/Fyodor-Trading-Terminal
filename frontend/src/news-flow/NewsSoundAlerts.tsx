import { useEffect, useRef, useState } from 'react'
import { useNewsSettings } from './settings'
import { enableNewsSound, playNewsSound } from './sound'
import { validNewsPage, type NewsItem } from './model'
import { updateNewsAlertStatus, useNewsAlertStatus } from './alert-status'
import { saveNewsAlertProfile, useNewsAlertProfile } from './alert-profile'
import { showNewsPopups, stopNewsPopups, useNewsPopupError } from './browser-notifications'
import { encodeFilterPolicy } from './filter-policy'

function publicationAllowed(item: NewsItem, seconds: number | null) {
  const now = Date.now()
  return seconds === null || item.published_at !== null && item.published_at <= now && item.published_at - item.first_seen < 60000 && item.published_at >= now - seconds * 1000
}

// Storage owns classification for reader/export/desktop/phone. A cursor survives
// rule edits; aborted requests cannot sound using the previous scope.
export function NewsSoundAlerts() {
  const [settings, save] = useNewsSettings(), status = useNewsAlertStatus(), profile = useNewsAlertProfile()
  const popupError = useNewsPopupError(), popupEnabled = useRef(settings.browserNotifications), popupCursor = useRef<number | null>(null)
  const popupVersion = useRef(0)
  const [synchronized, setSynchronized] = useState(''), [syncError, setSyncError] = useState('')
  const cursor = useRef<number | null>(null)
  const blockedSince = useRef(0)
  const migrationRetryAt = useRef(0)
  useEffect(() => { save(old => old) }, [save])
  useEffect(() => {
    popupVersion.current++
    popupEnabled.current = settings.browserNotifications
    if (!settings.browserNotifications) stopNewsPopups()
    return () => { popupEnabled.current = false; stopNewsPopups() }
  }, [settings.browserNotifications])
  useEffect(() => {
    if (!profile.data || profile.data.unified_alerts || profile.saving || Date.now() < migrationRetryAt.current) return
    // One-time unification preserves an already-enabled phone or desktop trigger.
    const mode = profile.data.mode === 'off' && settings.soundEnabled ? settings.soundMode : profile.data.mode
    migrationRetryAt.current = Date.now() + 5000
    void saveNewsAlertProfile(mode, profile.data.max_age_seconds)
  }, [profile.data, profile.saving, settings.soundEnabled, settings.soundMode])
  const rules = JSON.stringify({ include: settings.include, exclude: settings.exclude, hidden: settings.hiddenSources,
    market_relevance: settings.marketRelevance, preset_version: 3, filter_policy: encodeFilterPolicy(settings.automaticFilters) })
  useEffect(() => {
    const controller = new AbortController()
    let timer = 0
    async function synchronize() {
      try {
        const response = await fetch('/storage-api/news-flow/notifications/rules', { method: 'PUT',
          headers: { 'Content-Type': 'application/json' }, body: rules, signal: controller.signal })
        if (!response.ok) throw new Error('Could not sync phone keyword rules')
        if (!controller.signal.aborted) { setSynchronized(rules); setSyncError('') }
      } catch { if (!controller.signal.aborted) { setSyncError('Could not synchronize news alert rules; retrying.'); timer = window.setTimeout(synchronize, 5000) } }
    }
    void synchronize()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [rules])
  const scope = profile.data && profile.data.mode !== 'off' && !profile.saving && synchronized === rules ? JSON.stringify({
    mode: profile.data.mode, max_age_seconds: profile.data.max_age_seconds, rules, sound: settings.sound }) : ''
  useEffect(() => {
    if (!scope) {
      if (profile.data?.mode === 'off' && !profile.saving) { cursor.current = null; popupCursor.current = null; blockedSince.current = 0 }
      updateNewsAlertStatus({ pending: 0, error: '' }); return
    }
    const active = JSON.parse(scope), controller = new AbortController()
    updateNewsAlertStatus({ pending: 0 })
    let timer = 0, pending: NewsItem[] = [], pendingCursor = 0
    async function unlock() {
      if (!await enableNewsSound() || controller.signal.aborted || !pending.length) return
      const expired = Date.now() - blockedSince.current > 60000
      const eligible = pending.filter(item => publicationAllowed(item, active.max_age_seconds))
      if (expired || !eligible.length || playNewsSound(active.sound)) {
        cursor.current = Math.max(cursor.current ?? 0, pendingCursor)
        updateNewsAlertStatus({ pending: 0, error: '', ...(!expired && eligible.length ? { last: { items: eligible.slice(-10), at: Date.now(), played: true } } : {}) })
        pending = []; blockedSince.current = 0
      }
    }
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock)
    async function poll() {
      try {
        const query = new URLSearchParams({ configured: 'true' })
        if (cursor.current !== null) query.set('after', String(cursor.current))
        const response = await fetch(`/storage-api/news-flow/arrivals?${query}`, { signal: controller.signal })
        if (!response.ok) throw new Error('News sound alerts unavailable; retrying.')
        const body = await response.json()
        if (!Number.isSafeInteger(body.cursor) || body.cursor < 0 || !validNewsPage({ ...body, total: body.items?.length })) throw new Error('Invalid news alert response; retrying.')
        if (!controller.signal.aborted) {
          updateNewsAlertStatus({ error: '' })
          const items = body.items.filter((item: NewsItem) => (item.sequence === undefined || item.sequence > (cursor.current ?? -1)) && publicationAllowed(item, active.max_age_seconds))
          // Popup progress is independent of blocked/retried audio. Track it even
          // while disabled, so switching popups on cannot replay pending sounds.
          const previousPopupCursor = popupCursor.current
          popupCursor.current = Math.max(popupCursor.current ?? 0, body.cursor)
          if (popupEnabled.current && previousPopupCursor !== null) {
            const fresh = items.filter((item: NewsItem) => (item.sequence ?? body.cursor) > previousPopupCursor)
            const version = popupVersion.current
            void showNewsPopups(fresh, () => !controller.signal.aborted && popupEnabled.current && popupVersion.current === version,
              item => publicationAllowed(item, active.max_age_seconds))
          }
          if (cursor.current !== null && body.cursor > cursor.current && items.length) {
            const expired = blockedSince.current > 0 && Date.now() - blockedSince.current > 60000
            const played = !expired && playNewsSound(active.sound)
            if (played || expired) { cursor.current = body.cursor; pending = []; blockedSince.current = 0 }
            else { pending = items; pendingCursor = body.cursor; blockedSince.current ||= Date.now() }
            updateNewsAlertStatus({ ready: played, pending: pending.length,
              last: { items: items.slice(-10), at: Date.now(), played } })
          } else { cursor.current = body.cursor; pending = []; blockedSince.current = 0; updateNewsAlertStatus({ pending: 0 }) }
        }
      } catch (cause) { if (!controller.signal.aborted) updateNewsAlertStatus({ error: cause instanceof Error ? cause.message : 'News sound alerts unavailable; retrying.' }) }
      finally { if (!controller.signal.aborted) timer = window.setTimeout(poll, 1000) }
    }
    void poll()
    return () => { controller.abort(); window.clearTimeout(timer); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock) }
  }, [scope, profile.data?.mode, profile.saving])
  const deliveryError = profile.error || syncError || status.error || (settings.browserNotifications ? popupError : '')
  return deliveryError || status.pending > 0 ? <div className="news-sound-status" role="status">
    {deliveryError || `${status.pending} headline alerts waiting for audio. Tap the News Flow bell to enable sound.`}
  </div> : null
}
