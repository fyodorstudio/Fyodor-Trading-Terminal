import type { ComboSnapshot } from '../core/contracts'
import { contextVersion } from '../../core/policy'

export const auditWindows = [
  { id: 'h1', label: 'Activation H1 candle' },
  { id: 'next4', label: 'Next 4 H1 candles' },
  { id: 'next24', label: 'Next 24 H1 candles' },
] as const
export const auditVerdicts = ['Aligned', 'Opposed', 'Unclear'] as const
export type AuditWindow = typeof auditWindows[number]['id']
export type AuditVerdict = typeof auditVerdicts[number]
export type RoofAuditScope = { broker: string | null; symbol: string; comboId: string; snapshot: string }
export type RoofAudit = RoofAuditScope & { observations: Partial<Record<AuditWindow, AuditVerdict>>; updatedAt: number }

/** A changed result/input configuration gets its own audit; never inherits old verdicts. */
export function roofAuditScope(combo: ComboSnapshot, symbol: string, broker: string | null): RoofAuditScope {
  return { broker, symbol, comboId: combo.id, snapshot: JSON.stringify({ version: contextVersion, chartAt: combo.chartAt,
    direction: combo.direction, strength: combo.strength, sources: combo.sources,
    before: combo.before, after: combo.after, checks: combo.checks, experimental: combo.experimental }) }
}
export const sameRoofAudit = (a: RoofAuditScope, b: RoofAuditScope) =>
  a.broker === b.broker && a.symbol === b.symbol && a.comboId === b.comboId && a.snapshot === b.snapshot

export function validRoofAudits(value: unknown): value is RoofAudit[] {
  return Array.isArray(value) && value.every(record => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return false
    const r = record as Record<string, unknown>
    return (r.broker === null || typeof r.broker === 'string') && typeof r.symbol === 'string' && typeof r.comboId === 'string' &&
      typeof r.snapshot === 'string' && typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) &&
      !!r.observations && typeof r.observations === 'object' && !Array.isArray(r.observations) &&
      Object.entries(r.observations).every(([window, verdict]) => auditWindows.some(w => w.id === window) && auditVerdicts.includes(verdict as AuditVerdict))
  })
}
