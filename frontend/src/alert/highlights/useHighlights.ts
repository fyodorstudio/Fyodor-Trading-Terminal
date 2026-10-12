import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { InspectorRelease } from '../../economic-calendar/releases/release'
import { highlightRequest, type Highlight } from './highlight-model'

const empty: Highlight[] = []
const changedEvent = 'fyodor-highlight-changed'
function cached(sourceId: string | null): Highlight[] {
  if (!sourceId) return empty
  try {
    const value = JSON.parse(localStorage.getItem(`fyodor.highlights.${sourceId}`) ?? '[]')
    return Array.isArray(value) && value.every(item => item.source_id === sourceId && Array.isArray(item.events) && Array.isArray(item.value_ids)) ? value : empty
  } catch { return empty }
}
export function useHighlights(sourceId: string | null, pollMs = 0) {
  const [snapshot, setSnapshot] = useState(() => ({ sourceId, items: cached(sourceId) }))
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false)
  const [offline, setOffline] = useState(false)
  const [savedSource, setSavedSource] = useState(sourceId)
  if (savedSource !== sourceId) {
    setSavedSource(sourceId); setSnapshot({ sourceId, items: cached(sourceId) }); setError(null); setBusy(false); setOffline(false)
  }
  const controller = useRef<AbortController | null>(null), revision = useRef<string | null>(null), sequence = useRef(0)
  const origin = useRef(Symbol())
  const refresh = useCallback(async (force = false) => {
    const signal = controller.current?.signal
    if (!sourceId || !signal || signal.aborted) return
    const token = ++sequence.current
    const params = new URLSearchParams({ source_id: sourceId })
    if (!force && revision.current) params.set('after_revision', revision.current)
    try {
      const response = await fetch(`/storage-api/highlights?${params}`, { signal })
      if (!response.ok) throw new Error(response.status === 404 ? 'Restart calendar storage to enable Highlight.' : `Highlight unavailable (HTTP ${response.status})`)
      const data = await response.json() as { source_id: string; source_status?: string; revision: string; unchanged?: boolean; items?: Highlight[] }
      if (signal.aborted || token !== sequence.current) return
      if (data.source_id !== sourceId || !data.revision || (!data.unchanged && !Array.isArray(data.items))) throw new Error('Invalid Highlight response')
      revision.current = data.revision
      setOffline(data.source_status === 'offline' || data.source_status === 'unavailable')
      if (!data.unchanged) setSnapshot(old => {
        const items = data.items!.map(item => {
          const previous = old.sourceId === sourceId ? old.items.find(value => value.id === item.id) : undefined
          return previous && JSON.stringify(previous) === JSON.stringify(item) ? previous : item
        })
        try { localStorage.setItem(`fyodor.highlights.${sourceId}`, JSON.stringify(items)) } catch { /* Server retains the pins. */ }
        return old.sourceId === sourceId && old.items.length === items.length && old.items.every((item, index) => item === items[index]) ? old : { sourceId, items }
      })
      setError(null)
    } catch (failure) {
      if (!signal.aborted && token === sequence.current) setError(failure instanceof Error ? failure.message : 'Highlight unavailable')
    }
  }, [sourceId])
  useEffect(() => {
    const abort = new AbortController(); controller.current = abort; revision.current = null
    let timer: number | undefined
    async function pollHighlights() {
      await refresh()
      if (!abort.signal.aborted && sourceId && pollMs > 0) timer = window.setTimeout(pollHighlights, pollMs)
    }
    const changed = (event: Event) => {
      const detail = (event as CustomEvent<{ sourceId: string; origin: symbol }>).detail
      if (detail.sourceId === sourceId && detail.origin !== origin.current) void refresh(true)
    }
    window.addEventListener(changedEvent, changed)
    void pollHighlights()
    return () => { abort.abort(); window.clearTimeout(timer); window.removeEventListener(changedEvent, changed) }
  }, [sourceId, pollMs, refresh])
  const mutate = useCallback(async (method: 'POST' | 'DELETE', path: string, body?: unknown) => {
    const signal = controller.current?.signal
    if (!sourceId || !signal || signal.aborted) return
    setBusy(true)
    try {
      const response = await fetch(`/storage-api/highlights${path}`, { method, signal,
        headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(typeof data?.detail === 'string' ? data.detail : `Could not ${method === 'POST' ? 'pin' : 'remove'} release (HTTP ${response.status})`)
      }
      if (!signal.aborted) {
        await refresh(true)
        if (!signal.aborted) window.dispatchEvent(new window.CustomEvent(changedEvent, { detail: { sourceId, origin: origin.current } }))
      }
    } catch (failure) {
      if (!signal.aborted) setError(failure instanceof Error ? failure.message : 'Highlight could not be saved')
    } finally { if (!signal.aborted) setBusy(false) }
  }, [sourceId, refresh])
  const pin = useCallback((release: InspectorRelease) => mutate('POST', '', highlightRequest(release, sourceId!)), [mutate, sourceId])
  const remove = useCallback((id: string) => mutate('DELETE', `/${encodeURIComponent(id)}?${new URLSearchParams({ source_id: sourceId! })}`), [mutate, sourceId])
  const items = snapshot.sourceId === sourceId ? snapshot.items : empty
  return useMemo(() => ({ items, error, busy, offline, pin, remove }), [items, error, busy, offline, pin, remove])
}
