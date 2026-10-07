import { memo } from 'react'
import type { ContextFamily, ContextResult } from '../core/contracts'
import { contextPriority, contextScorers, contextWeights } from '../core/policy'
import { contextPairLabel } from '../core/usd-pair'
import { formatAppTimestamp, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { ScoringNotes } from '../../inspector/scoring/shared/ui/ScoringSection'
import { cpiStandaloneVersionLabel } from '../../inspector/scoring/shared/core/current-scoring-versions'

const score = (value: number | null) => value === null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 3, signDisplay: 'exceptZero' })
function ContextInputTableComponent({ families, onToggleFamily, result, symbol, loading, unavailable, cutoff, timeDisplay, summaryLabel, tableLabel = "Raycaster event inputs" }: {
  families: readonly ContextFamily[]; onToggleFamily?: (family: ContextFamily) => void; result: ContextResult | null;
  symbol: string; loading: boolean; unavailable: boolean; cutoff: number | null; timeDisplay: TimeDisplayPreference; summaryLabel: string; tableLabel?: string
}) {
  const ready = !loading && !unavailable && cutoff !== null
  const weights = ready ? result?.policy?.weights ?? contextWeights : contextWeights
  const activeWeight = ready ? result?.members.filter(m => m.status === 'active').reduce((sum, m) => sum + weights[m.family], 0) ?? 0 : null
  const retainedWeight = ready ? result?.members.filter(m => m.status === 'active').reduce((sum, m) =>
    sum + (m.memory?.effectiveWeight ?? weights[m.family]), 0) ?? 0 : null
  const enabledWeight = families.reduce((sum, family) => sum + weights[family], 0)
  return <>
    <table className="usd-context-inputs" aria-label={tableLabel}><thead><tr><th>Input / scorer</th><th>Weight</th><th>Use</th><th>Output</th><th>USD vote</th></tr></thead>
      <tbody>{contextPriority.map(family => {
        const enabled = families.includes(family), member = ready ? result?.members.find(m => m.family === family) : null
        const output = !enabled ? 'Excluded' : loading ? 'Calculating…' : !ready ? '—' : !member ? 'No history' :
          member.status === 'expired' ? 'Expired' : contextPairLabel(symbol, member.usdDirection)
        const memory = member?.memory
        return <tr key={family}>
          <td>{contextScorers[family]}{family === 'cpi' && <small title="CPI v4 adds publication context around this unchanged release interpreter. Only the standalone score enters this table; combined context is never fed back as a CPI vote.">{cpiStandaloneVersionLabel}</small>}{member && <small>{formatAppTimestamp(member.releaseAt, timeDisplay)}</small>}</td>
          <td>{weights[family]}%{weights[family] !== contextWeights[family] && <small>Base {contextWeights[family]}%</small>}</td>
          <td>{onToggleFamily ? <button type="button" className="raycaster-input-toggle" aria-label={`Use ${contextScorers[family]}`} aria-pressed={enabled}
            onClick={() => onToggleFamily(family)}>{enabled ? 'Enabled' : 'Off'}</button> : enabled ? 'Enabled' : 'Off'}</td>
          <td title={member ? `${member.explanation} ${member.reason}` : undefined}>{output}
            {member?.status === 'active' && member.strength && <small>{member.strength} evidence</small>}</td>
          <td>{!enabled ? '0' : !ready ? '—' : score(member?.contribution ?? 0)}
            {member && <small>{member.status === 'active' ? `Source ${score(member.total)} × ${weights[family]}%${memory ? ` × ${(memory.retention * 100).toFixed(1)}% retained × ${(memory.coverage * 100).toFixed(0)}% coverage` : ''}` : `Not voting · source ${score(member.total)}`}</small>}
            {memory && <small>{memory.ageDays} days old · {memory.halfLifeDays}-day half-life · Effective weight {memory.effectiveWeight.toFixed(2)}%</small>}
            {member?.traits?.kind === 'claims' && <small>Weekly confirmation: {member.traits.streak}/3{member.traits.confirmed ? ' · qualified' : ''}
              {member.traits.trendAgreement === false ? ' · underlying trends do not confirm the direction' : ''}</small>}</td>
        </tr>
      })}</tbody>
      <tfoot><tr><th>Total</th><td>{Object.values(weights).reduce((a, b) => a + b, 0)}%</td><td />
        <td>{summaryLabel}
          {ready && result?.strength && <small>{result.strength} evidence</small>}</td>
        <td>{ready ? score(result?.total ?? null) : '—'}</td></tr></tfoot>
    </table>
    <dl className="context-weight-summary" aria-label="Context weight coverage">
      <div><dt>Enabled weight: </dt><dd>{enabledWeight}%</dd></div>
      <div><dt>Active weight: </dt><dd>{activeWeight === null ? '—' : `${activeWeight}%`}</dd></div>
      <div><dt>Retained weight: </dt><dd>{retainedWeight === null ? '—' : `${retainedWeight.toFixed(2)}%`}</dd></div>
    </dl>
    <ScoringNotes items={[
      { label: 'Calculation', content: <>USD vote = source score × assigned weight × age retention × component coverage.</> },
      { label: 'Missing inputs', content: <>Enabled/active weights are assigned budgets before retention. Off or unavailable votes are not redistributed.</> },
      ...(ready && result?.policy ? [{ label: 'Active rule', content: result.policy.label }] : []),
    ]} />
  </>
}

export const ContextInputTable = memo(ContextInputTableComponent)
