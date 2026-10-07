import { memo } from 'react'
import { contextNames, contextPriority, contextWeights } from '../core/policy'
import type { ContextPolicy } from '../core/contracts'
import { ScoringNotes } from '../../inspector/scoring/shared/ui/ScoringSection'

function ContextPolicyDetailsComponent({ policy }: { policy: ContextPolicy | undefined }) {
  if (!policy) return null
  return <div aria-label="USD context interaction rule">
    <p><strong>{policy.label}.</strong> {policy.reason}</p>
    <table aria-label="Context relationship conditions"><thead><tr><th>Condition</th><th>Status</th><th>Requirement</th></tr></thead><tbody>
      {policy.checks.map(check => <tr key={check.label}><td>{check.label}</td>
        <td>{check.state === 'pass' ? 'Met' : check.state === 'fail' ? 'Not met' : 'Unavailable'}</td><td>{check.detail}</td></tr>)}
    </tbody></table>
    <ScoringNotes items={[
      { label: 'Weight transfers', content: <>Labor + inflation priority transfers 20 percentage points from CPI to NFP. Weekly labor priority transfers 10 points from older NFP to Claims. The rules do not stack; only the current Claims report votes.</> },
      { label: 'Base weights', content: <>{contextPriority.map(f => `${contextNames[f]} ${contextWeights[f]}%`).join(' / ')}. Age and coverage then reduce each vote.</> },
      { label: 'Meaning', content: <>These prototype priorities are not probabilities or confirmation of a Fed cut.</> },
    ]} />
  </div>
}

export const ContextPolicyDetails = memo(ContextPolicyDetailsComponent)
