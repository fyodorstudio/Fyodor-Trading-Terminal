import { useSyncExternalStore } from 'react'
import { contextPriority } from '../../usd-context/core/policy'
import type { ContextFamily } from '../../usd-context/core/contracts'

export const raycasterFamiliesKey = 'fyodor.raycaster.families.v1'
const changed = `${raycasterFamiliesKey}:changed`
const defaults: readonly ContextFamily[] = Object.freeze([...contextPriority])
let cachedRaw: string | null | undefined
let cached = defaults
export function validRaycasterFamilies(value: unknown): value is ContextFamily[] {
  return Array.isArray(value) && value.every(id => contextPriority.includes(id)) && new Set(value).size === value.length
}
export function readRaycasterFamilies(): readonly ContextFamily[] {
  if (typeof window === 'undefined') return defaults
  try {
    const raw = window.localStorage.getItem(raycasterFamiliesKey)
    if (raw !== cachedRaw) {
      cachedRaw = raw
      let value: unknown
      try { value = JSON.parse(raw ?? 'null') } catch { value = null }
      cached = validRaycasterFamilies(value) ? Object.freeze(contextPriority.filter(id => value.includes(id))) : defaults
    }
  } catch { /* Keep this session's configuration when device storage fails. */ }
  return cached
}
export function saveRaycasterFamilies(value: readonly ContextFamily[]) {
  if (!validRaycasterFamilies(value)) throw new RangeError('Select supported Raycaster families without duplicates.')
  const next = contextPriority.filter(id => value.includes(id))
  if (JSON.stringify(next) === JSON.stringify(readRaycasterFamilies())) return
  const raw = JSON.stringify(next)
  try { window.localStorage.setItem(raycasterFamiliesKey, raw); cachedRaw = raw } catch { /* Session changes still work. */ }
  cached = Object.freeze(next)
  window.dispatchEvent(new window.Event(changed))
}
export function toggleRaycasterFamily(id: ContextFamily) {
  const current = readRaycasterFamilies()
  saveRaycasterFamilies(current.includes(id) ? current.filter(f => f !== id) : [...current, id])
}
function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === raycasterFamiliesKey || event.key === null) listener() }
  window.addEventListener(changed, listener); window.addEventListener('storage', storage)
  return () => { window.removeEventListener(changed, listener); window.removeEventListener('storage', storage) }
}
export const useRaycasterFamilies = () => useSyncExternalStore(subscribe, readRaycasterFamilies, () => defaults)
