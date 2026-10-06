import type { InspectorEvent } from '../../inspector/inspector-data'
import type { MagnitudeSettings } from '../../inspector/magnitude/settings/magnitude-settings-store'

export type ContextFamily = 'nfp' | 'cpi' | 'ism'
export type UsdDirection = 'stronger' | 'weaker' | 'uncomputed'
export type Evidence = 'weak' | 'moderate' | 'strong'
export type ContextSettings = { nfp: MagnitudeSettings; cpi: MagnitudeSettings;
  services: MagnitudeSettings; manufacturing: MagnitudeSettings }
export type ContextInput = { events: readonly InspectorEvent[]; families: readonly string[]; settings: ContextSettings; asOf: number }
export type FamilyAssessment = { family: ContextFamily; sourceId: string; sourceLabel: string; releaseAt: number;
  chartAt: number; total: number | null; usdDirection: UsdDirection; strength: Evidence | null;
  reason: string; explanation: string; changeSize: string | null; reduced: boolean; tie: boolean }
export type ContextMember = FamilyAssessment & { status: 'active' | 'expired' | 'unavailable'; contribution: number }
export type ContextResult = { direction: UsdDirection; total: number | null; strength: Evidence | null;
  explanation: string; reason: string; members: ContextMember[]; missing: ContextFamily[]; tie: boolean }
export type ContextPoint = { chartAt: number; result: ContextResult; latest: FamilyAssessment | null; update: string }
export type ContextTimeline = { points: ContextPoint[]; enabled: ContextFamily[]; version: string; excludedTiming: number }
