import { useEffect, useRef } from 'react'
import { useNewsSettings } from './settings'
import { enableNewsSound, playNewsSound } from './sound'
import { validNewsPage, type NewsItem } from './model'
import { matchingKeyword } from './keywords'
import { updateNewsAlertStatus, useNewsAlertStatus } from './alert-status'

// Workspace-owned: closing the reader does not disable desktop audio. Phone
// delivery runs in storage using the last synchronized desktop rules.
export function NewsSoundAlerts() {
  const [settings] = useNewsSettings(), current = useRef(settings)
  const status = useNewsAlertStatus()
  useEffect(() => { current.current = settings }, [settings])
  const rules = JSON.stringify({ include: settings.include, exclude: settings.exclude, hidden: settings.hiddenSources })
  useEffect(() => {
    const controller = new AbortController()
    let timer = 0
    async function synchronize() {
      try {
        const response = await fetch('/storage-api/news-flow/notifications/rules', { method: 'PUT',
          headers: { 'Content-Type': 'application/json' }, body: rules, signal: controller.signal })
        if (!response.ok) throw new Error('Could not sync phone keyword rules')
      } catch {
        if (!controller.signal.aborted) timer = window.setTimeout(synchronize, 5000)
      }
    }
    void synchronize()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [rules])
  useEffect(() => {
    if (!settings.soundEnabled) { updateNewsAlertStatus({ pending: 0, error: '' }); return }
    const controller = new AbortController()
    let cursor: number | null = null, timer = 0, pending: NewsItem[] = [], pendingCount = 0, pendingAt = 0
    async function unlock() {
      if (!await enableNewsSound() || controller.signal.aborted) return
      const active = current.current
      if (pending.length && Date.now() - pendingAt > 60000) {
        pending = []; pendingCount = 0
        updateNewsAlertStatus({ pending: 0 })
      }
      const eligible = pending.filter(item => !active.hiddenSources.includes(item.source_id)
        && (active.soundMode === 'all' || matchingKeyword(item.title, active.include) && !matchingKeyword(item.title, active.exclude)))
      if (pending.length && (!eligible.length || playNewsSound(active.sound))) {
        updateNewsAlertStatus({ pending: 0, error: '', ...(eligible.length ? { last: { items: eligible, at: Date.now(), played: true } } : {}) })
        pending = []; pendingCount = 0
      }
    }
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock)
    async function poll() {
      try {
        // Classify using current preferences when the response arrives. Editing
        // rules must not reset the cursor or sound using stale request rules.
        const query = new URLSearchParams({ mode: 'all' })
        if (cursor !== null) query.set('after', String(cursor))
        const response = await fetch(`/storage-api/news-flow/arrivals?${query}`, { signal: controller.signal })
        if (!response.ok) throw new Error('News sound alerts unavailable; retrying.')
        const body = await response.json()
        if (!Number.isSafeInteger(body.cursor) || body.cursor < 0 || !validNewsPage({ ...body, total: body.items?.length })) throw new Error('Invalid news alert response; retrying.')
        if (!controller.signal.aborted) {
          const active = current.current
          const items = (body.items as NewsItem[]).filter(item => !active.hiddenSources.includes(item.source_id)
            && (active.soundMode === 'all' || matchingKeyword(item.title, active.include) && !matchingKeyword(item.title, active.exclude)))
          updateNewsAlertStatus({ error: '' })
          if (cursor !== null && body.cursor > cursor && items.length) {
            const played = playNewsSound(active.sound)
            if (!played) {
              if (Date.now() - pendingAt > 60000) pendingCount = 0
              pending = items.slice(-10); pendingCount += items.length; pendingAt = Date.now()
            }
            else { pending = []; pendingCount = 0 }
            updateNewsAlertStatus({ ready: played, pending: pendingCount,
              last: { items: items.slice(-10), at: Date.now(), played } })
          }
          cursor = body.cursor
        }
      } catch (cause) { if (!controller.signal.aborted) updateNewsAlertStatus({ error: cause instanceof Error ? cause.message : 'News sound alerts unavailable; retrying.' }) }
      finally { if (!controller.signal.aborted) timer = window.setTimeout(poll, 1000) }
    }
    void poll()
    return () => { controller.abort(); window.clearTimeout(timer); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock) }
  }, [settings.soundEnabled])
  return settings.soundEnabled && (status.error || status.pending > 0) ? <div className="news-sound-status" role="status">
    {status.error || `${status.pending} headline alerts waiting for audio. Tap the News Flow bell to enable sound.`}
  </div> : null
}
