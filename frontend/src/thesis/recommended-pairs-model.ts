import { majorForexPairs } from '../economic-calendar/forex/pairs'
import { directionIntensities, safeThesisLink, type ThesisSource } from './thesis-model'

export type RecommendedPair = {
  id: string; pair: string; verdict: 'BUY' | 'SELL'; intensity: 'strong' | 'moderate' | 'slight' | null; rank: number | null;
  reason: string; strongest_opposition: string; invalidation: string; as_of_utc: string; starts_at: string; until_utc: string;
  checkpoint: string; status: 'current' | 'superseded' | 'source_gap' | 'provisional';
  daily_close?: { source_id: 'Pepperstone-Demo'; broker_day: string; color: 'green' | 'red' | 'flat';
    open_price: number; observed_price: number; observed_utc: string; closes_at: string; reason: string };
  evidence: { currency: string; assessment_id: string; reason: string; evidence_ids: string[]; sources: ThesisSource[] }[];
}
export type RecommendedPairsSnapshot = { schema: 1; revision: string; items: RecommendedPair[] }
const stamp = (v: unknown): v is string => typeof v === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v))
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim()
export function validRecommendedPairs(value: unknown): value is RecommendedPairsSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as RecommendedPairsSnapshot
  return v.schema === 1 && text(v.revision) && Array.isArray(v.items) && v.items.length <= 28
    && new Set(v.items.map(i => i?.pair)).size === v.items.length && v.items.every(i => i
      && text(i.id) && majorForexPairs.includes(i.pair) && ['BUY','SELL'].includes(i.verdict)
      && (i.intensity === null || directionIntensities.includes(i.intensity))
      && (i.rank === null || Number.isInteger(i.rank) && i.rank >= 1 && i.rank <= 28)
      && [i.reason,i.strongest_opposition,i.invalidation,i.checkpoint].every(text)
      && [i.as_of_utc,i.starts_at,i.until_utc].every(stamp)
      && Date.parse(i.as_of_utc) <= Date.parse(i.starts_at) && Date.parse(i.starts_at) < Date.parse(i.until_utc)
      && ['current','superseded','source_gap','provisional'].includes(i.status)
      && (i.daily_close === undefined || i.daily_close && i.daily_close.source_id === 'Pepperstone-Demo'
        && /^\d{4}-\d\d-\d\d$/.test(i.daily_close.broker_day) && ['green','red','flat'].includes(i.daily_close.color)
        && [i.daily_close.open_price,i.daily_close.observed_price].every(p => Number.isFinite(p) && p > 0)
        && [i.daily_close.observed_utc,i.daily_close.closes_at].every(stamp) && text(i.daily_close.reason)
        && Date.parse(i.daily_close.observed_utc) <= Date.parse(i.as_of_utc) && Date.parse(i.as_of_utc) < Date.parse(i.daily_close.closes_at))
      && Array.isArray(i.evidence) && i.evidence.length === 2 && i.evidence.every((e,n) => e
        && e.currency === i.pair.slice(n*3,n*3+3) && text(e.assessment_id) && text(e.reason)
        && Array.isArray(e.evidence_ids) && e.evidence_ids.length > 0 && e.evidence_ids.every(text)
        && Array.isArray(e.sources) && e.sources.length > 0 && e.sources.every(s => s && s.kind === 'web'
          && text(s.label) && typeof s.note === 'string' && safeThesisLink(s.locator))))
}
export function recommendationState(item: RecommendedPair, now: number) {
  if (item.status === 'superseded') return 'Reassessment due · currency updated'
  if (item.status === 'source_gap') return 'Reassessment due · evidence gap'
  if (now >= Date.parse(item.until_utc)) return 'Reassessment due · checkpoint passed'
  if (now < Date.parse(item.starts_at)) return 'Not yet active'
  return item.status === 'provisional' ? 'Provisional' : 'Current'
}
