import type { EconomicCalendarEvent } from '../../inspector/calendar-event'
import type { MagnitudeSettings } from '../../inspector/magnitude/settings/magnitude-settings-store'
import type { EurFamily } from '../../inspector/scoring/PAIR/EURUSD/EUR/policy/eur-policies'
export type EurContextInput = { events: readonly EconomicCalendarEvent[]; families: readonly EurFamily[]; settings: Partial<Record<EurFamily, MagnitudeSettings>>; asOf: number }
export type EurSlot = 'inflation' | 'unemployment' | 'employment' | 'wages' | 'pmi' | 'gdp'
export type EurSource = { slot: EurSlot; family: EurFamily; label: string; chartAt: number; releaseAt: number;
  reference: number | null; score: number | null; coverage: number; provisional: boolean }
export type EurMember = EurSource & { weight: number; retention: number; contribution: number; status: 'active' | 'expired' | 'unavailable' }
export type EurContextPoint = { chartAt: number; total: number | null; members: EurMember[]; coverage: number;
  usableCoverage?: number; update: string; updateKind?: 'publication' | 'memory' }
export type EurContextTimeline = { points: EurContextPoint[]; excludedTiming: number }
