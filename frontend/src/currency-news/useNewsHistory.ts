import { useEffect, useRef, useState } from 'react'
import { validNewsHistory, validSavedNews, type NewsHistory, type SavedNews } from './news-model'

// History is fetched only on explicit navigation/reload; it never polls or writes.
export function useNewsHistory(date: string, enabled: boolean) {
  const [listing, setListing] = useState<NewsHistory | null>(null)
  const [choice, setChoice] = useState('')
  const [snapshot, setSnapshot] = useState<{ date: string; data: SavedNews } | null>(null)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)
  const [listFailure, setListFailure] = useState<{ date: string; message: string } | null>(null)
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState(false)
  const more = useRef<() => void>(() => {})
  const list = enabled && listing?.date === date ? listing : null
  const selected = list?.runs.find(r => r.run_id === choice) ?? list?.runs[0] ?? null
  const id = selected?.run_id ?? '', savedAt = selected?.saved_at ?? ''
  const key = `${date}:${id}`

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    let previous: NewsHistory | null = null, pending = false
    async function load(before: string | null) {
      if (pending) return
      pending = true; setBusy(true)
      try {
        const params = new URLSearchParams({ date }); if (before) params.set('before', before)
        const response = await fetch(`/storage-api/currency-news/history?${params}`, { signal: controller.signal })
        if (!response.ok) throw new Error(`News history unavailable (HTTP ${response.status}).`)
        const value = await response.json()
        if (controller.signal.aborted) return
        if (!validNewsHistory(value, date)) throw new Error('Invalid news history response.')
        const runs = before && previous ? [...new Map([...previous.runs, ...value.runs].map(r => [r.run_id, r])).values()] : value.runs
        previous = { ...value, runs }
        setListing(previous); setListFailure(null)
      } catch (error) {
        if (!controller.signal.aborted) setListFailure({ date, message: error instanceof Error ? error.message : 'News history unavailable.' })
      } finally {
        pending = false
        if (!controller.signal.aborted) setBusy(false)
      }
    }
    more.current = () => { if (previous?.next_before) void load(previous.next_before) }
    void load(null)
    return () => { controller.abort(); more.current = () => {} }
  }, [date, enabled, reload])

  useEffect(() => {
    if (!enabled || !id) return
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(`/storage-api/currency-news/history/${id}`, { signal: controller.signal })
        if (!response.ok) throw new Error(`Saved refresh unavailable (HTTP ${response.status}).`)
        const value = await response.json()
        if (controller.signal.aborted) return
        if (!validSavedNews(value, id) || value.saved_at !== savedAt) throw new Error('Invalid saved refresh response.')
        setSnapshot({ date, data: value }); setFailure(null)
      } catch (error) {
        if (!controller.signal.aborted) setFailure({ key, message: error instanceof Error ? error.message : 'Saved refresh unavailable.' })
      }
    }
    void load()
    return () => controller.abort()
  }, [date, enabled, id, savedAt, key, reload])

  return { list, selected: id, select: setChoice,
    data: enabled && id && snapshot?.date === date && snapshot.data.run_id === id ? snapshot.data : null,
    error: enabled ? (listFailure?.date === date ? listFailure.message : failure?.key === key ? failure.message : null) : null,
    busy, reload: () => setReload(n => n + 1), loadMore: () => more.current() }
}
