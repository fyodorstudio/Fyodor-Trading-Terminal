import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { SymbolQuote } from '../market-data/contracts/SymbolQuote'
import { alertDirection, evaluatePriceAlerts, priceAlertStorageKey, readPriceAlerts, savePriceAlerts,
  type PriceAlertStore } from './price-alert-store'
import { createPriceAlertSound } from './price-alert-sound'

export function usePriceAlerts(brokerId: string | null, quotes: SymbolQuote[], live: boolean) {
  const [store, setStore] = useState(readPriceAlerts)
  const current = useRef(store)
  const feed = useRef({ brokerId, quotes, live })
  useLayoutEffect(() => { feed.current = { brokerId, quotes, live } }, [brokerId, quotes, live])
  const [storageError, setStorageError] = useState(false)
  const [soundBlocked, setSoundBlocked] = useState(false)
  const sound = useRef<ReturnType<typeof createPriceAlertSound> | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; sound.current?.dispose(); sound.current = null }
  }, [])
  const commit = useCallback((next: PriceAlertStore) => {
    current.current = next
    setStorageError(!savePriceAlerts(next))
    setStore(next)
  }, [])
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== priceAlertStorageKey && event.key !== null) return
      const next = readPriceAlerts(); current.current = next; setStore(next)
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  const enableSound = useCallback(async () => {
    sound.current ??= createPriceAlertSound()
    setSoundBlocked(true)
    const enabled = await sound.current.unlock()
    if (mounted.current) setSoundBlocked(!enabled)
  }, [])
  const previewSound = useCallback(async () => {
    sound.current ??= createPriceAlertSound()
    const engine = sound.current
    setSoundBlocked(true)
    const enabled = await engine.unlock()
    const played = enabled && engine.play(current.current.duration)
    if (mounted.current) setSoundBlocked(!played)
  }, [])
  const playAlertSound = useCallback(() => {
    const played = sound.current?.play(current.current.duration) ?? false
    setSoundBlocked(!played)
  }, [])
  useEffect(() => {
    if (!live || !brokerId) return
    const evaluated = evaluatePriceAlerts(current.current.alerts, brokerId, quotes, Date.now())
    if (evaluated.alerts === current.current.alerts) return
    const next = { ...current.current, alerts: evaluated.alerts }
    // Persist the one-shot transition before requesting sound, even if playback fails.
    commit(next)
    if (evaluated.triggered.length && next.playSound) playAlertSound()
  }, [brokerId, quotes, live, store, commit, playAlertSound])
  const addAlert = useCallback((symbol: string, price: number, precision: number) => {
    const { brokerId, quotes, live } = feed.current
    if (!brokerId || !Number.isFinite(price) || price <= 0) return ''
    const target = Number(price.toFixed(precision))
    if (target <= 0) return ''
    const id = crypto.randomUUID()
    const bid = live ? quotes.find(quote => quote.symbol === symbol)?.bid : undefined
    commit({ ...current.current, alerts: [...current.current.alerts, {
      id, brokerId, symbol, price: target, precision, direction: alertDirection(target, bid), status: 'armed',
      createdAt: Date.now(), triggeredAt: null, triggeredBid: null,
    }] })
    return id
  }, [commit])
  const updateAlert = useCallback((id: string, action: 'pause' | 'arm' | 'delete' | 'price', price?: number) => {
    const { brokerId, quotes, live } = feed.current
    if (action === 'price' && (price === undefined || !Number.isFinite(price) || price <= 0)) return
    const alerts = current.current.alerts.flatMap(alert => {
      if (alert.id !== id) return [alert]
      if (action === 'delete') return []
      if (action === 'pause') return [{ ...alert, status: 'paused' as const }]
      const target = action === 'price' ? Number(price!.toFixed(alert.precision)) : alert.price
      if (target <= 0) return [alert]
      const bid = live && alert.brokerId === brokerId ? quotes.find(quote => quote.symbol === alert.symbol)?.bid : undefined
      return [{ ...alert, price: target, direction: alertDirection(target, bid), status: 'armed' as const,
        triggeredAt: null, triggeredBid: null }]
    })
    commit({ ...current.current, alerts })
  }, [commit])
  const setSound = useCallback((playSound: boolean, duration: number) => {
    commit({ ...current.current, playSound, duration })
    if (playSound) void enableSound()
    else sound.current?.stop()
  }, [commit, enableSound])
  const brokerAlerts = useMemo(() => store.alerts.filter(alert => alert.brokerId === brokerId), [store.alerts, brokerId])
  const liveSymbols = useMemo(() => new Set(quotes.filter(quote => Number.isFinite(quote.bid) && quote.bid > 0).map(quote => quote.symbol)), [quotes])
  return { alerts: store.alerts, brokerAlerts, addAlert, updateAlert, playSound: store.playSound, duration: store.duration,
    setSound, enableSound, previewSound, soundBlocked, storageError, live, liveSymbols }
}

export type PriceAlertsController = ReturnType<typeof usePriceAlerts>
