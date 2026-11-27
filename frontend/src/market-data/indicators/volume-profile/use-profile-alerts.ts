import { useCallback, useEffect, useRef, useState } from 'react'
import { createPriceAlertSound } from '../../../price-alerts/price-alert-sound'
import { profileAlertStorageKey, readProfileAlerts, type ProfileAlert, type ProfileAlertEvent } from './volume-profile-alerts'

export function useProfileAlerts(broker: string | null, onNotice: (message: string) => void) {
  const [alerts, setAlerts] = useState(readProfileAlerts)
  const [notice, setNotice] = useState<string | null>(null)
  const current = useRef(alerts)
  const sound = useRef<ReturnType<typeof createPriceAlertSound> | null>(null)
  const enableSound = useCallback(() => {
    sound.current ??= createPriceAlertSound()
    void sound.current.unlock()
  }, [])

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== profileAlertStorageKey && event.key !== null) return
      current.current = readProfileAlerts()
      setAlerts(current.current)
    }
    window.addEventListener('storage', sync)
    if (current.current.some(alert => alert.armed)) window.addEventListener('pointerdown', enableSound, { once: true })
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('pointerdown', enableSound)
      sound.current?.dispose()
      sound.current = null
    }
  }, [enableSound])

  const commit = useCallback((next: ProfileAlert[]) => {
    current.current = next
    setAlerts(next)
    try { window.localStorage.setItem(profileAlertStorageKey, JSON.stringify(next)) }
    catch { setNotice('VP alerts could not be saved on this device.') }
  }, [])

  const onEvents = useCallback((events: { alert: ProfileAlert; event: ProfileAlertEvent; precision: number }[]) => {
    let next = current.current
    const messages: string[] = []
    for (const { alert, event, precision } of events) {
      const existing = next.find(rule => rule.id === alert.id)
      if (!existing?.armed || existing.broker !== broker) continue
      const mid = ((event.low + event.high) / 2).toFixed(precision)
      const message = `${alert.symbol} · ${event.type === 'touch' ? 'Price reached' : 'New'} ${alert.node} at ${mid}`
      const sent = existing.repeat ? [] : [...existing.sent, event].slice(-200)
      next = next.map(rule => rule.id === alert.id ? { ...rule, sent, last: { message, time: Date.now() } } : rule)
      messages.push(message)
    }
    if (!messages.length) return
    commit(next)
    for (const message of messages) onNotice(message)
    setNotice(messages.join(' · '))
    sound.current?.play(1)
  }, [broker, commit, onNotice])

  return {
    alerts: alerts.filter(alert => alert.broker === broker),
    notice, dismissNotice: () => setNotice(null), onEvents,
    add(rule: Omit<ProfileAlert, 'id' | 'broker' | 'armed' | 'sent'>) {
      if (!broker) return
      enableSound()
      commit([...current.current, { ...rule, id: crypto.randomUUID(), broker, armed: true, sent: [] }])
    },
    toggle(id: string) {
      enableSound()
      commit(current.current.map(alert => alert.id === id ? { ...alert, armed: !alert.armed, sent: [] } : alert))
    },
    remove(id: string) { commit(current.current.filter(alert => alert.id !== id)) },
  }
}
