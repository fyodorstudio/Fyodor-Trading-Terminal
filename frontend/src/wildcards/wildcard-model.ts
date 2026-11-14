import type { OhlcBar } from '../market-data/contracts/OhlcBar'
import { utcToChartClock, type ChartClockScope } from '../appearance/time-display/chart-clock'

export type WildcardDraft = { date: string; at: string | null; title: string; details: string; url: string; archived: boolean }
export type WildcardEntry = WildcardDraft & { id: string }
export type WildcardSnapshot = { schema: 1; revision: number; items: WildcardEntry[] }
export const wildcardDay = (utc: number) => new Date(utc + 7 * 3600_000).toISOString().slice(0, 10)
export const wildcardTime = (entry: WildcardDraft) => entry.at ? Date.parse(entry.at) : Date.parse(`${entry.date}T23:59:59.999+07:00`)
export const wildcardLocalTime = (utc: number) => new Date(utc + 7 * 3600_000).toISOString().slice(11, 19)
export function wildcardChartTime(entry: WildcardDraft, scope: ChartClockScope) {
  const at = entry.at ? utcToChartClock(Date.parse(entry.at), scope) : Date.parse(`${entry.date}T00:00:00Z`)
  return at === null ? null : at / 1000
}
export function wildcardHeatmapDay(entry: WildcardDraft, scope: ChartClockScope) {
  const time = wildcardChartTime(entry, scope)
  return time === null ? null : new Date(time * 1000).toISOString().slice(0, 10)
}
export function wildcardsAt(items: readonly WildcardEntry[], at: number, pinned: boolean) {
  const from = pinned ? at - 7 * 86400_000 : Date.parse(`${wildcardDay(at)}T00:00:00+07:00`)
  return items.filter(entry => !entry.archived && wildcardTime(entry) >= from && wildcardTime(entry) <= at)
    .sort((a, b) => wildcardTime(b) - wildcardTime(a))
}
export function validWildcards(value: unknown): value is WildcardSnapshot {
  if (!value || typeof value !== 'object') return false
  const body = value as WildcardSnapshot, ids = new Set<string>()
  return body.schema === 1 && Number.isSafeInteger(body.revision) && body.revision >= 0 && Array.isArray(body.items)
    && body.items.every(item => item && typeof item.id === 'string' && !!item.id && !ids.has(item.id) && !!ids.add(item.id)
      && typeof item.title === 'string' && !!item.title.trim() && typeof item.details === 'string' && typeof item.url === 'string'
      && typeof item.archived === 'boolean' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && Number.isFinite(Date.parse(item.date))
      && (item.at === null || typeof item.at === 'string' && Number.isFinite(Date.parse(item.at)) && wildcardDay(Date.parse(item.at)) === item.date))
}

export function containingWildcardCandle(time: number, bars: readonly OhlcBar[], step: number) {
  let lo = 0, hi = bars.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (Number(bars[mid].time) <= time) lo = mid + 1; else hi = mid }
  const candle = bars[lo - 1]
  return candle && time < Number(candle.time) + step ? Number(candle.time) : null
}
