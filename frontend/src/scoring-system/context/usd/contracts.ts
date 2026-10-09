import type { InspectorEvent } from '../../../inspector/inspector-data'
import type { MagnitudeSettings } from '../../../inspector/magnitude/settings/magnitude-settings-store'

export type ContextFamily = 'nfp' | 'cpi' | 'claims' | 'ism' | 'retail' | 'pce' | 'ppi' | 'gdp'
export type UsdDirection = 'stronger' | 'weaker' | 'uncomputed'
export type Evidence = 'weak' | 'moderate' | 'strong'
export type CpiContextTraits = { kind: 'cpi'; monthlyCore: number | null; threeMonthCore: number | null;
  annualCore: number | null; monthlyPressure: number | null; annualPressure: number | null }
export type NfpContextTraits = { kind: 'nfp'; hiringChange: number | null; unemploymentSignal: number | null }
export type ClaimsContextTraits = { kind: 'claims'; streak: number; confirmed: boolean; trendAgreement?: boolean }
export type ContextPolicyCheck = { label: string; state: 'pass' | 'fail' | 'unavailable'; detail: string }
export type ContextPolicy = { mode: 'balanced' | 'labor-priority' | 'weekly-labor-priority'; label: string; reason: string;
  weights: Record<ContextFamily, number>; checks: ContextPolicyCheck[] }
export type ContextSettings = { nfp: MagnitudeSettings; cpi: MagnitudeSettings;
  services: MagnitudeSettings; manufacturing: MagnitudeSettings; retail?: MagnitudeSettings; claims?: MagnitudeSettings; pce?: MagnitudeSettings; ppi?: MagnitudeSettings; gdp?: MagnitudeSettings }
export type ContextInput = { events: readonly InspectorEvent[]; families: readonly string[]; settings: ContextSettings; asOf: number }
export type SupportComponent = { id: string; value: number | null; points: number | null; weight: number;
  limits: readonly [number, number, number] | null }
export type FamilyAssessment = { family: ContextFamily; sourceId: string; sourceLabel: string; releaseAt: number;
  chartAt: number; total: number | null; usdDirection: UsdDirection; strength: Evidence | null;
  reason: string; explanation: string; changeSize: string | null; reduced: boolean; tie: boolean;
  coverage?: number;
  comparisonBasis?: string;
  calibrationBasis?: string;
  components?: readonly SupportComponent[];
  traits?: CpiContextTraits | NfpContextTraits | ClaimsContextTraits }
export type ContextMemory = { ageDays: number; halfLifeDays: number; retention: number; coverage: number; effectiveWeight: number }
export type ContextMember = FamilyAssessment & { status: 'active' | 'expired' | 'unavailable'; contribution: number; memory?: ContextMemory }
export type ContextResult = { direction: UsdDirection; total: number | null; strength: Evidence | null;
  explanation: string; reason: string; members: ContextMember[]; missing: ContextFamily[]; tie: boolean; policy?: ContextPolicy;
  decision?: import('./interpretation-quality').ContextDecision }
export type ContextPoint = { chartAt: number; result: ContextResult; latest: FamilyAssessment | null; update: string }
export type ContextTimeline = { points: ContextPoint[]; enabled: ContextFamily[]; version: string; excludedTiming: number;
  relationships?: import('../../relationships/contracts').ContextRelationships }
