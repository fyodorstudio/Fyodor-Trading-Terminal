import { useEffect, useState } from 'react'
import { bridgeRequest, bridgeResponse } from '../../../system-connectivity/bridge-status/bridge-client'
import { buildTickProfile, type ProfileWindow, type TickProfile } from './volume-profile'

type TickPage = { digits: number; levels: [number, number][]; missing_minutes: number | null; source_generation: number }
type HistoryFrame = {
  digits: number | null; levels: [number, number][]; source_generation: number
  done: boolean; incomplete: boolean; checked: number; total: number
}
type Reading = { key: string; scope: string; to: number; profile: TickProfile | null; loading: boolean; incomplete: boolean; checked: number; total: number }
const secondsPerDay = 86_400

async function readHistory(query: URLSearchParams, signal: AbortSignal, onFrame: (frame: HistoryFrame) => void) {
  const response = await bridgeResponse(`/volume-profile/range?${query}`, signal, 'application/x-ndjson')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Tick history stream unavailable')
  const decoder = new TextDecoder()
  let pending = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      pending += decoder.decode(value, { stream: !done })
      const lines = pending.split('\n')
      pending = lines.pop() ?? ''
      for (const line of lines) if (line.trim()) onFrame(JSON.parse(line) as HistoryFrame)
      if (done) {
        if (pending.trim()) onFrame(JSON.parse(pending) as HistoryFrame)
        break
      }
    }
  } catch (error) {
    if (!signal.aborted) await reader.cancel().catch(() => {})
    throw error
  } finally { reader.releaseLock() }
}

export function useVolumeProfile(symbol: string, scope: string, generation: number, offset: number, range: ProfileWindow | null, refreshLive = true) {
  const [reading, setReading] = useState<Reading | null>(null)
  const [retry, setRetry] = useState({ window: '', version: 0 })
  const [rollover, setRollover] = useState(0)
  const from = range?.from, to = range?.to
  const windowKey = range ? `${scope}:${from}:${to}` : ''
  const attempt = windowKey === retry.window ? retry.version : 0
  const key = windowKey ? `${windowKey}:${attempt}:${rollover}` : ''

  useEffect(() => {
    if (from === undefined || to === undefined) return
    const requestedEnd = to
    const controller = new AbortController()
    const { signal } = controller
    const chartNow = () => Date.now() / 1000 + offset
    const startOfDay = () => Math.floor(chartNow() / secondsPerDay) * secondsPerDay
    const today = startOfDay()
    const historyEnd = Math.min(to, today)
    const liveFrom = Math.max(from, today)
    const liveEnd = Math.min(to, today + secondsPerDay)
    let history: HistoryFrame | undefined
    let live: TickPage | undefined
    let historyLoading = from < historyEnd
    let liveLoading = liveFrom < liveEnd && liveFrom < chartNow()
    let historyFailed = false, liveFailed = false
    let retryLive = attempt > 0
    let timer = 0

    function publish() {
      if (signal.aborted) return
      const digits = history?.digits ?? live?.digits
      const levels = new Map(history?.levels)
      const differentPrecision = !!live && live.digits !== digits
      if (live && !differentPrecision) {
        for (const [price, count] of live.levels) levels.set(price, (levels.get(price) ?? 0) + count)
      }
      const next: Reading = {
        key, scope, to: requestedEnd, profile: digits === undefined ? null : buildTickProfile(levels, digits),
        loading: historyLoading || liveLoading,
        incomplete: historyFailed || liveFailed || Boolean(history?.incomplete) || differentPrecision || (!!live && live.missing_minutes !== 0),
        checked: history?.checked ?? 0, total: history?.total ?? 0,
      }
      setReading(previous => next.loading && previous?.scope === scope &&
        (refreshLive ? !next.profile : previous.to <= next.to)
        ? { ...next, profile: previous.profile, to: previous.to } : next)
    }
    async function loadHistory() {
      if (!historyLoading) return
      const query = new URLSearchParams({ symbol, start: String(from), end: String(historyEnd), broker_offset: String(offset) })
      if (attempt) query.set('retry', 'true')
      try {
        await readHistory(query, signal, frame => {
          if (signal.aborted || frame.source_generation !== generation) return
          history = frame
          historyLoading = !frame.done
          publish()
        })
        historyFailed = !history?.done
      } catch { historyFailed = true }
      historyLoading = false
      publish()
    }
    async function loadLive() {
      if (liveFrom >= liveEnd || liveFrom >= chartNow()) return
      try {
        const query = new URLSearchParams({ symbol, start: String(liveFrom), end: String(liveEnd), broker_offset: String(offset) })
        if (retryLive) query.set('retry', 'true')
        retryLive = false
        const page = await bridgeRequest<TickPage>(`/volume-profile?${query}`, signal)
        liveFailed = page.source_generation !== generation
        if (!liveFailed) live = page
      } catch { liveFailed = true }
      liveLoading = false
      publish()
    }
    async function refresh() {
      if (startOfDay() !== today) {
        setRollover(value => value + 1)
        return
      }
      await loadLive()
      if (!signal.aborted) timer = window.setTimeout(refresh, 20_000)
    }
    async function load() {
      await Promise.all([loadHistory(), loadLive()])
      if (signal.aborted) return
      publish()
      if (refreshLive && liveFrom < liveEnd) timer = window.setTimeout(refresh, 20_000)
    }
    timer = window.setTimeout(load, 175)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [key, scope, from, to, symbol, generation, offset, attempt, refreshLive])

  return { current: key && reading?.key === key ? reading : null,
    profile: reading?.scope === scope && (refreshLive || (to !== undefined && reading.to <= to)) ? reading.profile : null,
    retry: () => setRetry({ window: windowKey, version: attempt + 1 }) }
}
