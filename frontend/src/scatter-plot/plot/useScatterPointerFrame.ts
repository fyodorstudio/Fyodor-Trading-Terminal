import { useCallback, useEffect, useMemo, useRef } from 'react'

export function useScatterPointerFrame() {
  const frame = useRef<number | null>(null)
  const pending = useRef<(() => void) | null>(null)
  const cancel = useCallback(() => {
    if (frame.current !== null) window.cancelAnimationFrame(frame.current)
    frame.current = null
    pending.current = null
  }, [])
  const flush = useCallback(() => {
    const update = pending.current
    cancel()
    update?.()
  }, [cancel])
  const schedule = useCallback((update: () => void) => {
    pending.current = update
    if (frame.current === null) frame.current = window.requestAnimationFrame(flush)
  }, [flush])
  useEffect(() => cancel, [cancel])
  return useMemo(() => ({ schedule, flush, cancel }), [schedule, flush, cancel])
}
