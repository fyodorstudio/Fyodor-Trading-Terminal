import type { ContextFamily, ContextResult } from '../../usd-context/core/contracts'
import { contextPriority, contextScorers, contextWeights } from '../../usd-context/core/policy'
import { contextPairLabel } from '../../usd-context/core/usd-pair'
import { formatAppTimestamp, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'

const score = (value: number | null) => value === null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 3, signDisplay: 'exceptZero' })
export function RaycasterInputTable({ families, onToggleFamily, result, symbol, loading, unavailable, cutoff, timeDisplay, summaryLabel }: {
  families: readonly ContextFamily[]; onToggleFamily: (family: ContextFamily) => void; result: ContextResult | null;
  symbol: string; loading: boolean; unavailable: boolean; cutoff: number | null; timeDisplay: TimeDisplayPreference; summaryLabel: string
}) {
  const ready = !loading && !unavailable && cutoff !== null
  const activeWeight = ready ? result?.members.filter(m => m.status === 'active').reduce((sum, m) => sum + contextWeights[m.family], 0) ?? 0 : null
  const enabledWeight = families.reduce((sum, family) => sum + contextWeights[family], 0)
  return <>
    <table aria-label="Raycaster event inputs"><thead><tr><th>Input / scorer</th><th>Weight</th><th>Use</th><th>Output</th><th>USD vote</th></tr></thead>
      <tbody>{contextPriority.map(family => {
        const enabled = families.includes(family), member = ready ? result?.members.find(m => m.family === family) : null
        const output = !enabled ? 'Excluded' : loading ? 'Calculating…' : !ready ? '—' : !member ? 'No history' :
          member.status === 'expired' ? 'Expired' : contextPairLabel(symbol, member.usdDirection)
        return <tr key={family}>
          <td>{contextScorers[family]}{member && <small>{formatAppTimestamp(member.releaseAt, timeDisplay)}</small>}</td>
          <td>{contextWeights[family]}%</td>
          <td><button type="button" className="raycaster-input-toggle" aria-label={`Use ${contextScorers[family]}`} aria-pressed={enabled}
            onClick={() => onToggleFamily(family)}>{enabled ? 'Enabled' : 'Off'}</button></td>
          <td title={member ? `${member.explanation} ${member.reason}` : undefined}>{output}
            {member?.status === 'active' && member.strength && <small>{member.strength} evidence</small>}</td>
          <td>{!enabled ? '0' : !ready ? '—' : score(member?.contribution ?? 0)}
            {member && <small>{member.status === 'active' ? `Source ${score(member.total)} × ${contextWeights[family]}%` : `Not voting · source ${score(member.total)}`}</small>}</td>
        </tr>
      })}</tbody>
      <tfoot><tr><th>Total</th><td>{Object.values(contextWeights).reduce((a, b) => a + b, 0)}%</td><td />
        <td>{summaryLabel}
          {ready && result?.strength && <small>{result.strength} evidence</small>}</td>
        <td>{ready ? score(result?.total ?? null) : '—'}</td></tr></tfoot>
    </table>
    <p>Enabled weight: {enabledWeight}% · Active weight: {activeWeight === null ? '—' : `${activeWeight}%`}. Off or unavailable votes are not redistributed. USD vote = source score × weight.</p>
  </>
}
