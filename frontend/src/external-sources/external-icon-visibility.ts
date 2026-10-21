import { useMemo, useSyncExternalStore } from 'react'
import type { ExternalSource } from './external-source-model'

export const externalIconVisibilityKey = 'fyodor.external-sources.chart-icons.v1'
const changed = 'fyodor-external-icon-visibility-changed'
type IconChoice = boolean | { visible: boolean; requestId: string | null }
export type ExternalIconPreferences = Readonly<Record<string, IconChoice>>
function validChoice(value: unknown): value is IconChoice {
  return typeof value === 'boolean' || !!value && typeof value === 'object' &&
    'visible' in value && typeof value.visible === 'boolean' && 'requestId' in value &&
    (value.requestId === null || typeof value.requestId === 'string' && /^[0-9a-f]{32}$/.test(value.requestId))
}
function snapshot() {
  try { return localStorage.getItem(externalIconVisibilityKey) ?? '{}' } catch { return '{}' }
}
function preferences(raw: string): ExternalIconPreferences {
  try {
    const value = JSON.parse(raw)
    if (!value || Array.isArray(value) || typeof value !== 'object') return {}
    return Object.fromEntries(Object.entries(value).filter(([key, choice]) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key) && validChoice(choice))) as Record<string, IconChoice>
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
export function externalIconEnabled(item: ExternalSource, settings: ExternalIconPreferences) {
  const choice = settings[item.key]
  if (!item.archived && item.chart_icon_request_id &&
    (typeof choice !== 'object' || choice.requestId !== item.chart_icon_request_id)) return true
  return typeof choice === 'boolean' ? choice : choice?.visible ?? !item.archived
}
export function setExternalIconVisibility(key: string, visible: boolean, requestId: string | null = null) {
  try {
    localStorage.setItem(externalIconVisibilityKey, JSON.stringify({ ...preferences(snapshot()), [key]: { visible, requestId } }))
    window.dispatchEvent(new window.Event(changed))
    return true
  } catch { return false }
}
