import { useSyncExternalStore } from 'react'

export type NewsAlertProfile = {
  mode: 'off' | 'priority' | 'included' | 'all'; max_age_seconds: number | null; unified_alerts: boolean
  connection: null | { server: string; reader: string; topic: string; reader_password: string }
  error: string; last_sent: null | { at: number; count: number; title: string; url: string }
}
type Snapshot = { data: NewsAlertProfile | null; loading: boolean; saving: boolean; error: string }
let snapshot: Snapshot = { data: null, loading: true, saving: false, error: '' }
const listeners = new Set<() => void>()
let poll: AbortController | null = null, mutation: AbortController | null = null, timer = 0, revision = 0
function update(change: Partial<Snapshot>) { snapshot = { ...snapshot, ...change }; for (const listener of listeners) listener() }
function valid(value: NewsAlertProfile) {
  return value && ['off', 'priority', 'included', 'all'].includes(value.mode) &&
    (value.max_age_seconds == null || Number.isInteger(value.max_age_seconds) && value.max_age_seconds >= 3600 && value.max_age_seconds <= 31536000)
}
async function load() {
  if (!listeners.size || snapshot.saving) return
  const version = revision, controller = new AbortController(); poll = controller
  try {
    const response = await fetch('/storage-api/news-flow/notifications', { signal: controller.signal })
    if (!response.ok) throw Error('Shared news alert settings unavailable; retrying.')
    const body = await response.json()
    if (!valid(body)) throw Error('Invalid news alert settings; retrying.')
    if (!controller.signal.aborted && version === revision) update({ data: { ...body, max_age_seconds: body.max_age_seconds === undefined ? 86400 : body.max_age_seconds }, loading: false, error: '' })
  } catch (cause) {
    if (!controller.signal.aborted && version === revision) update({ loading: false, error: cause instanceof Error ? cause.message : 'Could not load news alerts.' })
  } finally {
    if (!controller.signal.aborted && listeners.size) timer = window.setTimeout(load, 5000)
  }
}
export async function saveNewsAlertProfile(mode: NewsAlertProfile['mode'], maxAgeSeconds: number | null) {
  if (snapshot.saving) return false
  revision++; poll?.abort(); window.clearTimeout(timer)
  const controller = new AbortController(); mutation = controller
  update({ saving: true, error: '' })
  try {
    const response = await fetch('/storage-api/news-flow/notifications/settings', { method: 'PUT', signal: controller.signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, max_age_seconds: maxAgeSeconds }) })
    if (!response.ok) throw Error('Could not save shared news alerts. Previous settings remain active.')
    const body = await response.json()
    if (!valid(body)) throw Error('Invalid saved news alert settings.')
    if (controller.signal.aborted) return false
    update({ data: body, loading: false, error: '' }); return true
  } catch (cause) {
    if (!controller.signal.aborted) update({ error: cause instanceof Error ? cause.message : 'Could not save news alerts.' })
    return false
  } finally {
    if (!controller.signal.aborted) { update({ saving: false }); if (listeners.size) timer = window.setTimeout(load, 5000) }
  }
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) void load()
  return () => {
    listeners.delete(listener)
    if (!listeners.size) {
      revision++; poll?.abort(); mutation?.abort(); window.clearTimeout(timer)
      snapshot = { data: null, loading: true, saving: false, error: '' }
    }
  }
}
export function useNewsAlertProfile() { return useSyncExternalStore(subscribe, () => snapshot) }
