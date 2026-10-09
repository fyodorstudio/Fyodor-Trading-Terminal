/** Declared completeness/agreement safeguards; never fitted to a price window. */
export const interpretationLimits = { coverage: .6, agreement: 1 / 3 } as const
export type ContextDecision = { state: 'directional' | 'mixed' | 'insufficient'; coverage: number; agreement: number; reason: string }

export function interpretationQuality(total: number | null, gross: number, coverage: number): ContextDecision {
  const valid = (total === null || Number.isFinite(total)) && Number.isFinite(gross) && gross >= 0 &&
    Number.isFinite(coverage) && coverage >= 0 && coverage <= 1 + 1e-12 && Math.abs(total ?? 0) <= gross + 1e-12
  coverage = valid ? Math.min(1, coverage) : 0
  const agreement = valid && gross > 1e-12 ? Math.min(1, Math.abs(total ?? 0) / gross) : 0
  if (!valid || total === null || coverage + 1e-12 < interpretationLimits.coverage) return {
    state: 'insufficient', coverage, agreement,
    reason: !valid ? 'Invalid numerical context cannot establish a direction.' : total === null ? 'No calibrated active context is available.' :
      'Less than 60% of the configured budget has usable components. Missing observations are not inferred.',
  }
  if (gross <= 1e-12 || agreement < interpretationLimits.agreement || Math.abs(total ?? 0) < 1e-12) return {
    state: 'mixed', coverage, agreement, reason: 'Usable evidence is unchanged, cancels, or has a net lead below one third of gross weighted contributions.',
  }
  return { state: 'directional', coverage, agreement, reason: coverage < 1 - 1e-12 ?
    `Available evidence meets the declared direction rules with ${(coverage * 100).toFixed(1)}% usable configured coverage. Missing components do not confirm this result; evidence is qualified.` :
    'Available evidence meets the declared coverage and agreement rules. This is a numerical interpretation, not a price forecast.' }
}

export function decisionLabel(decision: ContextDecision | undefined) {
  return decision?.state === 'mixed' ? 'Mixed evidence' : decision?.state === 'insufficient' ? 'Insufficient context' : null
}
