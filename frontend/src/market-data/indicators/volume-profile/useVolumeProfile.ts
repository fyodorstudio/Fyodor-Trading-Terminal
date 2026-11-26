import { useEffect, useRef, useState } from 'react'
import { bridgeRequest } from '../../../system-connectivity/bridge-status/bridge-client'
import { buildTickProfile, profilePages, type ProfileWindow, type TickProfile } from './volume-profile'

type TickPage = { digits: number; levels: [number, number][]; missing_minutes: number | null; source_generation: number }
type Reading = { key: string; profile: TickProfile | null; loading: boolean; incomplete: boolean }
const cacheLimit = 120

export function useVolumeProfile(symbol: string, scope: string, generation: number, offset: number, range: ProfileWindow | null) {
  const [reading, setReading] = useState<Reading | null>(null)
  const [attempt, setAttempt] = useState(0)
  const cache = useRef({ scope: '', pages: new Map<string, TickPage>() })
  const from = range?.from, to = range?.to
  const key = range ? `${scope}:${from}:${to}:${attempt}` : ''

  useEffect(() => {
    if (from === undefined || to === undefined) return
    if (cache.current.scope !== scope) cache.current = { scope, pages: new Map() }
    const { pages } = cache.current
    const controller = new AbortController()
    const { signal } = controller
    let timer = 0
    const chartNow = () => Date.now() / 1000 + offset
    const now = chartNow()
    const windows = profilePages({ from, to })
    const levels = new Map<number, number>()
    let digits: number | undefined
    let historicIncomplete = false
    let openWindows = windows.filter(window => window.to > now)
    let activePages: TickPage[] = []
    let activeIncomplete = false

    async function read(window: ProfileWindow, closed: boolean) {
      const pageKey = `${window.from}:${window.to}`
      const saved = pages.get(pageKey)
      if (saved) return saved
      try {
        const query = new URLSearchParams({ symbol, start: String(window.from), end: String(window.to) })
        const page = await bridgeRequest<TickPage>(`/volume-profile?${query}`, signal)
        if (signal.aborted || page.source_generation !== generation) return null
        if (closed && page.missing_minutes === 0) {
          pages.set(pageKey, page)
          if (pages.size > cacheLimit) pages.delete(pages.keys().next().value!)
        }
        return page
      } catch { return null }
    }
    function add(target: Map<number, number>, page: TickPage | null) {
      if (!page || (digits !== undefined && page.digits !== digits)) return false
      digits = page.digits
      for (const [level, count] of page.levels) target.set(level, (target.get(level) ?? 0) + count)
      return page.missing_minutes === 0
    }
    function publish(loading: boolean) {
      if (signal.aborted) return
      const combined = activePages.length ? new Map(levels) : levels
      let incomplete = activeIncomplete || historicIncomplete
      for (const page of activePages) {
        if (!add(combined, page)) incomplete = true
      }
      setReading({ key, profile: digits === undefined ? null : buildTickProfile(combined, digits), loading, incomplete })
    }
    async function readOpenWindows() {
      activePages = []
      activeIncomplete = false
      const pending: ProfileWindow[] = []
      const at = chartNow()
      for (const window of openWindows) {
        if (signal.aborted) return
        if (window.from >= at) { pending.push(window); continue }
        const closed = window.to <= at
        const page = await read(window, closed)
        if (closed) {
          if (!add(levels, page)) historicIncomplete = true
        } else {
          pending.push(window)
          if (page) activePages.push(page)
          else activeIncomplete = true
        }
      }
      openWindows = pending
    }
    async function refresh() {
      await readOpenWindows()
      if (signal.aborted) return
      publish(false)
      if (openWindows.length) timer = window.setTimeout(refresh, 20_000)
    }
    async function load() {
      await readOpenWindows()
      let lastPublish = performance.now()
      for (const window of windows) {
        if (signal.aborted) return
        if (window.to > now) continue
        const page = await read(window, true)
        if (!add(levels, page)) historicIncomplete = true
        if (performance.now() - lastPublish >= 200) {
          publish(true)
          lastPublish = performance.now()
        }
      }
      publish(false)
      if (openWindows.length && !signal.aborted) timer = window.setTimeout(refresh, 20_000)
    }
    timer = window.setTimeout(load, 175)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [key, from, to, symbol, scope, generation, offset])

  return { current: key && reading?.key === key ? reading : null, retry: () => setAttempt(value => value + 1) }
}
