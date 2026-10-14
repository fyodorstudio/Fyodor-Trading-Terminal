import { type ChartClockScope } from '../../appearance/time-display/chart-clock'
import type { RegisteredTradeArrow } from '../contracts/entry-trade-types'
export type ArrowSort = { column: 'symbol' | 'date' | 'direction' | 'entryPrice' | 'slPrice' | 'tpPrice' | 'rrRatio'; descending: boolean }
export const tablePreferenceKey = 'fyodor.entry-trade.table.v1'
export const defaultSort: ArrowSort = { column: 'date', descending: false }
export function journalDate(arrow: RegisteredTradeArrow, _scope?: ChartClockScope) {
  return arrow.eventAt ? Date.parse(arrow.eventAt) : null
}
export function sortArrows(arrows: RegisteredTradeArrow[], sort: ArrowSort, scope: ChartClockScope) {
  const value = (arrow: RegisteredTradeArrow) => sort.column === 'date' ? journalDate(arrow, scope) : arrow[sort.column]
  return [...arrows].sort((a, b) => {
    const av = value(a), bv = value(b)
    if (av == null || bv == null) return av == null && bv == null ? a.id.localeCompare(b.id) : av == null ? 1 : -1
    const difference = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
    return difference ? difference * (sort.descending ? -1 : 1) : a.id.localeCompare(b.id)
  })
}
export function readTablePreference(): { sort: ArrowSort; archived: boolean } {
  try {
    const value = JSON.parse(localStorage.getItem(tablePreferenceKey) ?? '{}')
    const columns = ['symbol', 'date', 'direction', 'entryPrice', 'slPrice', 'tpPrice', 'rrRatio']
    return { sort: columns.includes(value.sort?.column) && typeof value.sort?.descending === 'boolean' ? value.sort : defaultSort, archived: value.archived === true }
  } catch { return { sort: defaultSort, archived: false } }
}
