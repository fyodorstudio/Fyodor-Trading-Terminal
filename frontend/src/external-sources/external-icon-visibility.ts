import { useMemo, useSyncExternalStore } from 'react'
import type { ExternalSource } from './external-source-model'

export const externalIconVisibilityKey = 'fyodor.external-sources.chart-icons.v1'
const changed = 'fyodor-external-icon-visibility-changed'
function snapshot() {
  try { return localStorage.getItem(externalIconVisibilityKey) ?? '{}' } catch { return '{}' }
}
function preferences(raw: string): Readonly<Record<string, boolean>> {
  try {
    const value = JSON.parse(raw)
    if (!value || Array.isArray(value) || typeof value !== 'object') return {}
    return Object.fromEntries(Object.entries(value).filter(([key, visible]) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key) && typeof visible === 'boolean')) as Record<string, boolean>
  } catch { return {} }
}
function subscribe(notify: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === externalIconVisibilityKey || event.key === null) notify() }
  window.addEventListener(changed, notify); window.addEventListener('storage', storage)
  return () => { window.removeEventListener(changed, notify); window.removeEventListener('storage', storage) }
}
export function useExternalIconVisibility() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => '{}')
  return useMemo(() => preferences(raw), [raw])
}
export function externalIconEnabled(item: ExternalSource, settings: Readonly<Record<string, boolean>>) {
  return Object.hasOwn(settings, item.key) ? settings[item.key] : !item.archived
}
export function setExternalIconVisibility(key: string, visible: boolean) {
  try {
    localStorage.setItem(externalIconVisibilityKey, JSON.stringify({ ...preferences(snapshot()), [key]: visible }))
    window.dispatchEvent(new window.Event(changed))
    return true
  } catch { return false }
}
