import type { RegisteredTradeArrow } from '../contracts/entry-trade-types'

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
