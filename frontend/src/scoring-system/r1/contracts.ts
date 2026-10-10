import type { EconomicCalendarEvent } from '../../inspector/calendar-event'
import type { InspectorRelease } from '../../inspector/inspector-data'
import type { MagnitudeLimits } from '../../inspector/magnitude/magnitude-distribution'
import type { R1Vintage } from './vintages'

export type UsdR1Family = 'us-cpi' | 'pce' | 'ppi' | 'jobs' | 'claims' | 'gdp' | 'retail' | 'ism-services' | 'ism-manufacturing' | 'fomc'
export type EurR1Family = 'euro-inflation' | 'german-inflation' | 'euro-pmi' | 'euro-services-pmi' | 'euro-manufacturing-pmi' | 'german-pmi' | 'german-services-pmi' | 'german-manufacturing-pmi' | 'french-pmi' | 'french-services-pmi' | 'french-manufacturing-pmi' | 'euro-labor' | 'euro-employment' | 'euro-wages' | 'euro-gdp' | 'ecb'
export type R1Family = UsdR1Family | EurR1Family
export type R1Currency = 'USD' | 'EUR'
export type R1Category = 'inflation' | 'labor' | 'activity' | 'policy'
export type R1Direction = 'strengthening' | 'weakening' | 'balanced' | 'insufficient' | 'empty'
export type R1Strength = 'slight' | 'moderate' | 'strong'
export type R1Profile = { family: R1Family; label: string; version: string; category: R1Category; components: readonly R1Component[]; alternatives: readonly (readonly number[])[]; currency?:R1Currency; country?:string; releaseFamily?:string; calibrationMinimum?:number }
export type R1Component = { id: string; seriesId: string; label: string; weight: number; polarity: 1 | -1; unit: string; units: readonly number[]; multiplier: number; scale?: number; changeLabel: string; period: 'month' | 'week' | 'quarter' | 'action'; relationshipCategory?: R1Category }
export type R1Feature = { actual: number | null; previous: number | null; delta: number | null; reference: number | null; previousReference: number | null; publishedAt: number | null; valueId: string | null; revision: number | null; basis: string; reason: string; stage?: 'momentum' | 'revision'; vintage?:R1Vintage; knownAt?:number|null }
export type R1Reading = R1Component & R1Feature & { magnitude: number | null; points: number | null; contribution: number | null; limits: MagnitudeLimits | null; calibration: 'saved-ap' | 'r1-manual' | 'r1-automatic' | 'undefined' | 'action' | 'unchanged'; samples: number }
export type R1Leaf = { id: string; family: R1Family; label: string; value: number | null; budget: number; sourceId?: string; role?: string; category?: R1Category }
export type R1Balance = { supportive: number; negative: number; net: number; unavailable: number; interval: readonly [number, number]; direction: R1Direction; strength: R1Strength | null; coverage: number; sensitive: boolean; sensitivityRange: readonly [number, number] | null }
export type R1Assessment = R1Balance & { family: R1Family; label: string; version: string; releaseId: string; publishedAt: number | null; reference: number | null; stage: 'momentum' | 'revision'; readings: R1Reading[]; leaves: R1Leaf[]; explanation: string }
export type R1Calibration = { mode: 'automatic' | 'undefined'; limits: Record<string, MagnitudeLimits> }
export type R1FreshnessPolicy = { graceHours: number; fallbackDays: Partial<Record<R1Family,number>> }
export type R1Settings = { version: 1; calibration: R1Calibration; selected: R1Family[]; freshness?: R1FreshnessPolicy }
export type R1MagnitudeSnapshot = Record<string, Record<string, MagnitudeLimits>>
export type R1Schedule = { family: R1Family; dueAt: number; knownAt: number; source: string; supersedesDueAt?: number }
export type R1Slot = { family: R1Family; assessment: R1Assessment | null; status: 'current' | 'stale' | 'unavailable'; nextDue: number | null; expiresAt: number | null; method: 'scheduled' | 'age-based' | null; graceHours: number; fallbackDays: number }
export type R1CategoryResult = R1Balance & { category: R1Category; label: string; leaves: R1Leaf[]; share?: number; anchor?: R1Family; reference?: number | null }
export type R1Aggregate = R1Balance & { at: number; categories: R1CategoryResult[]; leaves: R1Leaf[]; slots: R1Slot[]; selected: R1Family[]; explanation: string; timingSensitive:boolean }
export type R1Input = { release: InspectorRelease; events: readonly EconomicCalendarEvent[]; settings: R1Settings; savedBands: R1MagnitudeSnapshot; schedules?: readonly R1Schedule[]; asOf?: number }
export type R1Transition = { before: R1Aggregate; change: number; publications: string[]; corrections: string[]; expiries: string[] }
export type R1Analysis = { assessment: R1Assessment; assessments?:R1Assessment[]; overall: R1Aggregate; transition: R1Transition }
export type R1Pair = R1Balance & { at:number; eur:R1Aggregate; usd:R1Aggregate; before:R1Balance; change:number }
export type R1PairInput = R1Input & { eurSettings?:R1Settings; pair?:boolean }
export type R1PairAnalysis = R1Analysis & { currency?:R1Currency; pair?:R1Pair }
