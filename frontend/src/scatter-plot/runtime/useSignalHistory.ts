import { useMemo } from 'react'
import type { EconomicCalendarEvent } from '../../inspector/calendar-event'
import { useBackgroundCalculation } from '../../inspector/scoring/shared/runtime/useBackgroundCalculation'
import { calculateSignalHistory } from './signal-history-calculation'

const createWorker = () => new Worker(new URL('./signal-history.worker.ts', import.meta.url), { type: 'module' })
export function useSignalHistory(familyId: string, events: readonly EconomicCalendarEvent[], at: number, enabled: boolean) {
  const input = useMemo(() => enabled ? { familyId, events, at, enabled } : null, [familyId, events, at, enabled])
  return useBackgroundCalculation(input, calculateSignalHistory, createWorker)
}
