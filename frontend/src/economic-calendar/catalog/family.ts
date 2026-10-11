import type { MajorCurrency } from '../forex/currencies'
import type { EventSymbol } from '../presentation/event-symbols'

export type CalendarCategory = 'policy' | 'inflation' | 'labor' | 'growth'
export type CalendarFamily = {
  id: string; label: string; country: string; currency: MajorCurrency
  category: CalendarCategory; symbol: EventSymbol; events: readonly string[]; inspector?: boolean
}
