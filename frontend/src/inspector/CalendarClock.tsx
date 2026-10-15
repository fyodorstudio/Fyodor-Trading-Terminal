import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { displayDateKey } from '../economic-calendar/time/calendar-display-range'
import type { TimeDisplayPreference } from '../appearance/time-display/time-display-preference'
import { useCalendarNow } from './useCalendarNow'
import { CalendarNowContext, useCountdownNow } from './calendar-clock'

const utcDisplay: TimeDisplayPreference = { mode: 'utc', utcOffsetMinutes: 0 }

// Only time-label consumers subscribe. The collection and its cards keep their
// existing element identities while this provider's local clock advances.
export function CalendarClock({ children, clockOffsetMs = 0 }: { children: ReactNode; clockOffsetMs?: number }) {
  const now = useCalendarNow(clockOffsetMs, 1000)
  return <CalendarNowContext.Provider value={now}>{children}</CalendarNowContext.Provider>
}

// Reevaluate collection membership/order only at a release/horizon boundary or
// day change. Binary search keeps ordinary ticks independent of inventory size.
export function CalendarBoundary({ times, onBoundary, timeDisplay = utcDisplay, dayOffsetMinutes = 0 }: {
  times: readonly number[]; onBoundary: (now: number) => void; timeDisplay?: TimeDisplayPreference; dayOffsetMinutes?: number
}) {
  const [fallback] = useState(Date.now)
  const now = useCountdownNow(fallback)
  const sorted = useMemo(() => [...new Set(times.filter(Number.isFinite))].sort((a, b) => a - b), [times])
  let low = 0, high = sorted.length
  while (low < high) { const middle = (low + high) >>> 1; if (sorted[middle] <= now) low = middle + 1; else high = middle }
  const day = displayDateKey(now, timeDisplay), sourceDay = Math.floor((now + dayOffsetMinutes * 60000) / 86400000)
  const bucket = `${low}:${day}:${sourceDay}`
  const published = useRef<{ bucket: string; times: number[]; callback: typeof onBoundary } | null>(null)
  useEffect(() => {
    const previous = published.current
    if (previous?.bucket === bucket && previous.times === sorted && previous.callback === onBoundary) return
    published.current = { bucket, times: sorted, callback: onBoundary }
    onBoundary(now)
  }, [now, bucket, sorted, onBoundary])
  return null
}
