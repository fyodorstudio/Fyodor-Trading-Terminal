import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { SymbolQuote } from '../market-data/contracts/SymbolQuote'
import { alertDirection, evaluatePriceAlerts, priceAlertStorageKey, readPriceAlerts, savePriceAlerts,
  type PriceAlertStore } from './price-alert-store'
import { createPriceAlertSound } from './price-alert-sound'
import type { PriceAlertSoundId } from './price-alert-tones'
import { customAlertSoundKey, customAlertSoundMaxBytes, decodeCustomAlertSound, encodeCustomAlertSound,
  readCustomAlertSound, saveCustomAlertSound } from './custom-alert-sound'

export function usePriceAlerts(brokerId: string | null, quotes: SymbolQuote[], live: boolean) {
  const [store, setStore] = useState(readPriceAlerts)
  const current = useRef(store)
  const feed = useRef({ brokerId, quotes, live })
  useLayoutEffect(() => { feed.current = { brokerId, quotes, live } }, [brokerId, quotes, live])
  const [storageError, setStorageError] = useState(false)
  const [soundBlocked, setSoundBlocked] = useState(false)
  const [customSoundName, setCustomSoundName] = useState(() => readCustomAlertSound()?.name ?? null)
  const [customSoundError, setCustomSoundError] = useState('')
  const [customSoundLoading, setCustomSoundLoading] = useState(false)
  const customRequest = useRef(0)
  const playbackRequest = useRef(0)
  const loadedCustomData = useRef<string | null>(null)
  const draggingAlertId = useRef<string | null>(null)
  const sound = useRef<ReturnType<typeof createPriceAlertSound> | null>(null)
  const mounted = useRef(true)
  const invalidateCustom = useCallback(() => { customRequest.current++; playbackRequest.current++; loadedCustomData.current = null }, [])
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; invalidateCustom(); sound.current?.dispose(); sound.current = null }
  }, [invalidateCustom])
  const commit = useCallback((next: PriceAlertStore) => {
    current.current = next
    setStorageError(!savePriceAlerts(next))
    setStore(next)
  }, [])
  const prepareCustomSound = useCallback(async (engine: ReturnType<typeof createPriceAlertSound>) => {
    if (!mounted.current || sound.current !== engine) return false
    if (current.current.soundId !== 'custom') return true
    const source = readCustomAlertSound()
    if (!source) {
      setCustomSoundError('Custom sound is missing. Upload an audio file again.')
      return false
    }
    if (loadedCustomData.current === source.data) return true
    const request = customRequest.current
    try {
      const buffer = await engine.decodeCustom(decodeCustomAlertSound(source.data))
      if (!mounted.current || sound.current !== engine || request !== customRequest.current) return false
      engine.setCustomBuffer(buffer); loadedCustomData.current = source.data
      setCustomSoundError('')
      return true
    } catch (error) {
      if (mounted.current && request === customRequest.current) setCustomSoundError((error as Error).message)
      return false
    }
  }, [])
  const enableSound = useCallback(async () => {
    sound.current ??= createPriceAlertSound()
    const engine = sound.current
    setSoundBlocked(true)
    const enabled = await engine.unlock()
    await prepareCustomSound(engine)
    if (mounted.current && sound.current === engine) setSoundBlocked(!enabled)
  }, [prepareCustomSound])
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== customAlertSoundKey && event.key !== priceAlertStorageKey && event.key !== null) return
      playbackRequest.current++
      sound.current?.stop()
      if (event.key !== priceAlertStorageKey) {
        invalidateCustom(); sound.current?.setCustomBuffer(null)
        setCustomSoundName(readCustomAlertSound()?.name ?? null)
        setCustomSoundLoading(false)
      }
      if (event.key !== customAlertSoundKey) {
        const next = readPriceAlerts(); current.current = next; setStore(next)
      }
      if (sound.current && current.current.soundId === 'custom') void enableSound()
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [enableSound, invalidateCustom])
  const previewSound = useCallback(async () => {
    const request = ++playbackRequest.current
    sound.current ??= createPriceAlertSound()
    const engine = sound.current
    setSoundBlocked(true)
    const enabled = await engine.unlock()
    const ready = await prepareCustomSound(engine)
    if (!mounted.current || sound.current !== engine || request !== playbackRequest.current) return
    const played = enabled && ready && engine.play(current.current.duration, current.current.soundId)
    setSoundBlocked(!enabled || (ready && !played))
  }, [prepareCustomSound])
  const uploadCustomSound = useCallback(async (file: File) => {
    const request = ++customRequest.current
    playbackRequest.current++
    setCustomSoundError(''); setCustomSoundLoading(true)
    try {
      if (!/\.(mp3|wav|ogg)$/i.test(file.name)) throw new Error('Choose an MP3, WAV or OGG audio file.')
      if (!file.size || file.size > customAlertSoundMaxBytes) throw new Error('Choose a nonempty audio file up to 2 MB.')
      sound.current ??= createPriceAlertSound()
      const engine = sound.current
      const enabled = await engine.unlock()
      const bytes = await file.arrayBuffer()
      const buffer = await engine.decodeCustom(bytes.slice(0))
      if (!mounted.current || sound.current !== engine || request !== customRequest.current) return
      const source = { name: file.name, data: encodeCustomAlertSound(bytes) }
      if (!saveCustomAlertSound(source)) throw new Error('Cannot save this audio file in browser storage. Try a smaller file.')
      engine.stop(); engine.setCustomBuffer(buffer); loadedCustomData.current = source.data
      setCustomSoundName(source.name); setSoundBlocked(!enabled)
      commit({ ...current.current, soundId: 'custom' })
    } catch (error) {
      if (mounted.current && request === customRequest.current) setCustomSoundError((error as Error).message)
    } finally {
      if (mounted.current && request === customRequest.current) setCustomSoundLoading(false)
    }
  }, [commit])
  const playAlertSound = useCallback(() => {
    const played = sound.current?.play(current.current.duration, current.current.soundId) ?? false
    setSoundBlocked(!played)
  }, [])
  const checkAlerts = useCallback(() => {
    const { brokerId, quotes, live } = feed.current
    if (!live || !brokerId) return
    const evaluated = evaluatePriceAlerts(current.current.alerts, brokerId, quotes, Date.now(), draggingAlertId.current)
    if (evaluated.alerts === current.current.alerts) return
    const next = { ...current.current, alerts: evaluated.alerts }
    // Persist the one-shot transition before requesting sound, even if playback fails.
    commit(next)
    if (evaluated.triggered.length && next.playSound) playAlertSound()
  }, [commit, playAlertSound])
  useEffect(checkAlerts, [brokerId, quotes, live, store, checkAlerts])
  const changeDraggingAlert = useCallback((id: string | null) => {
    draggingAlertId.current = id
    if (id && current.current.playSound) void enableSound()
    if (id === null) checkAlerts()
  }, [enableSound, checkAlerts])
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
  const updateAlert = useCallback((id: string, action: 'pause' | 'arm' | 'delete' | 'price' | 'move', price?: number) => {
    const { brokerId, quotes, live } = feed.current
    if ((action === 'price' || action === 'move') && (price === undefined || !Number.isFinite(price) || price <= 0)) return
    const alerts = current.current.alerts.flatMap(alert => {
      if (alert.id !== id) return [alert]
      if (action === 'move' && (alert.brokerId !== brokerId || alert.status === 'triggered')) return [alert]
      if (action === 'delete') return []
      if (action === 'pause') return [{ ...alert, status: 'paused' as const }]
      const target = action === 'price' || action === 'move' ? Number(price!.toFixed(alert.precision)) : alert.price
      if (target <= 0) return [alert]
      const bid = live && alert.brokerId === brokerId ? quotes.find(quote => quote.symbol === alert.symbol)?.bid : undefined
      return [{ ...alert, price: target, direction: alertDirection(target, bid), status: action === 'move' ? alert.status : 'armed' as const,
        triggeredAt: null, triggeredBid: null }]
    })
    commit({ ...current.current, alerts })
  }, [commit])
  const moveAlert = useCallback((id: string, price: number) => updateAlert(id, 'move', price), [updateAlert])
  const deleteAlert = useCallback((id: string) => updateAlert(id, 'delete'), [updateAlert])
  const renameAlert = useCallback((id: string, name: string) => {
    commit({ ...current.current, alerts: current.current.alerts.map(alert => alert.id === id ? { ...alert, name: name.trim().slice(0, 120) } : alert) })
  }, [commit])
  const setSound = useCallback((playSound: boolean, duration: number, soundId?: PriceAlertSoundId) => {
    playbackRequest.current++
    if (soundId && soundId !== current.current.soundId) {
      invalidateCustom(); setCustomSoundLoading(false); setCustomSoundError('')
    }
    sound.current?.stop()
    commit({ ...current.current, playSound, duration, soundId: soundId ?? current.current.soundId })
    if (playSound) void enableSound()
    else sound.current?.stop()
  }, [commit, enableSound, invalidateCustom])
  const brokerAlerts = useMemo(() => store.alerts.filter(alert => alert.brokerId === brokerId), [store.alerts, brokerId])
  const liveSymbols = useMemo(() => new Set(quotes.filter(quote => Number.isFinite(quote.bid) && quote.bid > 0).map(quote => quote.symbol)), [quotes])
  return { alerts: store.alerts, brokerAlerts, addAlert, updateAlert, playSound: store.playSound, duration: store.duration, soundId: store.soundId,
    setSound, enableSound, previewSound, soundBlocked, storageError, live, liveSymbols, renameAlert, moveAlert, deleteAlert, setDraggingAlertId: changeDraggingAlert,
    customSoundName, customSoundError, customSoundLoading, uploadCustomSound }
}

export type PriceAlertsController = ReturnType<typeof usePriceAlerts>
