import { useEffect, useRef, useState } from 'react'
import { useNewsSettings } from './settings'
import { enableNewsSound, playNewsSound } from './sound'
import { newsTimestamp, validNewsPage, type NewsItem } from './model'

// Lives with the workspace, so closing News Flow does not disable enabled alerts.
export function NewsSoundAlerts() {
  const [settings] = useNewsSettings(), current = useRef(settings)
  const [audioError, setAudioError] = useState(''), [networkError, setNetworkError] = useState('')
  useEffect(() => { current.current = settings }, [settings])
  const key = settings.soundEnabled && (settings.soundMode === 'all' || settings.include.trim()) ? JSON.stringify({ mode: settings.soundMode,
    include: settings.soundMode === 'all' ? '' : settings.include, exclude: settings.soundMode === 'all' ? '' : settings.exclude, hidden: settings.hiddenSources }) : ''
  useEffect(() => {
    if (!key) return
    const controller = new AbortController(), rules = JSON.parse(key)
    const started = Date.now()
    let cursor: number | null = null, timer = 0
    async function unlock() { if (await enableNewsSound()) { if (!controller.signal.aborted) setAudioError(''); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock) } }
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock)
    async function poll() {
      try {
        const query = new URLSearchParams({ mode: rules.mode, include: rules.include, exclude: rules.exclude })
        for (const id of rules.hidden) query.append('hidden', id)
        if (cursor !== null) query.set('after', String(cursor))
        const response = await fetch(`/storage-api/news-flow/arrivals?${query}`, { signal: controller.signal })
        if (!response.ok) throw new Error('News sound alerts unavailable; retrying.')
        const body = await response.json()
        if (!Number.isSafeInteger(body.cursor) || body.cursor < 0 || !validNewsPage({ ...body, total: body.items?.length })) throw new Error('Invalid news alert response; retrying.')
        if (!controller.signal.aborted) {
          setNetworkError('')
          if (cursor !== null && body.items.some((item: NewsItem) => newsTimestamp(item) >= started)
            && !playNewsSound(current.current.sound)) setAudioError('Click Preview in News Flow settings to enable audio.')
          cursor = body.cursor
        }
      } catch (cause) { if (!controller.signal.aborted) setNetworkError(cause instanceof Error ? cause.message : 'News sound alerts unavailable; retrying.') }
      finally { if (!controller.signal.aborted) timer = window.setTimeout(poll, 1000) }
    }
    void poll()
    return () => { controller.abort(); window.clearTimeout(timer); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock) }
  }, [key])
  return key && (networkError || audioError) ? <div className="news-sound-status" role="status">{networkError || audioError}</div> : null
}
