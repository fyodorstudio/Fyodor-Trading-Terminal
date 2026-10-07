import { memo } from 'react'
import type { ContextFamily, ContextResult } from '../core/contracts'
import { contextPriority, contextScorers, contextWeights } from '../core/policy'
import { contextPairLabel } from '../core/usd-pair'
import { formatAppTimestamp, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { ScoringNotes } from '../../inspector/scoring/shared/ui/ScoringSection'
import { cpiStandaloneVersionLabel } from '../../inspector/scoring/shared/core/current-scoring-versions'
import { ScoringInputSettings } from '../../inspector/scoring/shared/ui/ScoringInputSettings'

const score = (value: number | null) => value === null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 3, signDisplay: 'exceptZero' })
function ContextInputTableComponent({ families, onToggleFamily, result, symbol, loading, unavailable, cutoff, timeDisplay, summaryLabel, tableLabel = "Raycaster event inputs" }: {
  families: readonly ContextFamily[]; onToggleFamily?: (family: ContextFamily) => void; result: ContextResult | null;
  symbol: string; loading: boolean; unavailable: boolean; cutoff: number | null; timeDisplay: TimeDisplayPreference; summaryLabel: string; tableLabel?: string
}) {
  const ready = !loading && !unavailable && cutoff !== null
  const weights = ready ? result?.policy?.weights ?? contextWeights : contextWeights
  const activeWeight = ready ? result?.members.filter(m => m.status === 'active').reduce((sum, m) => sum + weights[m.family], 0) ?? 0 : null
  const retainedWeight = ready ? result?.members.filter(m => m.status === 'active').reduce((sum, m) =>
    sum + (m.memory?.effectiveWeight ?? weights[m.family]) * (m.coverage ?? 1), 0) ?? 0 : null
  const enabledWeight = families.reduce((sum, family) => sum + weights[family], 0)
  return <>
    <table className="usd-context-inputs" aria-label={tableLabel}><thead><tr><th>Input / scorer</th><th>Weight</th><th>Status</th><th>Output</th><th>USD vote</th></tr></thead>
      <tbody>{contextPriority.map(family => {
        const enabled = families.includes(family), member = ready ? result?.members.find(m => m.family === family) : null
        const output = !enabled ? 'Excluded' : loading ? 'Calculating…' : !ready ? '—' : !member ? 'No history' :
          member.status === 'expired' ? 'Expired' : contextPairLabel(symbol, member.usdDirection)
        const memory = member?.memory
        return <tr key={family}>
          <td>{contextScorers[family]}{family === 'cpi' && <small title="CPI v4 adds publication context around this unchanged release interpreter. Only the standalone score enters this table; combined context is never fed back as a CPI vote.">{cpiStandaloneVersionLabel}</small>}{member && <small>{formatAppTimestamp(member.releaseAt, timeDisplay)}</small>}</td>
          <td>{weights[family]}%{weights[family] !== contextWeights[family] && <small>Base {contextWeights[family]}%</small>}</td>
          <td>{enabled ? 'Enabled' : 'Off'}</td>
          <td title={member ? `${member.explanation} ${member.reason}` : undefined}>{output}
            {member?.status === 'active' && member.strength && <small>{member.strength} evidence</small>}</td>
          <td>{!enabled ? '0' : !ready ? '—' : score(member?.contribution ?? 0)}
            {member && <small>{member.status === 'active' ? `Source ${score(member.total)} × ${weights[family]}%${memory ? ` × ${(memory.retention * 100).toFixed(1)}% retained; ${(memory.coverage * 100).toFixed(0)}% usable components already reflected in source` : ''}` : `Not voting · source ${score(member.total)}`}</small>}
            {memory && <small>{memory.ageDays} days old · {memory.halfLifeDays}-day half-life · Retained assigned weight {memory.effectiveWeight.toFixed(2)}%</small>}
            {member?.traits?.kind === 'claims' && <small>Weekly confirmation: {member.traits.streak}/3{member.traits.confirmed ? ' · qualified' : ''}
              {member.traits.trendAgreement === false ? ' · underlying trends do not confirm the direction' : ''}</small>}</td>
        </tr>
      })}</tbody>
      <tfoot><tr><th>Total</th><td>{Object.values(weights).reduce((a, b) => a + b, 0)}%</td><td />
        <td>{summaryLabel}
          {ready && result?.strength && <small>{result.strength} evidence</small>}</td>
        <td title="Raw pressure is retained for audit even when the directional conclusion is withheld.">{ready ? score(result?.total ?? null) : '—'}<small>Raw USD pressure</small></td></tr></tfoot>
    </table>
    <dl className="context-weight-summary" aria-label="Context weight coverage">
      <div><dt>Enabled weight: </dt><dd>{enabledWeight}%</dd></div>
      <div><dt>Active weight: </dt><dd>{activeWeight === null ? '—' : `${activeWeight}%`}</dd></div>
      <div><dt>Retained usable budget: </dt><dd>{retainedWeight === null ? '—' : `${retainedWeight.toFixed(2)}%`}</dd></div>
      {ready && result?.decision && <><div><dt>Usable configured budget: </dt><dd>{(result.decision.coverage * 100).toFixed(1)}%</dd></div>
        <div><dt>Net / gross agreement: </dt><dd>{(result.decision.agreement * 100).toFixed(1)}%</dd></div></>}
    </dl>
    {onToggleFamily && <ScoringInputSettings currency="USD" inputs={contextPriority.map(family => ({
      id: family, label: contextScorers[family], enabled: families.includes(family), onToggle: () => onToggleFamily(family),
    }))} />}
    <ScoringNotes items={[
      { label: 'Calculation', content: <>USD vote = source score × assigned weight × age retention. Missing component weights are already reflected in the source score; coverage is not multiplied again.</> },
      { label: 'Missing inputs', content: <>Enabled/active weights are assigned budgets before retention. Off or unavailable votes are not redistributed.</> },
      { label: 'Directional safeguards', content: <>At least 60% of the configured budget must have usable components. Below that: Insufficient context. With incomplete coverage, a direction describes available evidence and stays Weak; missing CPI/NFP do not imply agreement or automatically veto other usable inputs. A net lead below one third of gross contributions, or unchanged/cancelling evidence: Mixed evidence. Age reduces votes separately.</> },
      ...(ready && result?.policy ? [{ label: 'Active rule', content: result.policy.label }] : []),
    ]} />
  </>
}

export const ContextInputTable = memo(ContextInputTableComponent)
