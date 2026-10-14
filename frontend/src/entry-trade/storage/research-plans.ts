import { forexPair } from '../../economic-calendar/forex/pairs'
import type { RegisteredTradeArrow } from '../contracts/entry-trade-types'

export const researchImportKey = 'fyodor.entry-trade.research-imported.v1'
export const researchPlansUrl = '/entry-trade-research.json'
const levels = ['entryPrice', 'tpPrice', 'slPrice', 'tpPips', 'slPips', 'rrRatio'] as const
export function validArrow(value: unknown): value is RegisteredTradeArrow {
  if (!value || typeof value !== 'object') return false
  const arrow = value as RegisteredTradeArrow
  return typeof arrow.id === 'string' && typeof arrow.symbol === 'string' && typeof arrow.note === 'string'
    && (arrow.direction === 'long' || arrow.direction === 'short' || arrow.direction === 'waiting')
    && [arrow.time, arrow.createdAt].every(value => typeof value === 'number' && Number.isFinite(value))
    && levels.every(key => arrow[key] === null ? true : typeof arrow[key] === 'number' && Number.isFinite(arrow[key]))
    && (arrow.archived === undefined || typeof arrow.archived === 'boolean')
    && (arrow.targetRr === undefined || arrow.targetRr === null || (typeof arrow.targetRr === 'number' && Number.isFinite(arrow.targetRr) && arrow.targetRr > 0))
    && (arrow.eventTitle === undefined || (typeof arrow.eventTitle === 'string' && arrow.eventTitle.length <= 512))
    && (arrow.eventAt === undefined || arrow.eventAt === null || (typeof arrow.eventAt === 'string' && Number.isFinite(Date.parse(arrow.eventAt))))
}

// The research import deliberately cannot supply execution prices or a trade direction.
export function parseResearchPlans(value: unknown): RegisteredTradeArrow[] {
  const data = value as { version?: unknown; plans?: unknown }
  if (!data || data.version !== 1 || !Array.isArray(data.plans) || data.plans.length > 250) throw new Error('Invalid Entry Trade research file.')
  const ids = new Set<string>()
  return data.plans.map(raw => {
    const item = raw as { id?: unknown; symbol?: unknown; asOf?: unknown; eventAt?: unknown; note?: unknown }
    if (!item || typeof item.id !== 'string' || !/^research_[a-z0-9_-]{1,120}$/.test(item.id) || ids.has(item.id)
      || typeof item.symbol !== 'string' || forexPair(item.symbol) !== item.symbol
      || typeof item.asOf !== 'string' || !/Z$/.test(item.asOf) || !Number.isFinite(Date.parse(item.asOf))
      || typeof item.eventAt !== 'string' || !/Z$/.test(item.eventAt) || !Number.isFinite(Date.parse(item.eventAt))
      || typeof item.note !== 'string' || !item.note.trim() || item.note.length > 32000) throw new Error('Invalid Entry Trade research plan.')
    ids.add(item.id)
    return { id: item.id, symbol: item.symbol, eventAt: item.eventAt, time: 0, direction: 'waiting',
      precision: item.symbol.includes('JPY') ? 3 : 5, entryPrice: null, tpPrice: null, slPrice: null,
      tpPips: null, slPips: null, rrRatio: null, note: item.note, createdAt: Date.parse(item.asOf) }
  })
}

export function mergeResearchPlans(existing: RegisteredTradeArrow[], incoming: RegisteredTradeArrow[], imported: string[]) {
  const known = new Set([...existing.map(item => item.id), ...imported])
  const additions = incoming.filter(item => !known.has(item.id))
  return { arrows: additions.length ? [...additions, ...existing] : existing,
    imported: [...new Set([...imported, ...incoming.map(item => item.id)])] }
}
