import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { validWildcards, wildcardDay, type WildcardDraft, type WildcardEntry, type WildcardSnapshot } from './wildcard-model'

type Editor = { entry?: WildcardEntry; at?: number; date?: string } | { items: WildcardEntry[]; date: string }
export function useWildcardsState() {
  const [snapshot, setSnapshot] = useState<WildcardSnapshot | null>(null)
  const [error, setError] = useState(''), [saving, setSaving] = useState(false), [attempt, setAttempt] = useState(0)
  const [editor, setEditor] = useState<Editor | null>(null), [placing, setPlacing] = useState(false)
  const requests = useRef(new Set<AbortController>()), snapshotRef = useRef(snapshot), busy = useRef(false), draftRevision = useRef<number | null>(null)
  useEffect(() => { snapshotRef.current = snapshot }, [snapshot])
  useEffect(() => {
    const pending = requests.current, controller = new AbortController()
    pending.add(controller)
    let timer = 0
    async function read() {
      try {
        const response = await fetch('/storage-api/wildcards', { signal: controller.signal })
        if (!response.ok) throw new Error('Could not load Wildcards. Reload to retry.')
        const body: unknown = await response.json()
        if (!validWildcards(body)) throw new Error('Invalid Wildcards response')
        if (!controller.signal.aborted && !busy.current && body.revision >= (snapshotRef.current?.revision ?? 0)) {
          snapshotRef.current = body
          setSnapshot(old => old?.revision === body.revision ? old : body); setError('')
        }
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load Wildcards') }
      finally { if (!controller.signal.aborted) timer = window.setTimeout(read, 30_000) }
    }
    void read()
    return () => { controller.abort(); pending.delete(controller); window.clearTimeout(timer) }
  }, [attempt])
  useEffect(() => { const pending = requests.current; return () => { for (const request of pending) request.abort(); pending.clear() } }, [])
  const reload = useCallback(() => setAttempt(value => value + 1), [])
  const close = useCallback(() => { if (!busy.current) setEditor(null) }, [])
  const openNew = useCallback((at?: number, date?: string) => { draftRevision.current = snapshotRef.current?.revision ?? null; setPlacing(false); setEditor({ at, date: date ?? wildcardDay(at ?? Date.now()) }) }, [])
  const openEntry = useCallback((entry: WildcardEntry) => { draftRevision.current = snapshotRef.current?.revision ?? null; setPlacing(false); setEditor({ entry }) }, [])
  const openDay = useCallback((date: string, items: WildcardEntry[]) => { setPlacing(false); setEditor({ date, items }) }, [])
  const mutate = useCallback(async (entry: WildcardDraft | null, identity?: string) => {
    if (busy.current) return
    const current = snapshotRef.current
    if (!current) throw new Error('Load Wildcards before saving')
    busy.current = true; setSaving(true)
    const controller = new AbortController(); requests.current.add(controller)
    try {
      const deleting = entry === null
      const revision = draftRevision.current ?? current.revision
      const path = `/storage-api/wildcards${identity ? `/${encodeURIComponent(identity)}` : ''}${deleting ? `?expected_revision=${revision}` : ''}`
      const response = await fetch(path, { method: deleting ? 'DELETE' : identity ? 'PUT' : 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, ...(entry ? { body: JSON.stringify({ ...entry, expected_revision: revision }) } : {}) })
      if (!response.ok) {
        if (response.status === 409) { draftRevision.current = null; reload(); throw new Error('Wildcards changed elsewhere. Review your draft and save again after reload.') }
        throw new Error('Could not save Wildcards. Your draft is retained.')
      }
      const body: unknown = await response.json()
      if (!validWildcards(body)) throw new Error('Save response could not be verified. Reload before retrying.')
      if (!controller.signal.aborted) { snapshotRef.current = body; setSnapshot(body); setError(''); setEditor(null) }
    } finally {
      requests.current.delete(controller); busy.current = false
      if (!controller.signal.aborted) setSaving(false)
    }
  }, [reload])
  return useMemo(() => ({ snapshot, error, saving, reload, editor, close, openNew, openEntry, openDay, mutate, placing, setPlacing }),
    [snapshot, error, saving, reload, editor, close, openNew, openEntry, openDay, mutate, placing])
}
export const WildcardsContext = createContext<ReturnType<typeof useWildcardsState> | null>(null)
export function useWildcards() {
  const value = useContext(WildcardsContext)
  if (!value) throw new Error('Wildcards requires WildcardsProvider')
  return value
}
export function useOptionalWildcards() { return useContext(WildcardsContext) }
