import { useSyncExternalStore } from 'react'
import { validRoofDisplayId } from '../core/relationship-display'

export const sequencePreferencesKey = 'fyodor.context-sequences.v1'
const changed = sequencePreferencesKey + ':changed'
export type SequencePreferences = { roofs: boolean; fresh: boolean; ribbon?: boolean; density?: 'focused' | 'all' | 'concise';
  raycasterCandy?: boolean; roofCandy?: boolean; hiddenRoofs?: readonly string[] }
const defaults: Readonly<SequencePreferences> = Object.freeze({ roofs: true, fresh: true, ribbon: false })
let cached: SequencePreferences = defaults, cachedRaw: string | null | undefined
export function validSequencePreferences(v: unknown): v is SequencePreferences {
  return !!v && typeof v === 'object' && 'roofs' in v && typeof v.roofs === 'boolean' && 'fresh' in v && typeof v.fresh === 'boolean' &&
    (!('ribbon' in v) || typeof v.ribbon === 'boolean') && (!('density' in v) || v.density === 'focused' || v.density === 'all' || v.density === 'concise') &&
    (!('raycasterCandy' in v) || typeof v.raycasterCandy === 'boolean') && (!('roofCandy' in v) || typeof v.roofCandy === 'boolean') &&
    (!('hiddenRoofs' in v) || Array.isArray(v.hiddenRoofs) && v.hiddenRoofs.every(validRoofDisplayId) && new Set(v.hiddenRoofs).size === v.hiddenRoofs.length)
}
export function readSequencePreferences() {
  if (typeof window === 'undefined') return defaults
  try {
    const raw = window.localStorage.getItem(sequencePreferencesKey)
    if (raw !== cachedRaw) {
      cachedRaw = raw
      let value: unknown = null
      try { value = JSON.parse(raw ?? 'null') } catch { /* Invalid saved values use defaults. */ }
      cached = validSequencePreferences(value) ? Object.freeze({ roofs: value.roofs, fresh: value.fresh,
        ...(value.ribbon === undefined ? {} : { ribbon: value.ribbon }), ...(value.density === undefined ? {} : { density: value.density }),
        ...(value.raycasterCandy === undefined ? {} : { raycasterCandy: value.raycasterCandy }), ...(value.roofCandy === undefined ? {} : { roofCandy: value.roofCandy }),
        ...(value.hiddenRoofs === undefined ? {} : { hiddenRoofs: Object.freeze([...value.hiddenRoofs]) }) }) : defaults
    }
  } catch { /* Retain session settings if storage is unavailable. */ }
  return cached
}
export function saveSequencePreferences(next: SequencePreferences) {
  if (!validSequencePreferences(next)) throw new RangeError('Choose valid sequence display settings.')
  if (JSON.stringify(readSequencePreferences()) === JSON.stringify(next)) return
  const raw = JSON.stringify(next)
  try { window.localStorage.setItem(sequencePreferencesKey, raw); cachedRaw = raw } catch { /* Session changes remain usable. */ }
  cached = Object.freeze({ ...next, ...(next.hiddenRoofs ? { hiddenRoofs: Object.freeze([...next.hiddenRoofs]) } : {}) })
  window.dispatchEvent(new window.Event(changed))
}
function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === sequencePreferencesKey || event.key === null) listener() }
  window.addEventListener(changed, listener); window.addEventListener('storage', storage)
  return () => { window.removeEventListener(changed, listener); window.removeEventListener('storage', storage) }
}
export const useSequencePreferences = () => useSyncExternalStore(subscribe, readSequencePreferences, () => defaults)
