import { useSyncExternalStore } from 'react'
import { readNewsSettings, saveNewsSettings, type NewsSettings } from './model'
import type { NewsDateSelection } from './date-range'

const listeners = new Set<() => void>()
let current: NewsSettings | null = null, serialized: string | null = null
function snapshot() {
  const next = JSON.stringify(readNewsSettings())
  if (!current || next !== serialized) { current = JSON.parse(next); serialized = next }
  return current!
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => { listeners.delete(listener); window.removeEventListener('storage', listener) }
}
function change(value: NewsSettings | ((old: NewsSettings) => NewsSettings)) {
  const next = typeof value === 'function' ? value(snapshot()) : value
  saveNewsSettings(next)
  // Also retain changes for this session when browser storage is unavailable.
  serialized = JSON.stringify(readNewsSettings()); current = next
  for (const listener of listeners) listener()
}
export function useNewsSettings() {
  return [useSyncExternalStore(subscribe, snapshot), change] as const
}

export function selectNewsDate(selection: NewsDateSelection) {
  change(old => ({ ...old, date: selection.date, session: { start: selection.start, end: selection.end } }))
}
