import type { SymbolQuote } from '../market-data/contracts/SymbolQuote'
import { priceAlertSounds, type PriceAlertSoundId } from './price-alert-tones'

export type PriceAlert = {
  id: string
  brokerId: string
  symbol: string
  price: number
  precision: number
  direction: 'above' | 'below' | null
  status: 'armed' | 'paused' | 'triggered'
  createdAt: number
  triggeredAt: number | null
  triggeredBid: number | null
}

export type PriceAlertStore = { alerts: PriceAlert[]; playSound: boolean; duration: number; soundId: PriceAlertSoundId }
export const priceAlertStorageKey = 'fyodor.price-alerts.v1'

function validAlert(value: unknown): value is PriceAlert {
  if (!value || typeof value !== 'object') return false
  const item = value as PriceAlert
  return typeof item.id === 'string' && typeof item.brokerId === 'string' && !!item.brokerId
    && typeof item.symbol === 'string' && !!item.symbol && Number.isFinite(item.price) && item.price > 0
    && Number.isInteger(item.precision) && item.precision >= 0 && item.precision <= 10
    && ['armed', 'paused', 'triggered'].includes(item.status)
    && (item.direction === null || item.direction === 'above' || item.direction === 'below')
    && Number.isFinite(item.createdAt) && (item.triggeredAt === null || Number.isFinite(item.triggeredAt))
    && (item.triggeredBid === null || Number.isFinite(item.triggeredBid))
}

export function readPriceAlerts(): PriceAlertStore {
  const empty: PriceAlertStore = { alerts: [], playSound: true, duration: 3, soundId: 'thin' }
  try {
    const value = JSON.parse(window.localStorage.getItem(priceAlertStorageKey) ?? 'null')
    if (!value || !Array.isArray(value.alerts)) return empty
    return { alerts: value.alerts.filter(validAlert), playSound: value.playSound !== false,
      duration: [1, 3, 5, 10].includes(value.duration) ? value.duration : 3,
      soundId: priceAlertSounds.find(sound => sound.id === value.soundId)?.id ?? 'thin' }
  } catch { return empty }
}

export function savePriceAlerts(value: PriceAlertStore) {
  try { window.localStorage.setItem(priceAlertStorageKey, JSON.stringify(value)); return true }
  catch { return false }
}

export function alertDirection(price: number, bid?: number): PriceAlert['direction'] {
  return bid === undefined || !Number.isFinite(bid) || bid <= 0 ? null : price >= bid ? 'above' : 'below'
}

// Quotes are sampled, so a jump across the line counts as reaching it too.
// Never use candle highs/lows: those may precede the alert's creation.
export function evaluatePriceAlerts(alerts: PriceAlert[], brokerId: string, quotes: SymbolQuote[], now: number) {
  const bySymbol = new Map(quotes.map(quote => [quote.symbol, quote]))
  let changed = false
  const triggered: PriceAlert[] = []
  const next = alerts.map(alert => {
    if (alert.brokerId !== brokerId || alert.status !== 'armed') return alert
    const bid = bySymbol.get(alert.symbol)?.bid
    if (bid === undefined || !Number.isFinite(bid) || bid <= 0) return alert
    const direction = alert.direction ?? alertDirection(alert.price, bid)
    const reached = direction === 'above' ? bid >= alert.price : bid <= alert.price
    if (reached) {
      changed = true
      const fired: PriceAlert = { ...alert, direction, status: 'triggered', triggeredAt: now, triggeredBid: bid }
      triggered.push(fired)
      return fired
    }
    if (direction !== alert.direction) { changed = true; return { ...alert, direction } }
    return alert
  })
  return { alerts: changed ? next : alerts, triggered }
}
