import { useSyncExternalStore } from 'react'
import { validExternalEvents, type ExternalEvent } from '../core/external-event'
export const externalEventsKey = 'fyodor.external-events.v1'
const changed = externalEventsKey + ':changed', empty: readonly ExternalEvent[] = Object.freeze([])
let cached = empty, cachedRaw: string | null | undefined
export function readExternalEvents() {
  if (typeof window === 'undefined') return empty
  try {
    const raw = window.localStorage.getItem(externalEventsKey)
    if (raw !== cachedRaw) {
      cachedRaw = raw
      let value: unknown = null
      try { value = JSON.parse(raw ?? 'null') } catch { /* Malformed data never becomes a chart note. */ }
      cached = validExternalEvents(value) ? Object.freeze(value.map(e => Object.freeze({ ...e }))) : empty
    }
  } catch { /* Retain session notes if browser storage is unavailable. */ }
  return cached
}
function write(next: ExternalEvent[]) {
  if (!validExternalEvents(next)) throw new RangeError('Provide a title, valid chart-clock range and a note of at most 4,000 characters.')
  const raw = JSON.stringify(next)
  let persisted = true
  try { window.localStorage.setItem(externalEventsKey, raw); cachedRaw = raw } catch { persisted = false }
  cached = Object.freeze(next.map(e => Object.freeze({ ...e })))
  window.dispatchEvent(new window.Event(changed))
  return persisted
}
export function saveExternalEvent(draft: Omit<ExternalEvent, 'id' | 'createdAt' | 'updatedAt'>, id?: string) {
  const records = readExternalEvents(), old = records.find(e => e.id === id)
  if (old && (old.brokerId !== draft.brokerId || old.symbol !== draft.symbol)) throw new RangeError('Edit this note in its original broker and pair.')
  const at = Date.now(), next = { ...draft, title: draft.title.trim(), id: old?.id ?? `external/${at}/${Math.random().toString(36).slice(2)}`, createdAt: old?.createdAt ?? at, updatedAt: at }
  const persisted = write([...records.filter(e => e.id !== next.id), next].sort((a, b) => a.from - b.from || a.id.localeCompare(b.id)))
  return { event: next, persisted }
}
export function deleteExternalEvent(id: string) { return write(readExternalEvents().filter(e => e.id !== id)) }
function subscribe(listener: () => void) {
  const storage = (e: StorageEvent) => { if (e.key === externalEventsKey || e.key === null) listener() }
  window.addEventListener(changed, listener); window.addEventListener('storage', storage)
  return () => { window.removeEventListener(changed, listener); window.removeEventListener('storage', storage) }
}
export const useExternalEvents = () => useSyncExternalStore(subscribe, readExternalEvents, () => empty)
