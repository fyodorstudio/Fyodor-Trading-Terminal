import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import type { PriceAlert, PriceAlertStore } from './price-alert-store'

export const priceSoundRecoveryMs = 5 * 60_000
const key = (alert: PriceAlert) => alert.soundDeliveryId ?? `${alert.id}:${alert.triggeredAt}:${alert.price}`

// Persisted trigger state and sound delivery are separate. Browser audio failure
// must never silently consume a one-shot crossing or require crossing it again.
export function usePriceAlertDelivery(store: PriceAlertStore, current: RefObject<PriceAlertStore>, commit: (next: PriceAlertStore) => void,
  attempt: (valid: () => boolean) => Promise<boolean>) {
  const timer = useRef(0), inFlight = useRef(false), mounted = useRef(true)
  const runner = useRef<() => Promise<void>>(async () => {})
  const flush = useCallback(async () => {
    window.clearTimeout(timer.current)
    if (!mounted.current) return
    const now = Date.now(), state = current.current
    const pending = state.alerts.filter(alert => alert.status === 'triggered' && alert.soundStatus === 'pending')
    if (!pending.length) return
    const expired = new Set(pending.filter(alert => alert.triggeredAt === null || now - alert.triggeredAt > priceSoundRecoveryMs).map(key))
    if (expired.size || !state.playSound || state.volume === 0) {
      commit({ ...state, alerts: state.alerts.map(alert => alert.soundStatus !== 'pending' ? alert :
        { ...alert, soundStatus: !state.playSound || state.volume === 0 ? 'muted' : expired.has(key(alert)) ? 'missed' : 'pending' }) })
    }
    const batch = new Set(current.current.alerts.filter(alert => alert.status === 'triggered' && alert.soundStatus === 'pending').map(key))
    if (!batch.size || inFlight.current) return
    inFlight.current = true
    const valid = () => mounted.current && current.current.playSound && current.current.volume > 0 &&
      current.current.alerts.some(alert => alert.status === 'triggered' && alert.soundStatus === 'pending' && batch.has(key(alert)) &&
        alert.triggeredAt !== null && Date.now() - alert.triggeredAt <= priceSoundRecoveryMs)
    try {
      const played = await attempt(valid)
      if (played && valid()) commit({ ...current.current, alerts: current.current.alerts.map(alert =>
        batch.has(key(alert)) && alert.soundStatus === 'pending' ? { ...alert,
          soundStatus: alert.triggeredAt !== null && Date.now() - alert.triggeredAt <= priceSoundRecoveryMs ? 'played' : 'missed' } : alert) })
    } catch { /* Remain pending, with a visible status and bounded retry. */ }
    finally {
      inFlight.current = false
      if (mounted.current && current.current.alerts.some(alert => alert.soundStatus === 'pending')) timer.current = window.setTimeout(() => void runner.current(), 1000)
    }
  }, [attempt, commit, current])
  useLayoutEffect(() => { runner.current = flush }, [flush])
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; window.clearTimeout(timer.current) } }, [])
  useEffect(() => { void flush() }, [store, flush])
  const silence = useCallback(() => {
    const state = current.current
    if (state.alerts.some(alert => alert.soundStatus === 'pending' || alert.soundStatus === 'missed')) commit({ ...state,
      alerts: state.alerts.map(alert => alert.soundStatus === 'pending' || alert.soundStatus === 'missed' ? { ...alert, soundStatus: 'muted' } : alert) })
    window.clearTimeout(timer.current)
  }, [commit, current])
  return { flush, silence, pendingSounds: store.alerts.filter(alert => alert.soundStatus === 'pending').length,
    missedSounds: store.alerts.filter(alert => alert.soundStatus === 'missed').length }
}
