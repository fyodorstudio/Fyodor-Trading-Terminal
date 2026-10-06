import { useSyncExternalStore } from 'react'
import { contextPriority } from '../core/policy'
import type { ContextFamily } from '../core/contracts'

export const contextFamiliesKey = 'fyodor.raycaster.families.v1'
const changed = `${contextFamiliesKey}:changed`
const defaults: readonly ContextFamily[] = Object.freeze([...contextPriority])
let cachedRaw: string | null | undefined
let cached = defaults
export function validContextFamilies(value: unknown): value is ContextFamily[] {
  return Array.isArray(value) && value.every(id => contextPriority.includes(id)) && new Set(value).size === value.length
}
export function validContextFamilyPreference(value: unknown): boolean {
  return validContextFamilies(value) || !!value && typeof value === 'object' &&
    'version' in value && (value.version === 2 || value.version === 3) && 'families' in value && validContextFamilies(value.families)
}
function configuredFamilies(value: unknown): readonly ContextFamily[] {
  if (validContextFamilies(value)) {
    // Only the former full default gains Claims. Partial and all-off selections survive.
    const oldDefault = ['cpi', 'nfp', 'ism', 'retail']
    return value.length === 4 && oldDefault.every(id => value.includes(id as ContextFamily)) ? defaults : value
  }
  if (validContextFamilyPreference(value)) {
    const saved = value as { version: number; families: ContextFamily[] }
    const previous = ['cpi','nfp','claims','ism','retail']
    return saved.version === 2 && saved.families.length === previous.length && previous.every(id => saved.families.includes(id as ContextFamily)) ? defaults : saved.families
  }
  return defaults
}
export function readContextFamilies(): readonly ContextFamily[] {
  if (typeof window === 'undefined') return defaults
  try {
    const raw = window.localStorage.getItem(contextFamiliesKey)
    if (raw !== cachedRaw) {
      cachedRaw = raw
      let value: unknown
      try { value = JSON.parse(raw ?? 'null') } catch { value = null }
      const selected = configuredFamilies(value)
      cached = Object.freeze(contextPriority.filter(id => selected.includes(id)))
    }
  } catch { /* Keep this session's configuration when device storage fails. */ }
  return cached
}
export function saveContextFamilies(value: readonly ContextFamily[]) {
  if (!validContextFamilies(value)) throw new RangeError('Select supported Raycaster families without duplicates.')
  const next = contextPriority.filter(id => value.includes(id))
  if (JSON.stringify(next) === JSON.stringify(readContextFamilies())) return
  const raw = JSON.stringify({ version: 3, families: next })
  try { window.localStorage.setItem(contextFamiliesKey, raw); cachedRaw = raw } catch { /* Session changes still work. */ }
  cached = Object.freeze(next)
  window.dispatchEvent(new window.Event(changed))
}
export function toggleContextFamily(id: ContextFamily) {
  const current = readContextFamilies()
  saveContextFamilies(current.includes(id) ? current.filter(f => f !== id) : [...current, id])
}
function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === contextFamiliesKey || event.key === null) listener() }
  window.addEventListener(changed, listener); window.addEventListener('storage', storage)
  return () => { window.removeEventListener(changed, listener); window.removeEventListener('storage', storage) }
}
export const useContextFamilies = () => useSyncExternalStore(subscribe, readContextFamilies, () => defaults)
