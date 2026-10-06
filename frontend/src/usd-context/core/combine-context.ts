import type { ContextFamily, ContextResult, FamilyAssessment } from './contracts'
import { contextFamilyExpiry, contextPriority, contextWeights } from './policy'
import { explainContext } from './explanation'
import { resolveLaborInflationPolicy } from './interaction/labor-inflation-policy'
import { resolveWeeklyLaborPolicy } from './interaction/weekly-labor-policy'
import { sourceMemory } from './memory/source-retention'

// Existing scorers share signed magnitude points: positive supports USD.
// Preserve signed source totals; age and component coverage reduce context
// influence transparently. Evidence grades are not probability multipliers.
export function combineContext(latest: Partial<Record<ContextFamily, FamilyAssessment>>, enabled: readonly ContextFamily[], chartAt: number): ContextResult {
  const baseMembers = enabled.flatMap(family => {
    const source = latest[family]
    if (!source) return []
    const status = chartAt >= source.chartAt + contextFamilyExpiry(family) ? 'expired' as const :
      source.usdDirection === 'uncomputed' || source.total === null || !Number.isFinite(source.total) ||
        (source.coverage !== undefined && (!Number.isFinite(source.coverage) || source.coverage <= 0 || source.coverage > 1)) ?
        'unavailable' as const : 'active' as const
    const memory = sourceMemory(source, chartAt, contextWeights[family])
    return [{ ...source, status, memory, contribution: status === 'active' ? source.total! * memory.effectiveWeight / 100 : 0 }]
  })
  const policy = resolveWeeklyLaborPolicy(baseMembers, resolveLaborInflationPolicy(baseMembers))
  const members = baseMembers.map(m => {
    const memory = sourceMemory(m, chartAt, policy.weights[m.family])
    return { ...m, memory, contribution: m.status === 'active' ? m.total! * memory.effectiveWeight / 100 : 0 }
  })
  const active = members.filter(m => m.status === 'active')
  const missing = enabled.filter(f => !active.some(m => m.family === f))
  const total = active.length ? Math.round(active.reduce((sum, m) => sum + m.contribution, 0) * 1e12) / 1e12 : null
  const tie = total === 0 && active.length > 0
  const deciding = total === null ? null : total === 0 ?
    contextPriority.map(f => active.find(m => m.family === f)).find(Boolean)?.usdDirection ?? 'uncomputed' : total > 0 ? 'stronger' : 'weaker'
  const direction = deciding ?? 'uncomputed'
  const gross = active.reduce((sum, m) => sum + Math.abs(m.contribution), 0)
  const agreement = gross ? Math.abs(total ?? 0) / gross : 0
  const coreAgreement = ['nfp', 'cpi'].every(f => active.some(m => m.family === f && m.usdDirection === direction && m.strength === 'strong'))
  const nfp = active.find(m => m.family === 'nfp'), claims = active.find(m => m.family === 'claims')
  const laborConflict = !!nfp && !!claims && nfp.usdDirection !== claims.usdDirection
  const reduced = active.some(m => m.reduced)
  const strength = direction === 'uncomputed' ? null : missing.length || reduced || tie || agreement < 1 / 3 ? 'weak' :
    coreAgreement && !laborConflict && agreement >= 2 / 3 && active.every(m => m.strength !== 'weak') ? 'strong' : 'moderate'
  const reason = direction === 'uncomputed' ? 'No calibrated active family assessment.' : missing.length ?
    'Some enabled families are missing, expired or uncomputed; their weight is not redistributed.' : tie ?
      'Exact cancellation uses the declared priority; evidence is weak.' : reduced ? 'A source assessment has incomplete components.' :
        strength === 'strong' ? 'Labor and inflation both have strong supporting evidence; weighted agreement is broad.' : active.length === 1 ?
          'One active family establishes the direction; strong combined evidence requires labor and inflation confirmation.' :
          'Source disagreement or qualified evidence limits the combined evidence grade.'
  const laborNote = laborConflict ? ' NFP and Claims disagree within the shared labor budget; combined evidence is capped at Moderate.' : ''
  return { direction, total, strength, explanation: explainContext(direction, members, tie) +
    (policy.mode === 'labor-priority' ? ' Labor priority is active.' : policy.mode === 'weekly-labor-priority' ? ' Weekly labor priority is active.' : ''),
    reason: reason + laborNote, members, missing, tie, policy }
}
