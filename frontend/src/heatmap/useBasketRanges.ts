import { useEffect, useRef, useState } from 'react'
import { validBasketRanges, type BasketRanges } from './basket-ranges'

export function useBasketRanges(broker: string | null, generation: number, request: string, attempt: number, enabled: boolean) {
  const key = `${broker}:${generation}:${request}`
  const retry = useRef(attempt)
  const [state, setState] = useState<{ key: string; data: BasketRanges | null; error: string | null }>({ key: '', data: null, error: null })
  useEffect(() => {
    if (!enabled || !request || broker !== 'Pepperstone-Demo') return
    let disposed = false, timer = 0, timeout = 0, controller: AbortController | undefined
    let force = retry.current !== attempt
    retry.current = attempt
    async function poll() {
      controller = new AbortController()
      timeout = window.setTimeout(() => controller?.abort(), 22_000)
      try {
        const response = await fetch('/storage-api/heatmap/baskets', { method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...JSON.parse(request), source_id: broker, generation, retry: force }) })
        force = false
        if (!response.ok) throw new Error(`Basket minute ranges unavailable (HTTP ${response.status}). Closing returns remain available.`)
        const data: unknown = await response.json()
        if (controller.signal.aborted || !validBasketRanges(data, broker!, generation, request)) throw new Error('Basket range response did not match this request.')
        if (disposed) return
        setState({ key, data, error: null })
        timer = window.setTimeout(poll, data.pending ? 1000 : 20_000)
      } catch (error) {
        if (!disposed) {
          setState(old => ({ key, data: old.key === key ? old.data : null, error: error instanceof Error ? error.message : 'Basket minute ranges unavailable' }))
          timer = window.setTimeout(poll, 20_000)
        }
      } finally { window.clearTimeout(timeout) }
    }
    void poll()
    return () => { disposed = true; controller?.abort(); window.clearTimeout(timer); window.clearTimeout(timeout) }
  }, [broker, generation, request, key, enabled, attempt])
  return state.key === key ? state : { key, data: null, error: null }
}
