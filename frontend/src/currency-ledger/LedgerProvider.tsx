import type { ReactNode } from 'react'
import { LedgerContext, useLedgerState } from './useLedger'

const defaultCurrencies=['USD','CAD'] as const
export function LedgerProvider({ broker, enabled, pickerScope = null, currencies=defaultCurrencies, children }: { broker: string | null; enabled: boolean; pickerScope?: string | null; currencies?: readonly string[]; children: ReactNode }) {
  const state = useLedgerState(broker, enabled, pickerScope,currencies)
  return <LedgerContext.Provider value={state}>{children}</LedgerContext.Provider>
}
