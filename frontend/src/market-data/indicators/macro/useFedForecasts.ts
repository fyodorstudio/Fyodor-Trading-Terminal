import { useEffect, useState } from 'react'
import { parseFedForecasts, type FedForecasts } from './fed-forecast'

const empty: FedForecasts = { meetings: new Map(), status: 'Fed forecasts not loaded' }
export function useFedForecasts(active: boolean): FedForecasts {
  const [state, setState] = useState<FedForecasts>(empty)
  useEffect(() => {
    if (!active) return
    const abort = new AbortController()
    let timer = 0, signature = ''
    async function poll() {
      try {
        const response = await fetch('/storage-api/fed-forecasts', { signal: abort.signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const body: unknown = await response.json()
        if (abort.signal.aborted) return
        const next = JSON.stringify(body)
        if (next !== signature) {
          const meetings = parseFedForecasts(body)
          setState({ meetings, status: meetings.size ? 'Saved external Fed evidence' : 'No saved Fed forecast evidence' })
          signature = next
        }
      } catch (error) {
        if (!abort.signal.aborted) {
          signature = ''
          const status = `Fed forecast cache unavailable${error instanceof Error ? ` · ${error.message}` : ''}`
          setState(old => old.status === status ? old : { meetings: old.meetings, status })
        }
      } finally {
        if (!abort.signal.aborted) timer = window.setTimeout(poll, 60_000)
      }
    }
    void poll()
    return () => { abort.abort(); window.clearTimeout(timer) }
  }, [active])
  return active ? state : empty
}
