import type { CaptureScope } from '../workflow/NotebookContextCapture'
import type { SymbolQuote } from '../../market-data/contracts/SymbolQuote'
import { type PlannedTradeState, type RegisteredTradeArrow } from '../contracts/trader-notebook-types'

export type TraderNotebookPanelProps = {
  contextScope?: CaptureScope
  selectedSymbol: string
  quote: SymbolQuote | null
  latestBarTime: number
  plan: PlannedTradeState
  registeredArrows: RegisteredTradeArrow[]
  selectedArrowId: string | null
  onPlanChange: (plan: PlannedTradeState) => void
  onSelectArrowId: (id: string | null) => void
  onRegisterArrow: (arrow: Omit<RegisteredTradeArrow, 'id' | 'createdAt'>) => void
  onDeleteArrow: (id: string) => void
}
