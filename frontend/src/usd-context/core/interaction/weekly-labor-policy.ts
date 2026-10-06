import type { ContextMember, ContextPolicy, ContextPolicyCheck } from '../contracts'

export function resolveWeeklyLaborPolicy(members: readonly ContextMember[], base: ContextPolicy): ContextPolicy {
  if (base.mode !== 'balanced') return base
  const nfp = members.find(m => m.family === 'nfp' && m.status === 'active')
  const claims = members.find(m => m.family === 'claims' && m.status === 'active')
  const traits = claims?.traits?.kind === 'claims' ? claims.traits : null
  const checks: ContextPolicyCheck[] = [
    { label: 'Aging qualified NFP', state: !nfp ? 'unavailable' : nfp.memory && nfp.memory.ageDays >= 14 &&
      (nfp.reduced || nfp.strength === 'weak') ? 'pass' : 'fail',
      detail: 'NFP must be at least 14 broker calendar days old and Weak or incomplete. Fresh or complete Moderate/Strong NFP keeps its budget.' },
    { label: 'Sustained opposing weekly claims', state: !claims || !traits ? 'unavailable' :
      traits.confirmed && claims.usdDirection !== nfp?.usdDirection ? 'pass' : 'fail',
      detail: 'Requires three consecutive complete opposing Claims directions, 4–10 days apart, at least 80% component coverage each, and a Moderate/Strong latest report.' },
  ]
  const triggered = checks.every(c => c.state === 'pass')
  return { ...base, mode: triggered ? 'weekly-labor-priority' : base.mode,
    label: triggered ? 'Weekly labor priority' : base.label, checks: [...base.checks, ...checks],
    weights: triggered ? { ...base.weights, nfp: base.weights.nfp - 10, claims: base.weights.claims + 10 } : base.weights,
    reason: triggered ? 'Persistent weekly claims receive 10 percentage points from an aging, qualified NFP assessment. The labor budget stays 40%; old weekly reports add no votes.' : base.reason }
}
