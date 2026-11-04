import { useSyncExternalStore } from 'react'

const key = 'fyodor.external-sources.ongoing-risks-visible.v1'
const changed = 'fyodor-ongoing-risk-visibility-changed'
function snapshot() {
  try { return localStorage.getItem(key) !== 'false' } catch { return true }
}
function subscribe(notify: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) notify() }
  window.addEventListener(changed, notify); window.addEventListener('storage', storage)
  return () => { window.removeEventListener(changed, notify); window.removeEventListener('storage', storage) }
}
export function useOngoingRiskVisibility() {
  return useSyncExternalStore(subscribe, snapshot, () => true)
}
export function setOngoingRiskVisibility(visible: boolean) {
  try {
    localStorage.setItem(key, String(visible))
    window.dispatchEvent(new window.Event(changed))
    return true
  } catch { return false }
}
