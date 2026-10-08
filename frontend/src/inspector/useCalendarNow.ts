import { useContext, useEffect, useRef, useState } from 'react'
import { UtcClockCorrectionContext } from '../appearance/time-display/utc-clock-correction'

// Calendar clocks use the bridge's UTC correction, never the broker wall clock.
export function useCalendarNow(clockOffsetMs = 0, intervalMs = 10_000, enabled = true) {
  const correction = useContext(UtcClockCorrectionContext)
  const [now, setNow] = useState(() => Date.now() + (correction?.read() ?? clockOffsetMs))
  const offset = useRef(correction?.read() ?? clockOffsetMs)
  useEffect(() => {
    const updateOffset = () => {
      const next = correction?.read() ?? clockOffsetMs
      const changed = Math.abs(offset.current - next)
      offset.current = next
      // Bridge latency corrections arrive every two seconds. Small corrections
      // apply on the next clock sample; real clock/source changes apply immediately.
      if (enabled && changed >= 1000) setNow(Date.now() + next)
    }
    updateOffset()
    return correction?.subscribe(updateOffset)
  }, [correction, clockOffsetMs, enabled])
  useEffect(() => {
    if (!enabled) return
    const update = () => setNow(Date.now() + offset.current)
    update()
    const timer = window.setInterval(update, intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs, enabled])
  return now
}
