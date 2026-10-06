import { contextPriority, contextNames, contextWeights } from '../core/policy'
import type { ContextPolicy } from '../core/contracts'

export function ContextPolicyDetails({ policy }: { policy: ContextPolicy | undefined }) {
  if (!policy) return null
  return <div aria-label="USD context interaction rule">
    <p><strong>{policy.label}.</strong> {policy.reason}</p>
    <ul>{policy.checks.map(check => <li key={check.label}>
      <strong>{check.label}: {check.state === 'pass' ? 'Met' : check.state === 'fail' ? 'Not met' : 'Unavailable'}.</strong> {check.detail}
    </li>)}</ul>
    <p>Base weights: {contextPriority.map(f => `${contextNames[f]} ${contextWeights[f]}%`).join(' / ')}. Inflation shares 40%, labor 40%, activity 20%. When every labor–inflation condition is met, 20 percentage points transfer from CPI to NFP. All other weights stay fixed. These are declared prototype priorities, not probabilities or confirmation of a Fed cut. Monthly CPI signals share one guard; no extra vote is added.</p>
  </div>
}
