import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExternalSource } from './external-source-model'

// Existing immutable archive/restore versions also retain an external pin's history.
export function useExternalPin(refresh: () => void) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null), pending = useRef(false)
  useEffect(() => {
    const abort = new AbortController(); controller.current = abort
    return () => abort.abort()
  }, [])
  const changePin = useCallback(async (item: ExternalSource) => {
    const signal = controller.current?.signal
    if (!signal || signal.aborted || pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      const response = await fetch(`/storage-api/external-sources/${encodeURIComponent(item.key)}/${item.archived ? 'restore' : 'archive'}`, {
        method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expected_version: item.id }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(typeof body?.detail === 'string' ? body.detail : 'Could not update External Source pin. Refresh and try again.')
      }
      if (!signal.aborted) refresh()
    } catch (failure) {
      if (!signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not update External Source pin')
    } finally { pending.current = false; if (!signal.aborted) setBusy(false) }
  }, [refresh])
  return { changePin, busy, error }
}
