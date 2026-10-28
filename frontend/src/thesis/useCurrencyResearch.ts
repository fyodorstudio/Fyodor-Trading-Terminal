import { useEffect, useState } from 'react'
import { validCurrencyResearch, type CurrencyResearch } from './research-model'

export function useCurrencyResearch(from: string, to: string, enabled: boolean) {
  const key = `${from}:${to}`
  const [snapshot, setSnapshot] = useState<{ key: string; data: CurrencyResearch } | null>(null)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    let timer: number | undefined, revision: string | null = null
    async function pollResearch() {
      try {
        const params = new URLSearchParams({ from, to }); if (revision) params.set('after_revision', revision)
        const response = await fetch(`/storage-api/theses/research?${params}`, { signal: controller.signal })
        if (!response.ok) throw new Error(`Thesis research unavailable (HTTP ${response.status}).`)
        const data = await response.json()
        if (controller.signal.aborted) return
        if (data.unchanged ? data.schema !== 1 || data.from !== from || data.to !== to || !revision || data.revision !== revision : !validCurrencyResearch(data, from, to)) throw new Error('Invalid Thesis research response.')
        if (!data.unchanged) { revision = data.revision; setSnapshot(previous => previous?.key === key && previous.data.revision === revision ? previous : { key, data }) }
        setFailure(null)
      } catch (error) {
        if (!controller.signal.aborted) setFailure({ key, message: error instanceof Error ? error.message : 'Thesis research unavailable.' })
      }
      if (!controller.signal.aborted) timer = window.setTimeout(pollResearch, 5000)
    }
    void pollResearch()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [from, to, key, enabled])
  return { data: enabled && snapshot?.key === key ? snapshot.data : null, error: enabled && failure?.key === key ? failure.message : null }
}
