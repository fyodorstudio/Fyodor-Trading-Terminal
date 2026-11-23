import type { SymbolQuote } from '../market-data/contracts/SymbolQuote'
import { priceAlertSounds, type PriceAlertSoundId } from './price-alert-tones'
import { reachesTrendAlert, trendAlertPoints, trendAlertSample, type TrendAlert, type TrendSample } from './trend-alert'

export type PriceAlert = {
  id: string
  brokerId: string
  symbol: string
  name?: string
  price: number
  precision: number
  trend?: TrendAlert
  trendArmedAt?: number
  label?: 'supply' | 'demand'
  direction: 'above' | 'below' | null
  status: 'armed' | 'paused' | 'triggered'
  createdAt: number
  triggeredAt: number | null
  triggeredBid: number | null
  soundStatus?: 'pending' | 'played' | 'missed' | 'muted'
  soundDeliveryId?: string
}

export type PriceAlertStore = { alerts: PriceAlert[]; playSound: boolean; duration: number; soundId: PriceAlertSoundId; volume: number }
export const priceAlertStorageKey = 'fyodor.price-alerts.v1'

function validAlert(value: unknown): value is PriceAlert {
  if (!value || typeof value !== 'object') return false
  const item = value as PriceAlert
  return typeof item.id === 'string' && typeof item.brokerId === 'string' && !!item.brokerId
    && typeof item.symbol === 'string' && !!item.symbol && Number.isFinite(item.price) && item.price > 0
    && (item.name === undefined || typeof item.name === 'string')
    && Number.isInteger(item.precision) && item.precision >= 0 && item.precision <= 10
    && (item.trend === undefined || (Array.isArray(item.trend) && !!trendAlertPoints(item.trend)))
    && (item.trendArmedAt === undefined || Number.isFinite(item.trendArmedAt))
    && (item.label === undefined || item.label === 'supply' || item.label === 'demand')
    && ['armed', 'paused', 'triggered'].includes(item.status)
    && (item.direction === null || item.direction === 'above' || item.direction === 'below')
    && Number.isFinite(item.createdAt) && (item.triggeredAt === null || Number.isFinite(item.triggeredAt))
    && (item.triggeredBid === null || Number.isFinite(item.triggeredBid))
    && (item.soundStatus === undefined || ['pending', 'played', 'missed', 'muted'].includes(item.soundStatus))
    && (item.soundDeliveryId === undefined || typeof item.soundDeliveryId === 'string')
}

export function readPriceAlerts(): PriceAlertStore {
  const empty: PriceAlertStore = { alerts: [], playSound: true, duration: 3, soundId: 'thin', volume: 30 }
  try {
    const value = JSON.parse(window.localStorage.getItem(priceAlertStorageKey) ?? 'null')
    if (!value || !Array.isArray(value.alerts)) return empty
    const alerts: PriceAlert[] = value.alerts.filter(validAlert)
    return { volume: Number.isFinite(value.volume) ? Math.max(0, Math.min(100, value.volume)) : 30, alerts: alerts.map(alert => alert.trend
      ? { ...alert, trend: trendAlertPoints(alert.trend) } : alert), playSound: value.playSound !== false,
      duration: [1, 3, 5, 10].includes(value.duration) ? value.duration : 3,
      soundId: value.soundId === 'custom' ? 'custom' : priceAlertSounds.find(sound => sound.id === value.soundId)?.id ?? 'thin' }
  } catch { return empty }
}

export function savePriceAlerts(value: PriceAlertStore) {
  try { window.localStorage.setItem(priceAlertStorageKey, JSON.stringify(value)); return true }
  catch { return false }
}

export function alertDirection(price: number, bid?: number): PriceAlert['direction'] {
  return bid === undefined || !Number.isFinite(bid) || bid <= 0 ? null : price >= bid ? 'above' : 'below'
}

export function priceAlertQuote(quote: SymbolQuote | undefined, now?: number) {
  if (quote?.synthetic && (quote.indexExpiresAt == null || (now ?? Date.now()) > quote.indexExpiresAt)) return undefined
  const level = quote?.synthetic ? quote.indexLevel : quote?.bid
  return level != null && Number.isFinite(level) && level > 0 ? level : undefined
}

// Quotes are sampled, so a jump across the line counts as reaching it too.
// Never use candle highs/lows: those may precede the alert's creation.
export function evaluatePriceAlerts(alerts: PriceAlert[], brokerId: string, quotes: SymbolQuote[], now: number, draggingId: string | null = null,
  trendSamples = new Map<string, TrendSample>()) {
  const bySymbol = new Map(quotes.map(quote => [quote.symbol, quote]))
  const tracking = new Set<string>()
  let changed = false
  const triggered: PriceAlert[] = []
  const next = alerts.map(alert => {
    if (alert.brokerId !== brokerId || alert.status !== 'armed' || alert.id === draggingId) return alert
    const quote = bySymbol.get(alert.symbol), bid = priceAlertQuote(quote, now)
    if (bid === undefined) return alert
    const direction = alert.trend ? null : alert.direction ?? alertDirection(alert.price, bid)
    let reached: boolean
    if (alert.trend) {
      const sample = trendAlertSample(quote, bid, now)
      if (!sample) return alert
      tracking.add(alert.id)
      const previous = trendSamples.get(alert.id)
      if (previous && (sample.at < previous.at
        || (sample.at === previous.at && sample.bid === previous.bid))) return alert
      trendSamples.set(alert.id, sample)
      reached = reachesTrendAlert(alert.trend, previous, sample, alert.trendArmedAt ?? alert.createdAt, alert.precision)
    } else reached = direction === 'above' ? bid >= alert.price : bid <= alert.price
    if (reached) {
      changed = true
      tracking.delete(alert.id)
      const fired: PriceAlert = { ...alert, direction, status: 'triggered', triggeredAt: now, triggeredBid: bid }
      triggered.push(fired)
      return fired
    }
    if (direction !== alert.direction) { changed = true; return { ...alert, direction } }
    return alert
  })
  for (const id of trendSamples.keys()) if (!tracking.has(id)) trendSamples.delete(id)
  return { alerts: changed ? next : alerts, triggered }
}
