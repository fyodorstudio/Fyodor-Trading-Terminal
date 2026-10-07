import { useEffect, useRef, useState } from 'react'

// Calendar clocks use the bridge's UTC correction, never the broker wall clock.
export function useCalendarNow(clockOffsetMs = 0, intervalMs = 10_000, enabled = true) {
  const [now, setNow] = useState(() => Date.now() + clockOffsetMs)
  const offset = useRef(clockOffsetMs)
  useEffect(() => {
    const changed = Math.abs(offset.current - clockOffsetMs)
    offset.current = clockOffsetMs
    // Bridge latency corrections arrive every two seconds. Small corrections
    // apply on the next clock sample; real clock/source changes apply immediately.
    if (enabled && changed >= 1000) setNow(Date.now() + clockOffsetMs)
  }, [clockOffsetMs, enabled])
  useEffect(() => {
    if (!enabled) return
    const update = () => setNow(Date.now() + offset.current)
    update()
    const timer = window.setInterval(update, intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs, enabled])
  return now
}
