import { useCallback, useEffect, useRef, useState } from 'react'
import { thesisMonth, validThesisSnapshot, type ThesisSnapshot } from './thesis-model'

export function useTheses(scope: string) {
  const key = `${scope}:${thesisMonth}`
  const [snapshot, setSnapshot] = useState<{ key: string; data: ThesisSnapshot } | null>(null)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)
  const trigger = useRef<(() => Promise<void>) | null>(null)
  const refresh = useCallback(() => { void trigger.current?.() }, [])
  useEffect(() => {
    const controller = new AbortController()
    let timer: number | undefined, revision: string | null = null, sequence = 0
    async function fetchSnapshot() {
      const token = ++sequence
      const params = new URLSearchParams({ scope, month: thesisMonth })
      if (revision) params.set('after_revision', revision)
      try {
        const response = await fetch(`/storage-api/theses?${params}`, { signal: controller.signal })
        if (!response.ok) throw new Error(response.status === 404 ? 'Restart calendar storage to enable Thesis.' : `Thesis unavailable (HTTP ${response.status})`)
        const data = await response.json()
        if (controller.signal.aborted || token !== sequence) return
        if (data.schema !== 1 || data.scope !== scope || data.month !== thesisMonth || data.source_id !== null || typeof data.revision !== 'string'
          || (data.unchanged ? data.revision !== revision : !validThesisSnapshot(data, scope, thesisMonth, null))) throw new Error('Invalid Thesis response')
        revision = data.revision
        if (!data.unchanged) setSnapshot(previous => {
          if (previous?.key === key && previous.data.revision === data.revision) return previous
          // Keep unchanged rows stable when another assessment is appended.
          const old = previous?.key === key ? previous.data : null
          const stable = <T extends object>(items: T[], previousItems: T[], identity: (item: T) => string) => items.map(item => {
            const previousItem = previousItems.find(value => identity(value) === identity(item))
            return previousItem && JSON.stringify(previousItem) === JSON.stringify(item) ? previousItem : item
          })
          return { key, data: { ...data, past: stable(data.past, old?.past ?? [], row => row.row_id) } }
        })
        setFailure(null)
      } catch (error) {
        if (!controller.signal.aborted && token === sequence) setFailure({ key, message: error instanceof Error ? error.message : 'Thesis unavailable' })
      }
    }
    async function pollTheses() { await fetchSnapshot(); if (!controller.signal.aborted) timer = window.setTimeout(pollTheses, 5000) }
    trigger.current = fetchSnapshot
    void pollTheses()
    return () => {
      controller.abort(); window.clearTimeout(timer)
      if (trigger.current === fetchSnapshot) trigger.current = null
    }
  }, [key, scope])
  return { data: snapshot?.key === key ? snapshot.data : null, error: failure?.key === key ? failure.message : null, refresh }
}
