import { useEffect, useState } from 'react'
import { validNewsSnapshot, type NewsSnapshot } from './news-model'

export function useCurrencyNews(enabled = true) {
  const [data, setData] = useState<NewsSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    let timer: number | undefined, previous: NewsSnapshot | null = null
    async function pollNews() {
      try {
        const params = previous ? `?after_revision=${previous.revision}` : ''
        const response = await fetch(`/storage-api/currency-news${params}`, { signal: controller.signal })
        if (!response.ok) throw new Error(`Currency news unavailable (HTTP ${response.status}).`)
        const value = await response.json()
        if (controller.signal.aborted) return
        if (value?.unchanged === true) {
          if (value.schema !== 1 || !previous || value.revision !== previous.revision) throw new Error('Invalid currency news response.')
        } else {
          if (!validNewsSnapshot(value)) throw new Error('Invalid currency news response.')
          const oldRows = new Map(previous?.rows.map(row => [row.currency, row]) ?? [])
          const rows = value.rows.map(row => {
            const old = oldRows.get(row.currency)
            return old && JSON.stringify(old) === JSON.stringify(row) ? old : row
          })
          const next = { ...value, rows }
          if (!previous || previous.revision !== next.revision) setData(next)
          previous = next
        }
        setError(null)
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Currency news unavailable.')
      }
      if (!controller.signal.aborted) timer = window.setTimeout(pollNews, 5000)
    }
    void pollNews()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [reload, enabled])
  return { data: enabled ? data : null, error: enabled ? error : null, reload: () => setReload(n => n + 1) }
}
