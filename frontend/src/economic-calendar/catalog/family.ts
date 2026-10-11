import type { MajorCurrency } from '../forex/currencies'
import type { EventSymbol } from '../presentation/event-symbols'

export type CalendarCategory = 'policy' | 'inflation' | 'labor' | 'growth' | 'housing' | 'trade' | 'government' | 'markets' | 'holidays' | 'other'
export type CalendarFamily = {
  id: string; label: string; country: string; currency: MajorCurrency
  category: CalendarCategory; symbol: EventSymbol; events: readonly string[]; inspector?: boolean
  sourceLabels?: boolean; catchAll?: boolean
  search?: string
}
