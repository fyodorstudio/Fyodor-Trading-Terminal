import { dailyVerdicts, directionIntensities, reviewCurrencies, safeThesisLink, thesisDay, validReviewStage, type CurrencyCheckpoint, type DailyDirection, type ThesisSource } from './thesis-model'
import { commodityIds } from '../external-sources/research-instruments'

export type ResearchImpact = { currency: string; implication: string; thesis_effect: string }
export type ResearchDevelopment = { id: string; key: string; title: string; facts: string; published_on: string; published_at: string | null;
  event_at: string | null; timing_note: string; verified_utc: string; saved_utc: string; sources: ThesisSource[];
  impacts: ResearchImpact[]; references: { kind: 'external' | 'calendar'; key: string; broker: string | null; value_ids: string[] }[];
  revision_note: string; expected_version: string | null; legacy?: boolean; versions?: ResearchDevelopment[];
  instruments?: string[]; instrument_note?: string; commodity_implication?: string; commodity_thesis_effect?: string }
export type ResearchAssessment = { id: string; currency: string; as_of_utc: string; saved_utc: string; provenance: 'assessment' | 'reconstruction';
  direction: DailyDirection | null; gap: string; evidence_ids: string[]; background_ids: string[]; period_start: string; period_end: string; legacy: boolean; checkpoints?: CurrencyCheckpoint[] }
export type CurrencyResearch = { schema: 1; revision: string; from: string; to: string; currency?: string; developments: ResearchDevelopment[]; assessments: ResearchAssessment[] }

const stamp = (v: unknown): v is string => typeof v === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v))
const date = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v) && Number.isFinite(Date.parse(v+'T00:00:00Z')) && new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v
const sources = (v: unknown): v is ThesisSource[] => Array.isArray(v) && v.length > 0 && v.some(s => s?.kind === 'web')
  && v.every(s => s && typeof s.label === 'string' && typeof s.note === 'string' && typeof s.locator === 'string'
    && (s.kind === 'local' || s.kind === 'web' && safeThesisLink(s.locator)))
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string')
function validDirection(d: DailyDirection, a: ResearchAssessment) {
  const cp=d.reassessment
  return dailyVerdicts.includes(d.verdict) && typeof d.reason==='string' && !!d.reason.trim() && stamp(d.verified_utc) && sources(d.sources) && validReviewStage(d)
    && (a.legacy || d.basis==='standalone' && directionIntensities.includes(d.intensity!) && !!d.horizon?.trim() && (a.provenance==='reconstruction' || Date.parse(d.verified_utc)<=Date.parse(a.as_of_utc)))
    && (cp==null || typeof cp.title==='string' && !!cp.title.trim() && typeof cp.note==='string' && !!cp.note.trim() && sources(cp.sources) && stamp(cp.verified_utc)
      && (cp.event_at===null ? date(cp.event_date) : stamp(cp.event_at) && cp.event_date===null))
}
export function validCurrencyResearch(value: unknown, from: string, to: string, currency?: string): value is CurrencyResearch {
  if (!value || typeof value !== 'object') return false
  const v = value as CurrencyResearch
  return v.schema === 1 && v.from === from && v.to === to && date(v.from) && date(v.to) && v.from <= v.to && typeof v.revision === 'string'
    && (currency === undefined ? v.currency === undefined : v.currency === currency)
    && Array.isArray(v.developments) && new Set(v.developments.map(d => d?.id)).size === v.developments.length
    && v.developments.every(d => d && ['id','key','title','facts','timing_note','revision_note'].every(k => typeof d[k as keyof ResearchDevelopment] === 'string')
      && date(d.published_on) && (d.published_at === null || stamp(d.published_at) && thesisDay(d.published_at) === d.published_on)
      && (d.event_at === null || stamp(d.event_at) && Date.parse(d.event_at)<=Date.parse(d.verified_utc)) && stamp(d.verified_utc) && stamp(d.saved_utc) && sources(d.sources)
      && (d.published_at===null || Date.parse(d.published_at)<=Date.parse(d.verified_utc))
      && Array.isArray(d.impacts) && (d.impacts.length > 0 || !!d.instruments?.length) && new Set(d.impacts.map(i => i?.currency)).size === d.impacts.length
      && (d.instruments===undefined || Array.isArray(d.instruments) && d.instruments.every(i => commodityIds.includes(i as typeof commodityIds[number]))
        && (!d.instruments.length || [d.instrument_note,d.commodity_implication,d.commodity_thesis_effect].every(s=>typeof s==='string' && !!s.trim())))
      && d.impacts.every(i => i && reviewCurrencies.includes(i.currency as typeof reviewCurrencies[number]) && typeof i.implication === 'string' && typeof i.thesis_effect === 'string')
      && (currency === undefined || d.impacts.some(i => i.currency === currency))
      && Array.isArray(d.references) && d.references.every(r => r && ['external','calendar'].includes(r.kind) && typeof r.key === 'string'
        && strings(r.value_ids) && (r.broker === null || typeof r.broker === 'string')))
    && Array.isArray(v.assessments) && v.assessments.every(a => a && typeof a.id === 'string' && reviewCurrencies.includes(a.currency as typeof reviewCurrencies[number])
      && (currency === undefined || a.currency === currency)
      && stamp(a.as_of_utc) && stamp(a.saved_utc) && thesisDay(a.as_of_utc) <= to && ['assessment','reconstruction'].includes(a.provenance)
      && typeof a.gap === 'string' && strings(a.evidence_ids) && strings(a.background_ids) && date(a.period_start) && date(a.period_end)
      && (a.direction === null ? !!a.gap.trim() : validDirection(a.direction,a)))
}

export function researchAssessment(data: CurrencyResearch, currency: string) {
  const ordered = data.assessments.filter(a => a.currency === currency).sort((a,b) => Date.parse(b.as_of_utc)-Date.parse(a.as_of_utc)
    || Date.parse(b.saved_utc)-Date.parse(a.saved_utc))
  const latest=ordered[0], retained=ordered.find(a=>a.direction)
  return latest && !latest.direction && retained ? { ...latest, direction:{ ...retained.direction!,reassessment:null,reassessment_gap:latest.gap },
    evidence_ids:retained.evidence_ids,background_ids:retained.background_ids } : latest
}
