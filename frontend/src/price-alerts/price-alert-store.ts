import type { SymbolQuote } from '../market-data/contracts/SymbolQuote'
import { priceAlertSounds, type PriceAlertSoundId } from './price-alert-tones'
import { maxTrendQuoteGapMs, reachesTrendAlert, trendAlertPoints, trendAlertSample, type TrendAlert, type TrendSample } from './trend-alert'
import { trendScaleCovers, validTrendAlertScale, type TrendAlertScale } from './trend-alert-scale'

export type PriceAlert = {
  id: string
  brokerId: string
  symbol: string
  name?: string
  price: number
  precision: number
  trend?: TrendAlert
  trendScale?: TrendAlertScale
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
    && (item.trendScale === undefined || (!!item.trend && validTrendAlertScale(item.trendScale)))
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
  trendSamples = new Map<string, TrendSample>(), waitingSamples = new Map<string, TrendSample[]>()) {
  const bySymbol = new Map(quotes.map(quote => [quote.symbol, quote]))
  const tracking = new Set<string>()
  let changed = false
  const triggered: PriceAlert[] = []
  const next = alerts.map(alert => {
    if (alert.brokerId !== brokerId || alert.status !== 'armed' || alert.id === draggingId) return alert
    const quote = bySymbol.get(alert.symbol), bid = priceAlertQuote(quote, now)
    if (bid === undefined) return alert
    const trend = alert.trend
    const direction = trend ? null : alert.direction ?? alertDirection(alert.price, bid)
    let reached: boolean, triggeredBid = bid
    if (trend) {
      const sample = trendAlertSample(quote, bid, now)
      if (!sample) return alert
      tracking.add(alert.id)
      let previous = trendSamples.get(alert.id)
      const buffered = waitingSamples.get(alert.id)?.filter(item => item.at >= now - maxTrendQuoteGapMs) ?? []
      const last = buffered.at(-1) ?? previous
      if (!last || sample.at > last.at || (sample.at === last.at && sample.bid !== last.bid)) buffered.push(sample)
      const scale = alert.trendScale
      const wait = scale ? buffered.findIndex(item => !trendScaleCovers(scale, Math.min(item.chartTime, trend[1].time))) : -1
      const ready = wait === -1 ? buffered : buffered.splice(0, wait)
      if (wait === -1) waitingSamples.delete(alert.id)
      else waitingSamples.set(alert.id, buffered)
      reached = false
      for (const item of ready) {
        reached = reachesTrendAlert(trend, previous, item, alert.trendArmedAt ?? alert.createdAt, alert.precision, scale)
        trendSamples.set(alert.id, item)
        if (reached) { triggeredBid = item.bid; break }
        previous = item
      }
    } else reached = direction === 'above' ? bid >= alert.price : bid <= alert.price
    if (reached) {
      changed = true
      tracking.delete(alert.id)
      const fired: PriceAlert = { ...alert, direction, status: 'triggered', triggeredAt: now, triggeredBid }
      triggered.push(fired)
      return fired
    }
    if (direction !== alert.direction) { changed = true; return { ...alert, direction } }
    return alert
  })
  for (const id of trendSamples.keys()) if (!tracking.has(id)) trendSamples.delete(id)
  for (const id of waitingSamples.keys()) if (!tracking.has(id)) waitingSamples.delete(id)
  return { alerts: changed ? next : alerts, triggered }
}
