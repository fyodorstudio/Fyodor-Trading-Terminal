import { useId } from 'react'
import type { ContextFamily, ContextResult, Evidence } from '../core/contracts'
import { contextPriority, contextScorers, contextWeights } from '../core/policy'
import { contextPairLabel } from '../core/usd-pair'
import { formatAppTimestamp, type TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { cpiStandaloneVersionLabel } from '../../inspector/scoring/shared/core/current-scoring-versions'
import './context-input-cards.css'

const score = (value: number | null) => value === null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 3, signDisplay: 'exceptZero' })

export function ContextInputCards({ families, result, symbol, loading, ready, weights, activityAt, timeDisplay, label, summaryLabel, evidence }: {
  families: readonly ContextFamily[]; result: ContextResult | null; symbol: string; loading: boolean; ready: boolean;
  weights: Record<ContextFamily, number>; activityAt?: number; timeDisplay: TimeDisplayPreference;
  label: string; summaryLabel: string; evidence?: Evidence | null;
}) {
  const id = useId()
  return <div className="context-input-cards" role="list" aria-label={label}>
    {contextPriority.map(family => {
      const enabled = families.includes(family), member = ready ? result?.members.find(m => m.family === family) : null
      const memory = member?.memory, voting = enabled && member?.status === 'active'
      const retention = member?.status === 'expired' ? 0 : member?.status === 'unavailable' ? undefined : memory?.retention
      const output = !enabled ? 'Excluded' : loading ? 'Calculating…' : !ready ? '—' : !member ? 'No history' :
        member.status === 'expired' ? 'Expired' : contextPairLabel(symbol, member.usdDirection)
      const vote = !enabled ? '0' : !ready ? '—' : score(member?.contribution ?? 0)
      const status = !enabled ? 'Off' : member?.status === 'active' ? 'Active' : member?.status === 'expired' ? 'Expired' :
        member?.status === 'unavailable' ? 'Unavailable' : !ready ? 'Awaiting inspection' : 'No history'
      const tone = voting && member.usdDirection !== 'uncomputed' ? output.endsWith('Long') ? 'long' : output.endsWith('Short') ? 'short' : 'neutral' : 'neutral'
      return <article role="listitem" className="context-input-card" data-family={family} key={family} aria-labelledby={`${id}-${family}`}>
        <div className="context-input-heading">
          <h4 id={`${id}-${family}`}>{contextScorers[family]}</h4>
          <span className="context-input-status">{enabled ? 'Enabled' : 'Off'}{enabled ? ` · ${status}` : ''}</span>
          <div className={`context-input-output ${tone}`} title={member ? `${member.explanation} ${member.reason}` : undefined}>
            <strong>{output}</strong>{voting && member.strength && <span>{member.strength} evidence</span>}
          </div>
        </div>
        <dl className="context-input-calculation" aria-label={`${contextScorers[family]} calculation`}>
          <div><dt>Source score</dt><dd data-field="source">{member ? score(member.total) : '—'}</dd></div>
          <div><dt>Assigned weight</dt><dd data-field="weight">{weights[family]}%</dd></div>
          <div><dt>Age retention</dt><dd data-field="retention">{retention === undefined ? '—' : `${(retention * 100).toFixed(1)}%`}</dd></div>
          <div className="context-input-vote"><dt>USD vote</dt><dd data-field="vote">{vote}</dd></div>
        </dl>
        <div className="context-input-age" data-family={family}>
          <dl className="vote-activity-metrics" aria-label={`${contextScorers[family]} age and influence`}>
            <div><dt>Vote age</dt><dd>{memory?.ageDays === undefined ? '-' : `${memory.ageDays} days`}</dd></div>
            <div><dt>Influence remaining</dt><dd>{retention === undefined ? '-' : `${(100 * retention).toFixed(1)}%`}</dd></div>
            <div><dt>Influence lost</dt><dd>{retention === undefined ? '-' : `${(100 * (1 - retention)).toFixed(1)}%`}</dd></div>
          </dl>
          {member?.status === 'expired' && <p>Expired · no active influence</p>}
          {member?.status === 'unavailable' && <p>No usable vote</p>}
        </div>
        <dl className="context-input-details">
          <div><dt>Released</dt><dd>{member ? formatAppTimestamp(member.releaseAt, timeDisplay) : '-'}</dd></div>
          <div className="context-input-release" data-family={family}><dt>New release</dt><dd>{member && member.chartAt === activityAt ? `${member.sourceLabel} · ${formatAppTimestamp(member.releaseAt, timeDisplay)} · ${output}` : '-'}</dd></div>
          {member && <div><dt>Calculation</dt><dd>{voting ? `${score(member.total)} × ${weights[family]}% × ${((memory?.retention ?? 1) * 100).toFixed(1)}% = ${score(member.contribution)}` : `Not voting · source ${score(member.total)}`}</dd></div>}
          {memory && <div><dt>Memory / coverage</dt><dd>{memory.halfLifeDays}-day half-life · {(memory.coverage * 100).toFixed(0)}% usable components already reflected in source</dd></div>}
          {weights[family] !== contextWeights[family] && <div><dt>Base weight</dt><dd>{contextWeights[family]}%</dd></div>}
          {member?.traits?.kind === 'claims' && <div><dt>Weekly confirmation</dt><dd>{member.traits.streak}/3{member.traits.confirmed ? ' · qualified' : ''}{member.traits.trendAgreement === false ? ' · underlying trends do not confirm the direction' : ''}</dd></div>}
          {family === 'cpi' && <div><dt>Scoring engine</dt><dd>{cpiStandaloneVersionLabel} · only the standalone score votes</dd></div>}
        </dl>
      </article>
    })}
    <div className="context-input-total" role="listitem">
      <dl><div><dt>Total assigned weight</dt><dd>{Object.values(weights).reduce((a, b) => a + b, 0)}%</dd></div>
        <div title="Raw pressure is retained for audit even when the directional conclusion is withheld."><dt>Raw USD pressure</dt><dd>{ready ? score(result?.total ?? null) : '—'}</dd></div></dl>
      <p>{summaryLabel}{ready && evidence ? ` · ${evidence} evidence` : ''}</p>
    </div>
  </div>
}
