import { useEffect, useState } from 'react'

// Calendar clocks use the bridge's UTC correction, never the broker wall clock.
export function useCalendarNow(clockOffsetMs = 0, intervalMs = 10_000) {
  const [now, setNow] = useState(() => Date.now() + clockOffsetMs)
  useEffect(() => {
    const update = () => setNow(Date.now() + clockOffsetMs)
    update()
    const timer = window.setInterval(update, intervalMs)
    return () => window.clearInterval(timer)
  }, [clockOffsetMs, intervalMs])
  return now
}
