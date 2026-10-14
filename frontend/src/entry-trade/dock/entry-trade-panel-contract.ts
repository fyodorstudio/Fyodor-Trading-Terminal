import type { SymbolQuote } from '../../market-data/contracts/SymbolQuote'
import { type PlannedTradeState, type RegisteredTradeArrow } from '../contracts/entry-trade-types'

export type EntryTradePanelProps = {
  selectedSymbol: string
  quote: SymbolQuote | null
  quotes: SymbolQuote[]
  latestBarTime: number
  plan: PlannedTradeState
  registeredArrows: RegisteredTradeArrow[]
  selectedArrowId: string | null
  onPlanChange: (plan: PlannedTradeState) => void
  onSelectArrowId: (id: string | null) => void
  onRegisterArrow: (arrow: Omit<RegisteredTradeArrow, 'id' | 'createdAt'>) => void
  onDeleteArrow: (id: string) => void
  onUpdateArrow: (id: string, changes: Partial<Pick<RegisteredTradeArrow,
    'note' | 'time' | 'direction' | 'entryPrice' | 'tpPrice' | 'slPrice' | 'tpPips' | 'slPips' | 'rrRatio'>>) => void
}
