import { useEffect, useState } from 'react'
import { chartEventCurrencies } from '../economic-calendar/forex/chart-event-scope'
import { validDetail, type DetailSnapshot } from './detail-model'

export function useCurrencyDetails(broker: string | null, symbol: string) {
  const currencies = chartEventCurrencies(symbol)
  const scope = currencies.join(',')
  const key = JSON.stringify([broker, scope])
  const [state, setState] = useState<{ key: string; data: DetailSnapshot | null; error: string | null } | null>(null)
  useEffect(() => {
    if (!broker || !scope) return
    const abort = new AbortController()
    let timer = 0, current: DetailSnapshot | null = null
    async function pollDetail() {
      try {
        const query = new URLSearchParams({ source_id: broker!, scope: currencies.join('') })
        if (current) query.set('after_revision', current.revision)
        const response = await fetch(`/storage-api/currency-details?${query}`, { signal: abort.signal })
        if (!response.ok) throw new Error(`Detail unavailable (HTTP ${response.status})`)
        const value = await response.json()
        if (abort.signal.aborted) return
        if (!(value?.unchanged === true && current && value.schema === 1 && value.broker === broker
          && value.currencies?.join(',') === scope && value.revision === current.revision)) {
          if (!validDetail(value, broker!, currencies)) throw new Error('Invalid Detail response')
          current = value
        }
        const data = current
        setState(old => old?.key === key && old.data?.revision === data?.revision && !old.error ? old : { key, data, error: null })
      } catch (error) {
        if (!abort.signal.aborted) setState(old => ({ key, data: old?.key === key ? old.data : null,
          error: error instanceof Error ? error.message : 'Detail unavailable' }))
      } finally {
        if (!abort.signal.aborted) timer = window.setTimeout(pollDetail, 30_000)
      }
    }
    void pollDetail()
    return () => { abort.abort(); window.clearTimeout(timer) }
  }, [broker, scope, key, currencies])
  const active = state?.key === key ? state : null
  return { data: active?.data ?? null, error: active?.error, loading: !!broker && !!scope && !active, currencies }
}
