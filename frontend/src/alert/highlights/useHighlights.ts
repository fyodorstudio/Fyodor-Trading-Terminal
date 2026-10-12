import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { InspectorRelease } from '../../economic-calendar/releases/release'
import { highlightRequest, type Highlight } from './highlight-model'

const empty: Highlight[] = []
const changedEvent = 'fyodor-highlight-changed'
function validEvents(events: unknown, currency: string) {
  return Array.isArray(events) && events.every(event => event && typeof event.value_id === 'string' && typeof event.event_id === 'string'
    && typeof event.name === 'string' && event.currency === currency && typeof event.country_code === 'string'
    && [event.server_time_seconds, event.period_seconds, event.unit, event.multiplier, event.digits, event.revision].every(Number.isFinite)
    && [event.actual, event.forecast, event.previous, event.revised_previous, event.release_at].every(value => value === null || Number.isFinite(value)))
}
function validItems(value: unknown, sourceId: string): value is Highlight[] {
  return Array.isArray(value) && value.every(entry => {
    if (!entry || typeof entry !== 'object') return false
    const item = entry as Partial<Highlight>
    return item.source_id === sourceId && typeof item.id === 'string' && typeof item.label === 'string' && typeof item.currency === 'string'
      && (item.archived_utc === undefined || item.archived_utc === null || typeof item.archived_utc === 'string')
      && (item.prompts === undefined || Array.isArray(item.prompts) && item.prompts.every(prompt => prompt && prompt.highlight_id === item.id
        && prompt.source_id === sourceId && ['id','scope','saved_utc','prepare_prompt','release_prompt'].every(key => typeof prompt[key as keyof typeof prompt] === 'string')))
      && (item.journal === undefined || Array.isArray(item.journal) && item.journal.every(entry => entry && entry.highlight_id === item.id
        && entry.source_id === sourceId && ['before', 'after'].includes(entry.phase) && typeof entry.scope === 'string'
        && ['id', 'as_of_utc', 'saved_utc', 'body', 'direction', 'confidence', 'counterevidence', 'release_prompt', 'price_reaction', 'reading_vintage'].every(key => typeof entry[key as keyof typeof entry] === 'string')
        && [entry.sources, entry.expectations, entry.readings, entry.prior_highlight_ids, entry.missing_value_ids].every(Array.isArray)
        && validEvents(entry.readings, item.currency!)
        && entry.sources.every(source => source && ['web','local'].includes(source.kind) && typeof source.locator === 'string' && typeof source.label === 'string' && typeof source.note === 'string')
        && entry.prior_highlight_ids.every(id => typeof id === 'string') && entry.missing_value_ids.every(id => typeof id === 'string')
        && (entry.correction_of === null || typeof entry.correction_of === 'string')
        && (entry.trade_outcome === undefined || typeof entry.trade_outcome === 'string')
        && entry.expectations.every(expectation => expectation && ['provider','as_of_utc','values'].every(key => typeof expectation[key as keyof typeof expectation] === 'string'))))
      && (item.release_at === null || Number.isFinite(item.release_at)) && (item.server_time === null || Number.isFinite(item.server_time))
      && [item.value_ids, item.event_ids, item.missing_value_ids].every(ids => Array.isArray(ids) && ids.every(id => typeof id === 'string'))
      && validEvents(item.events, item.currency)
  })
}
function cached(sourceId: string | null): Highlight[] {
  if (!sourceId) return empty
  try {
    const value = JSON.parse(localStorage.getItem(`fyodor.highlights.${sourceId}`) ?? '[]')
    return validItems(value, sourceId) ? value : empty
  } catch { return empty }
}
export function useHighlights(sourceId: string | null, pollMs = 0, visibility: 'active' | 'archived' = 'active') {
  const cacheId = sourceId && (visibility === 'active' ? sourceId : `${sourceId}.archive`)
  const readCache = () => {
    if (!sourceId || !cacheId) return empty
    if (visibility === 'active') return cached(sourceId)
    try { const value = JSON.parse(localStorage.getItem(`fyodor.highlights.${cacheId}`) ?? '[]'); return validItems(value, sourceId) ? value : empty } catch { return empty }
  }
  const [snapshot, setSnapshot] = useState(() => ({ sourceId: cacheId, items: readCache() }))
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false)
  const [offline, setOffline] = useState(false)
  const [savedSource, setSavedSource] = useState(cacheId)
  if (savedSource !== cacheId) {
    setSavedSource(cacheId); setSnapshot({ sourceId: cacheId, items: readCache() }); setError(null); setBusy(false); setOffline(false)
  }
  const controller = useRef<AbortController | null>(null), revision = useRef<string | null>(null), sequence = useRef(0)
  const origin = useRef(Symbol())
  const refresh = useCallback(async (force = false) => {
    const signal = controller.current?.signal
    if (!sourceId || !signal || signal.aborted) return
    const token = ++sequence.current
    const params = new URLSearchParams({ source_id: sourceId, visibility })
    if (!force && revision.current) params.set('after_revision', revision.current)
    try {
      const response = await fetch(`/storage-api/highlights?${params}`, { signal })
      if (!response.ok) throw new Error(response.status === 404 ? 'Restart calendar storage to enable Highlight.' : `Highlight unavailable (HTTP ${response.status})`)
      const data = await response.json() as { highlight_schema?: number; source_id: string; source_status?: string; revision: string; unchanged?: boolean; items?: Highlight[] }
      if (signal.aborted || token !== sequence.current) return
      if (visibility === 'archived' && data.highlight_schema !== 2) throw new Error('Restart calendar storage to enable the Highlight archive.')
      if (data.source_id !== sourceId || !data.revision || (!data.unchanged && !validItems(data.items, sourceId))) throw new Error('Invalid Highlight response')
      revision.current = data.revision
      setOffline(data.source_status === 'offline' || data.source_status === 'unavailable')
      if (!data.unchanged) setSnapshot(old => {
        const items = data.items!.map(item => {
          const previous = old.sourceId === cacheId ? old.items.find(value => value.id === item.id) : undefined
          return previous && JSON.stringify(previous) === JSON.stringify(item) ? previous : item
        })
        try { localStorage.setItem(`fyodor.highlights.${cacheId}`, JSON.stringify(items)) } catch { /* Server retains the pins. */ }
        return old.sourceId === cacheId && old.items.length === items.length && old.items.every((item, index) => item === items[index]) ? old : { sourceId: cacheId, items }
      })
      setError(null)
    } catch (failure) {
      if (!signal.aborted && token === sequence.current) setError(failure instanceof Error ? failure.message : 'Highlight unavailable')
    }
  }, [sourceId, visibility, cacheId])
  useEffect(() => {
    const abort = new AbortController(); controller.current = abort; revision.current = null
    let timer: number | undefined
    async function pollHighlights() {
      await refresh()
      if (!abort.signal.aborted && sourceId && pollMs > 0) timer = window.setTimeout(pollHighlights, pollMs)
    }
    const changed = (event: Event) => {
      const detail = (event as CustomEvent<{ sourceId: string; origin: symbol }>).detail
      if (detail?.sourceId === sourceId && detail.origin !== origin.current) void refresh(true)
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
        throw new Error(response.status === 404 ? 'Restart calendar storage to enable Highlight journals and archive.' : typeof data?.detail === 'string' ? data.detail : `Could not save Highlight (HTTP ${response.status})`)
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
  const remove = useCallback((id: string) => mutate('POST', `/${encodeURIComponent(id)}/archive?${new URLSearchParams({ source_id: sourceId! })}`), [mutate, sourceId])
  const restore = useCallback((id: string) => mutate('POST', `/${encodeURIComponent(id)}/restore?${new URLSearchParams({ source_id: sourceId! })}`), [mutate, sourceId])
  const items = snapshot.sourceId === cacheId ? snapshot.items : empty
  return useMemo(() => ({ items, error, busy, offline, pin, archive: remove, restore }), [items, error, busy, offline, pin, remove, restore])
}
