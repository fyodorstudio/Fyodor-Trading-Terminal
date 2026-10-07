import { useSyncExternalStore } from 'react'
import { sameRoofAudit, validRoofAudits, type RoofAudit, type RoofAuditScope, type AuditWindow, type AuditVerdict } from './audit-model'

export const roofAuditsKey = 'fyodor.roof-audits.v1'
const changed = roofAuditsKey + ':changed'
const empty: readonly RoofAudit[] = Object.freeze([])
let cached: readonly RoofAudit[] = empty, cachedRaw: string | null | undefined

export function readRoofAudits(): readonly RoofAudit[] {
  if (typeof window === 'undefined') return empty
  try {
    const raw = window.localStorage.getItem(roofAuditsKey)
    if (raw !== cachedRaw) {
      cachedRaw = raw
      let value: unknown = null
      try { value = JSON.parse(raw ?? 'null') } catch { /* Malformed storage does not become an audit. */ }
      cached = validRoofAudits(value) ? Object.freeze(value) : empty
    }
  } catch { /* Keep session records when browser storage is unavailable. */ }
  return cached
}

export function saveRoofObservation(scope: RoofAuditScope, windowId: AuditWindow, verdict: AuditVerdict | null) {
  const records = readRoofAudits(), old = records.find(record => sameRoofAudit(record, scope))
  const observations = { ...old?.observations }
  if (verdict === null) delete observations[windowId]
  else observations[windowId] = verdict
  const next = records.filter(record => !sameRoofAudit(record, scope))
  if (Object.keys(observations).length) next.push({ ...scope, observations, updatedAt: Date.now() })
  if (!validRoofAudits(next)) throw new RangeError('Choose a valid roof audit observation.')
  const raw = JSON.stringify(next)
  let persisted = true
  try { window.localStorage.setItem(roofAuditsKey, raw); cachedRaw = raw } catch { persisted = false }
  cached = Object.freeze(next)
  window.dispatchEvent(new window.Event(changed))
  return persisted
}

function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === roofAuditsKey || event.key === null) listener() }
  window.addEventListener(changed, listener); window.addEventListener('storage', storage)
  return () => { window.removeEventListener(changed, listener); window.removeEventListener('storage', storage) }
}
export const useRoofAudits = () => useSyncExternalStore(subscribe, readRoofAudits, () => empty)
