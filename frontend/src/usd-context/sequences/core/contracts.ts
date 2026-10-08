import type { ContextFamily, ContextPolicyCheck, ContextResult, ContextMemory, UsdDirection, Evidence } from '../../core/contracts'

export const relationshipVersion = 4
export type RelationshipFamily = ContextFamily | 'fed'
export type ComboKind = 'labor-inflation' | 'weekly-labor' | 'ism-sectors' | 'fresh-news' | 'release-relationship' | 'fed-relationship'
export type ComboSource = { sourceId: string; sourceLabel: string; family: RelationshipFamily; chartAt: number;
  releaseAt: number; total: number | null; usdDirection: UsdDirection; strength: Evidence | null;
  contribution?: number; change?: number; role?: string;
  replacementChange?: number; scoreChange?: number; calibrationChange?: number; memoryRenewal?: number; availabilityChange?: number; comparable?: boolean;
  coverage?: number; status?: 'active' | 'expired' | 'unavailable';
  memory?: ContextMemory;
  sector?: 'manufacturing' | 'services'; referenceMonth?: number | null;
  assessment?: import('../../core/contracts').FamilyAssessment;
  participants?: ComboSource[]; policyAction?: { action: string; delta: number | null; actual: number | null } }
export type FreshChange = ComboSource & { family: ContextFamily; change: number }
export type FreshPoint = { chartAt: number; total: number | null; direction: UsdDirection;
  members: FreshChange[]; agreeingDomains: number; explanation: string;
  decision?: import('../../core/interpretation-quality').ContextDecision }
export type ComboActivation = { kind: 'publication' | 'aging' | 'expiry'; removed: { sourceId: string; sourceLabel: string; chartAt: number; releaseAt: number; reason: 'fresh-window' | 'assessment-expiry' }[] }
export type ComboSnapshot = { id: string; kind: ComboKind; title: string; chartAt: number;
  sources: ComboSource[]; before: ContextResult | null; after: ContextResult;
  direction: UsdDirection; strength: Evidence | null; explanation: string;
  checks: ContextPolicyCheck[]; experimental: boolean;
  decision?: import('../../core/interpretation-quality').ContextDecision;
  activation?: ComboActivation;
  catalogue?: { enabled: ContextFamily[]; fresh: FreshChange[]; fed: ComboSource | null } }
export type ContextRelationships = { episodes: ComboSnapshot[]; fresh: FreshPoint[] }
export type IsmSourceMap = Map<string, ComboSource[]>
