import type { RegisteredTradeArrow } from '../contracts/entry-trade-types'
import { validArrow } from './registered-arrow-validation'
export const journalUrl = '/entry-trade-api/journal'
export const pendingKey = 'fyodor.entry-trade.pending.v1'
export const migrationKey = 'fyodor.entry-trade.repo-migrated.v1'
export type JournalOperation = { operationId: string; action: 'insert' | 'migrate' | 'update' | 'delete'; id: string;
  arrow?: RegisteredTradeArrow; changes?: Partial<RegisteredTradeArrow> }
export type JournalSnapshot = { version: 1; revision: number; arrows: RegisteredTradeArrow[]; deletedIds: string[] }
export function parseJournal(value: unknown): JournalSnapshot {
  const data = value as JournalSnapshot
  if (!data || data.version !== 1 || !Number.isSafeInteger(data.revision) || !Array.isArray(data.arrows)
    || !data.arrows.every(validArrow) || !Array.isArray(data.deletedIds) || !data.deletedIds.every(id => typeof id === 'string')) throw new Error('Repository journal is unavailable or invalid.')
  return data
}
export function applyJournalOperations(arrows: RegisteredTradeArrow[], operations: JournalOperation[]) {
  let result = arrows
  for (const operation of operations) {
    if (operation.action === 'delete') result = result.filter(item => item.id !== operation.id)
    else if (operation.action === 'update') result = result.map(item => item.id === operation.id ? { ...item, ...operation.changes } : item)
    else if (operation.arrow) result = result.some(item => item.id === operation.id)
      ? result.map(item => item.id === operation.id && operation.action === 'migrate' ? operation.arrow! : item)
      : [operation.arrow, ...result]
  }
  return result
}
export function stableJournalArrows(previous: RegisteredTradeArrow[], next: RegisteredTradeArrow[]) {
  const byId = new Map(previous.map(item => [item.id, item]))
  const result = next.map(item => { const old = byId.get(item.id); return old && JSON.stringify(old) === JSON.stringify(item) ? old : item })
  return result.length === previous.length && result.every((item, index) => item === previous[index]) ? previous : result
}
