import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type AlarmEvent = { key: string; reference: string; source: 'highlight' | 'external' | 'calendar'; broker: string | null; title: string;
  value_ids?: string[]; selected?: boolean;
  currencies: string[]; at: number | null; date: string | null; eligible: boolean; armed: boolean; note: string; prompt: string }
export type AlarmJob = { id: string; event_key: string; title: string; at: number; due: number; stage: string; prompt: string;
  status: string; error: string | null; snooze_until?: number }
export type AlarmSettings = { enabled: boolean; release_minutes: number }
export type AlarmSnapshot = { application: 'fyodor-alarms'; revision: number; now: number; native_available: boolean;
  schedule_schema?: number; migration?: { matches: { from: string; to: string; enabled: boolean }[]; issues: { key: string; title: string; reason: string }[] } | null;
  settings: AlarmSettings; events: AlarmEvent[]; jobs: AlarmJob[]; schedule_error: string | null; refreshed_at: number | null }
function valid(value: unknown): value is AlarmSnapshot {
  if (!value || typeof value !== 'object') return false
  const data = value as AlarmSnapshot
  return data.application === 'fyodor-alarms' && Number.isSafeInteger(data.revision) && Number.isFinite(data.now)
    && typeof data.native_available === 'boolean' && typeof data.settings?.enabled === 'boolean'
    && Number.isInteger(data.settings.release_minutes) && data.settings.release_minutes >= 1 && data.settings.release_minutes <= 120
    && (data.schedule_error === null || typeof data.schedule_error === 'string')
    && Array.isArray(data.events) && data.events.every(event => event && ['key', 'reference', 'title', 'note', 'prompt'].every(key => typeof event[key as keyof AlarmEvent] === 'string')
      && ['highlight', 'external', 'calendar'].includes(event.source) && Array.isArray(event.currencies) && event.currencies.every(currency => typeof currency === 'string')
      && (event.at === null || Number.isFinite(event.at)) && (event.date === null || typeof event.date === 'string') && typeof event.armed === 'boolean' && typeof event.eligible === 'boolean')
    && Array.isArray(data.jobs) && data.jobs.every(job => job && ['id', 'title', 'stage', 'status', 'prompt'].every(key => typeof job[key as keyof AlarmJob] === 'string')
      && [job.at, job.due].every(Number.isFinite))
}
export function useAlarms(pollMs = 2000) {
  const [data, setData] = useState<AlarmSnapshot | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const controller = useRef<AbortController | null>(null), current = useRef(data), sequence = useRef(0), mutating = useRef(false)
  const signature = useRef('')
  const accept = useCallback((next: unknown) => {
    if (!valid(next)) throw new Error('Invalid alarm worker response')
    const nextSignature = JSON.stringify({ ...next, now: 0, refreshed_at: 0 })
    if (signature.current !== nextSignature) { signature.current = nextSignature; setData(next) }
    current.current = next
  }, [])
  const refresh = useCallback(async () => {
    if (mutating.current) return
    const signal = controller.current?.signal, token = ++sequence.current
    if (!signal || signal.aborted) return
    try {
      const response = await fetch('/alarm-api/alarms', { signal })
      if (!response.ok) throw new Error('Alarm worker unavailable. Run pnpm alarms:start.')
      const next = await response.json()
      if (signal.aborted || token !== sequence.current || mutating.current) return
      accept(next); setError('')
    } catch (failure) { if (!signal.aborted && token === sequence.current) setError(failure instanceof Error ? failure.message : 'Alarm worker unavailable') }
  }, [accept])
  useEffect(() => {
    const abort = new AbortController(); controller.current = abort
    let timer: number | undefined
    async function pollAlarms() { await refresh(); if (!abort.signal.aborted) timer = window.setTimeout(pollAlarms, pollMs) }
    void pollAlarms()
    return () => { abort.abort(); window.clearTimeout(timer) }
  }, [refresh, pollMs])
  const mutate = useCallback(async (action: Record<string, unknown>) => {
    const signal = controller.current?.signal
    if (!signal || signal.aborted || mutating.current) return false
    mutating.current = true; ++sequence.current; setBusy(true)
    try {
      const response = await fetch('/alarm-api/alarms', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...action, expected_revision: current.current?.revision }) })
      const next = await response.json()
      if (!response.ok) throw new Error(typeof next.detail === 'string' ? next.detail : 'Could not update alarms')
      if (signal.aborted) return false
      if (action.action !== 'test') accept(next)
      setError(''); return true
    } catch (failure) {
      if (!signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not update alarms')
      return false
    } finally { mutating.current = false; ++sequence.current; if (!signal.aborted) setBusy(false) }
  }, [accept])
  return useMemo(() => ({ data, error, busy, mutate }), [data, error, busy, mutate])
}

export function alarmWorkerLabel(data: AlarmSnapshot | null, error: string) {
  return error || !data ? 'Alarms unavailable' : data.schedule_error ? 'Alarm schedule unavailable' : !data.native_available ? 'Desktop alarms unsupported' :
    data.settings.enabled ? 'Alarms running' : 'Alarms paused'
}
