import { useSyncExternalStore } from 'react'
import type { NewsItem } from './model'

type AlertStatus = { ready: boolean; error: string; pending: number; last: { items: NewsItem[]; at: number; played: boolean } | null }
let status: AlertStatus = { ready: false, error: '', pending: 0, last: null }
const listeners = new Set<() => void>()
export function updateNewsAlertStatus(change: Partial<AlertStatus>) {
  status = { ...status, ...change }
  for (const listener of listeners) listener()
}
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function useNewsAlertStatus() { return useSyncExternalStore(subscribe, () => status) }
