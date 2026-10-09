import type { EconomicCalendarEvent } from '../../inspector/calendar-event'
import { prepareScoringSignalHistory, scoringSignalBinding } from '../inspection/scoring-signal-model'
import type { ClaimsHorizon } from '../../scoring-system/PAIR/EURUSD/USD/CLAIMS/policy/claims-standalone-policy'

export type SignalHistoryInput = { familyId: string; events: readonly EconomicCalendarEvent[]; at: number; enabled: boolean; horizon?: ClaimsHorizon }
export function calculateSignalHistory({ familyId, events, at, enabled, horizon }: SignalHistoryInput) {
  const binding = scoringSignalBinding(familyId, horizon)
  return enabled && binding ? prepareScoringSignalHistory(events, at, binding) : []
}
