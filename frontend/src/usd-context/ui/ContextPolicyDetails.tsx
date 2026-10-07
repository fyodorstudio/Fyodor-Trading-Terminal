import { contextNames, contextPriority, contextWeights } from '../core/policy'
import type { ContextPolicy } from '../core/contracts'

export function ContextPolicyDetails({ policy }: { policy: ContextPolicy | undefined }) {
  if (!policy) return null
  return <div aria-label="USD context interaction rule">
    <p><strong>{policy.label}.</strong> {policy.reason}</p>
    <table aria-label="Context relationship conditions"><thead><tr><th>Condition</th><th>Status</th><th>Requirement</th></tr></thead><tbody>
      {policy.checks.map(check => <tr key={check.label}><td>{check.label}</td>
        <td>{check.state === 'pass' ? 'Met' : check.state === 'fail' ? 'Not met' : 'Unavailable'}</td><td>{check.detail}</td></tr>)}
    </tbody></table>
    <p>Labor + inflation priority transfers 20 percentage points from CPI to NFP. Weekly labor priority transfers 10 points from older NFP to Claims. The rules do not stack; only the current Claims report votes.</p>
    <p>Base weights: {contextPriority.map(f => `${contextNames[f]} ${contextWeights[f]}%`).join(' / ')}. Age and coverage then reduce each vote. These prototype priorities are not probabilities or confirmation of a Fed cut.</p>
  </div>
}
