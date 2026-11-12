import { useCallback, useEffect, useRef, useState } from 'react'
import { validWildcardSnapshot, type WildcardRow, type WildcardSnapshot } from './wildcards-model'

export function useWildcards(broker: string | null) {
  const [snapshot, setSnapshot] = useState<WildcardSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0), [loading, setLoading] = useState(!!broker)
  const alive = useRef(false), writes = useRef(new Set<AbortController>())
  useEffect(() => {
    alive.current = true
    const pending = writes.current
    return () => { alive.current = false; for (const controller of pending) controller.abort(); pending.clear() }
  }, [])
  useEffect(() => {
    if (!broker) return
    let disposed = false
    const controller = new AbortController(), timeout = window.setTimeout(() => controller.abort(), 15000)
    void (async () => {
      try {
        const response = await fetch(`/storage-api/cross-asset/wildcards?source_id=${encodeURIComponent(broker)}`, { signal: controller.signal })
        if (!response.ok) throw new Error('Could not load Wildcards. Stored notes are preserved; reload to retry.')
        const data: unknown = await response.json()
        if (controller.signal.aborted || !validWildcardSnapshot(data, broker)) throw new Error('Wildcards did not match this broker or the request timed out. Reload to retry.')
        if (!disposed) { setSnapshot(data); setError(null) }
      } catch (cause) {
        if (!disposed) setError(cause instanceof Error ? cause.message : 'Could not load Wildcards.')
      } finally { window.clearTimeout(timeout); if (!disposed) setLoading(false) }
    })()
    return () => { disposed = true; controller.abort(); window.clearTimeout(timeout) }
  }, [broker, attempt])
  const reload = useCallback(() => { setLoading(true); setAttempt(value => value + 1) }, [])
  const save = useCallback(async (rows: WildcardRow[], revision: number) => {
    if (!broker) throw new Error('Choose a broker before saving Wildcards.')
    const controller = new AbortController(), timeout = window.setTimeout(() => controller.abort(), 15000)
    writes.current.add(controller)
    try {
      const response = await fetch('/storage-api/cross-asset/wildcards', { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source_id: broker, expected_revision: revision, rows }) })
      if (!response.ok) throw new Error(response.status === 409 ? 'Wildcards changed elsewhere. Copy your draft, Cancel, reload Wildcards, then reapply your edit.'
        : 'Could not save Wildcards. Your draft is retained. Retry, or reload after cancelling to check stored notes.')
      const data: unknown = await response.json()
      if (controller.signal.aborted || !validWildcardSnapshot(data, broker)) throw new Error('Save could not be verified. Your draft is retained; reload after cancelling to check stored notes.')
      if (!alive.current) return
      setSnapshot(data); setError(null)
    } catch (cause) {
      if (controller.signal.aborted) throw new Error('Save timed out. Your draft is retained; reload after cancelling to check stored notes.')
      throw cause
    } finally { window.clearTimeout(timeout); writes.current.delete(controller) }
  }, [broker])
  return { snapshot, error, loading, reload, save }
}
