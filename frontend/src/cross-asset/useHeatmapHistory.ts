import { useEffect, useRef, useState } from 'react'
import { validHeatmapHistory, type HeatmapHistory } from './heatmap-model'

export function useHeatmapHistory(broker: string | null, generation: number, names: string, year: number, attempt: number) {
  const key = `${broker}:${generation}:${year}:${names}`
  const [state, setState] = useState<{ key: string; data: HeatmapHistory | null; error: string | null }>({ key: '', data: null, error: null })
  const retry = useRef(attempt)
  useEffect(() => {
    if (broker !== 'Pepperstone-Demo' || !names) return
    let disposed = false, timer = 0, timeout = 0, controller: AbortController | undefined
    let force = retry.current !== attempt
    retry.current = attempt
    async function pollHeatmap() {
      controller = new AbortController()
      timeout = window.setTimeout(() => controller?.abort(), 22_000)
      try {
        const response = await fetch('/storage-api/cross-asset/history', { method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_id: broker, generation, year, symbols: names.split('\0'), retry: force }) })
        force = false
        if (!response.ok) throw new Error(`Heatmap history unavailable (HTTP ${response.status}). Retry after checking the broker connection.`)
        const data: unknown = await response.json()
        if (controller.signal.aborted) throw new Error('Heatmap history request timed out. Retry to check the connection.')
        if (!validHeatmapHistory(data, broker!, generation, year)) throw new Error('Heatmap history source or data did not match this request.')
        if (disposed) return
        setState(old => ({ key, data: old.key === key && old.data?.revision === data.revision && old.data.today === data.today ? old.data : data, error: null }))
        timer = window.setTimeout(pollHeatmap, data.pending > 0 ? 1_000 : 20_000)
      } catch (error) {
        if (!disposed) {
          setState(old => ({ key, data: old.key === key ? old.data : null,
            error: error instanceof Error ? error.message : 'Heatmap history unavailable' }))
          timer = window.setTimeout(pollHeatmap, 20_000)
        }
      } finally { window.clearTimeout(timeout) }
    }
    void pollHeatmap()
    return () => { disposed = true; controller?.abort(); window.clearTimeout(timer); window.clearTimeout(timeout) }
  }, [broker, generation, names, year, key, attempt])
  const active = state.key === key ? state : null
  return { data: active?.data ?? null, error: broker && broker !== 'Pepperstone-Demo'
    ? 'Heatmap history currently supports the connected Pepperstone-Demo source.' : active?.error ?? null }
}
