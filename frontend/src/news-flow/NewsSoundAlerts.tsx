import { useEffect, useRef } from 'react'
import { useNewsSettings } from './settings'
import { enableNewsSound, playNewsSound } from './sound'
import { validNewsPage, type NewsItem } from './model'
import { updateNewsAlertStatus, useNewsAlertStatus } from './alert-status'

// Storage owns classification for reader/export/desktop/phone. A cursor survives
// rule edits; aborted requests cannot sound using the previous scope.
export function NewsSoundAlerts() {
  const [settings, save] = useNewsSettings(), status = useNewsAlertStatus()
  const cursor = useRef<number | null>(null)
  const blockedSince = useRef(0)
  useEffect(() => { save(old => old) }, [save])
  const rules = JSON.stringify({ include: settings.include, exclude: settings.exclude, hidden: settings.hiddenSources,
    market_relevance: settings.marketRelevance, preset_version: 3 })
  useEffect(() => {
    const controller = new AbortController()
    let timer = 0
    async function synchronize() {
      try {
        const response = await fetch('/storage-api/news-flow/notifications/rules', { method: 'PUT',
          headers: { 'Content-Type': 'application/json' }, body: rules, signal: controller.signal })
        if (!response.ok) throw new Error('Could not sync phone keyword rules')
      } catch { if (!controller.signal.aborted) timer = window.setTimeout(synchronize, 5000) }
    }
    void synchronize()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [rules])
  const scope = settings.soundEnabled ? JSON.stringify({ ...JSON.parse(rules), mode: settings.soundMode, sound: settings.sound }) : ''
  useEffect(() => {
    if (!scope) { cursor.current = null; blockedSince.current = 0; updateNewsAlertStatus({ pending: 0, error: '' }); return }
    const active = JSON.parse(scope), controller = new AbortController()
    updateNewsAlertStatus({ pending: 0 })
    let timer = 0, pending: NewsItem[] = [], pendingCursor = 0
    async function unlock() {
      if (!await enableNewsSound() || controller.signal.aborted || !pending.length) return
      const expired = Date.now() - blockedSince.current > 60000
      if (expired || playNewsSound(active.sound)) {
        cursor.current = Math.max(cursor.current ?? 0, pendingCursor)
        updateNewsAlertStatus({ pending: 0, error: '', ...(!expired ? { last: { items: pending.slice(-10), at: Date.now(), played: true } } : {}) })
        pending = []; blockedSince.current = 0
      }
    }
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock)
    async function poll() {
      try {
        const query = new URLSearchParams({ mode: active.mode, include: active.include, exclude: active.exclude, market_relevance: String(active.market_relevance) })
        for (const id of active.hidden) query.append('hidden', id)
        if (cursor.current !== null) query.set('after', String(cursor.current))
        const response = await fetch(`/storage-api/news-flow/arrivals?${query}`, { signal: controller.signal })
        if (!response.ok) throw new Error('News sound alerts unavailable; retrying.')
        const body = await response.json()
        if (!Number.isSafeInteger(body.cursor) || body.cursor < 0 || !validNewsPage({ ...body, total: body.items?.length })) throw new Error('Invalid news alert response; retrying.')
        if (!controller.signal.aborted) {
          updateNewsAlertStatus({ error: '' })
          const items = body.items.filter((item: NewsItem) => item.sequence === undefined || item.sequence > (cursor.current ?? -1))
          if (cursor.current !== null && body.cursor > cursor.current && items.length) {
            const expired = blockedSince.current > 0 && Date.now() - blockedSince.current > 60000
            const played = !expired && playNewsSound(active.sound)
            if (played || expired) { cursor.current = body.cursor; pending = []; blockedSince.current = 0 }
            else { pending = items; pendingCursor = body.cursor; blockedSince.current ||= Date.now() }
            updateNewsAlertStatus({ ready: played, pending: pending.length,
              last: { items: items.slice(-10), at: Date.now(), played } })
          } else { cursor.current = body.cursor }
        }
      } catch (cause) { if (!controller.signal.aborted) updateNewsAlertStatus({ error: cause instanceof Error ? cause.message : 'News sound alerts unavailable; retrying.' }) }
      finally { if (!controller.signal.aborted) timer = window.setTimeout(poll, 1000) }
    }
    void poll()
    return () => { controller.abort(); window.clearTimeout(timer); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock) }
  }, [scope])
  return settings.soundEnabled && (status.error || status.pending > 0) ? <div className="news-sound-status" role="status">
    {status.error || `${status.pending} headline alerts waiting for audio. Tap the News Flow bell to enable sound.`}
  </div> : null
}
