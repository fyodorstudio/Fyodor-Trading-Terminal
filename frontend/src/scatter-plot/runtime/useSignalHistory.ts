import { useMemo } from 'react'
import type { EconomicCalendarEvent } from '../../inspector/calendar-event'
import { useBackgroundCalculation } from '../../inspector/scoring/shared/runtime/useBackgroundCalculation'
import { calculateSignalHistory } from './signal-history-calculation'
import type { ClaimsHorizon } from '../../scoring-system/PAIR/EURUSD/USD/CLAIMS/policy/claims-standalone-policy'

const createWorker = () => new Worker(new URL('./signal-history.worker.ts', import.meta.url), { type: 'module' })
export function useSignalHistory(familyId: string, events: readonly EconomicCalendarEvent[], at: number, enabled: boolean, horizon?: ClaimsHorizon) {
  const input = useMemo(() => enabled ? { familyId, events, at, enabled, horizon } : null, [familyId, events, at, enabled, horizon])
  return useBackgroundCalculation(input, calculateSignalHistory, createWorker)
}
