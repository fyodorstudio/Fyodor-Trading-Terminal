import type { ReactNode } from 'react'
import type { SupportBalance } from '../../usd-context/core/support-reading'
import { WeightedSupportBar } from '../../usd-context/ui/WeightedSupportBar'
import './reading-summary.css'
import './usd-support.css'

export type ReadingVote = { label: string; towardLong: number }

/** A shared reading of existing votes. This component never creates or changes a score. */
export function ReadingSummary({ symbol, label, direction, evidence, support, scope, clock, clockLabel = 'Through', votes = [], children }: {
  symbol: string; label: string; direction: 'long' | 'short' | null; evidence?: string | null;
  support?: SupportBalance | null; scope: string; clock: string; clockLabel?: string;
  votes?: readonly ReadingVote[]; children?: ReactNode;
}) {
  const sign = direction === 'long' ? 1 : -1
  let leader: ReadingVote | undefined, opposition: ReadingVote | undefined
  for (const vote of votes) {
    if (vote.towardLong * sign > 0 && (!leader || Math.abs(vote.towardLong) > Math.abs(leader.towardLong))) leader = vote
    if (vote.towardLong * sign < 0 && (!opposition || Math.abs(vote.towardLong) > Math.abs(opposition.towardLong))) opposition = vote
  }
  const conflicted = support?.state === 'conflicted' || support?.state === 'balanced'
  return <div className="reading-summary">
    <div className={`raycaster-bias ${direction ?? 'neutral'}`} aria-label={label}>
      <span className="reading-symbol">{symbol}</span>
      <strong className="reading-direction">{direction ? direction.toUpperCase() : label.replace(`${symbol} · `, '')}</strong>
    </div>
    <div className="reading-badges">
      <span>{evidence ? `${evidence[0].toUpperCase()}${evidence.slice(1)} evidence` : 'Evidence ungraded'}</span>
      {conflicted && <span className="reading-conflict">Conflicting inputs</span>}
      {support?.narrow && <span>Narrow lead</span>}
      {support?.qualified && <span>Partial evidence</span>}
    </div>
    {support && <div className="usd-support" aria-label="USD directional support">
      <div className="usd-support-split"><WeightedSupportBar support={support} /></div>
      <small>Weighted support, not probabilities.</small>
    </div>}
    <dl className="reading-facts">
      <div><dt>Scope</dt><dd>{scope}</dd></div>
      <div><dt>{clockLabel}</dt><dd className="raycaster-clock">{clock}</dd></div>
      <div><dt>Main support</dt><dd>{direction && leader ? `${leader.label} → ${direction === 'long' ? 'Long' : 'Short'}` : '—'}</dd></div>
      <div><dt>Main opposition</dt><dd>{direction ? opposition ? `${opposition.label} → ${direction === 'long' ? 'Short' : 'Long'}` : 'None among usable votes' : '—'}</dd></div>
    </dl>
    {children}
  </div>
}
