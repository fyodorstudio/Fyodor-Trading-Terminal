import { useEffect, useRef, useState } from 'react'
import { validCurrencyResearch, type CurrencyResearch } from './research-model'

export function useCurrencyResearch(from: string, to: string, enabled: boolean, currency: string) {
  const key = `${from}:${to}:${currency}`
  const cache = useRef(new Map<string, CurrencyResearch>())
  const [snapshot, setSnapshot] = useState<{ key: string; data: CurrencyResearch } | null>(null)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)
  useEffect(() => {
    if (!enabled) return
    for (const cached of cache.current.keys()) if (!cached.startsWith(`${from}:${to}:`)) cache.current.delete(cached)
    const cached = cache.current.get(key)
    if (cached) setSnapshot({ key, data: cached })
    const controller = new AbortController()
    let timer: number | undefined, revision: string | null = cached?.revision ?? null
    async function pollResearch() {
      try {
        const params = new URLSearchParams({ from, to, currency }); if (revision) params.set('after_revision', revision)
        const response = await fetch(`/storage-api/theses/research?${params}`, { signal: controller.signal })
        if (!response.ok) throw new Error(`Thesis research unavailable (HTTP ${response.status}).`)
        const data = await response.json()
        if (controller.signal.aborted) return
        if (data.unchanged ? data.schema !== 1 || data.from !== from || data.to !== to || data.currency !== currency || !revision || data.revision !== revision : !validCurrencyResearch(data, from, to, currency)) throw new Error('Invalid Thesis research response.')
        if (!data.unchanged) {
          revision = data.revision
          const previous = cache.current.get(key)
          const old = new Map(previous?.developments.map(d => [d.id, d]) ?? [])
          const developments = data.developments.map((d: CurrencyResearch['developments'][number]) => {
            const retained = old.get(d.id)
            return retained && JSON.stringify(retained) === JSON.stringify(d) ? retained : d
          })
          const next = { ...data, developments }
          cache.current.set(key, next)
          setSnapshot({ key, data: next })
        }
        setFailure(null)
      } catch (error) {
        if (!controller.signal.aborted) setFailure({ key, message: error instanceof Error ? error.message : 'Thesis research unavailable.' })
      }
      if (!controller.signal.aborted) timer = window.setTimeout(pollResearch, 5000)
    }
    void pollResearch()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [from, to, key, enabled, currency])
  return { data: enabled && snapshot?.key === key ? snapshot.data : null, error: enabled && failure?.key === key ? failure.message : null }
}
