import type { ContextFamily, ContextPolicyCheck, ContextResult, UsdDirection, Evidence } from '../../core/contracts'

export type ComboKind = 'labor-inflation' | 'weekly-labor' | 'ism-sectors' | 'fresh-news'
export type ComboSource = { sourceId: string; sourceLabel: string; family: ContextFamily; chartAt: number;
  releaseAt: number; total: number | null; usdDirection: UsdDirection; strength: Evidence | null;
  contribution?: number; change?: number; role?: string }
export type FreshChange = ComboSource & { change: number }
export type FreshPoint = { chartAt: number; total: number | null; direction: UsdDirection;
  members: FreshChange[]; agreeingDomains: number; explanation: string }
export type ComboSnapshot = { id: string; kind: ComboKind; title: string; chartAt: number;
  sources: ComboSource[]; before: ContextResult | null; after: ContextResult;
  direction: UsdDirection; strength: Evidence | null; explanation: string;
  checks: ContextPolicyCheck[]; experimental: boolean }
export type ContextRelationships = { episodes: ComboSnapshot[]; fresh: FreshPoint[] }
export type IsmSourceMap = Map<string, ComboSource[]>
