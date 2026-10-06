import type { EconomicCalendarEvent } from '../../inspector/calendar-event'
import { prepareScoringSignalHistory, scoringSignalBinding } from '../inspection/scoring-signal-model'

export type SignalHistoryInput = { familyId: string; events: readonly EconomicCalendarEvent[]; at: number; enabled: boolean }
export function calculateSignalHistory({ familyId, events, at, enabled }: SignalHistoryInput) {
  const binding = scoringSignalBinding(familyId)
  return enabled && binding ? prepareScoringSignalHistory(events, at, binding) : []
}
