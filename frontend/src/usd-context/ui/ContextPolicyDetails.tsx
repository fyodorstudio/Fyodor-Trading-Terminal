import { contextPriority, contextNames, contextWeights } from '../core/policy'
import type { ContextPolicy } from '../core/contracts'

export function ContextPolicyDetails({ policy }: { policy: ContextPolicy | undefined }) {
  if (!policy) return null
  return <div aria-label="USD context interaction rule">
    <p><strong>{policy.label}.</strong> {policy.reason}</p>
    <ul>{policy.checks.map(check => <li key={check.label}>
      <strong>{check.label}: {check.state === 'pass' ? 'Met' : check.state === 'fail' ? 'Not met' : 'Unavailable'}.</strong> {check.detail}
    </li>)}</ul>
    <p>Base weights: {contextPriority.map(f => `${contextNames[f]} ${contextWeights[f]}%`).join(' / ')}. Inflation shares 40%, labor 40%, activity 20%. Qualified labor–inflation conditions transfer 20 percentage points from CPI to NFP. Alternatively, sustained opposing Claims against an aging Weak/incomplete NFP transfer 10 points from NFP to Claims, within the 40% labor budget. These rules do not stack. Age and coverage then reduce each vote; unused weight is not redistributed. These are declared prototype priorities, not probabilities or confirmation of a Fed cut. Monthly CPI signals share one guard; old weekly reports add no extra votes.</p>
  </div>
}
