import type { SupportBalance } from '../../scoring-system/context/usd/support-reading'
import './support-split.css'

export function SupportSplit({ support: s, compact = false }: { support: SupportBalance; compact?: boolean }) {
  const gross = s.long + s.short
  const available = s.state !== 'insufficient' && gross > 1e-12
  const share = (n: number) => available ? `${(100 * n / gross).toFixed(1)}%` : '—'
  return <span className={`support-split ${s.state}${compact ? ' compact' : ''}`} aria-label="Long and Short weighted support">
    <span className="support-long">{compact ? 'L' : 'Long'} {share(s.long)}</span>
    <span className="support-short">{compact ? 'S' : 'Short'} {share(s.short)}</span>
    {compact && (s.state === 'balanced' || !available) && <span className="support-state">{s.state === 'balanced' ? 'Balanced' : s.state === 'unchanged' ? 'Unchanged' : 'Insufficient'}</span>}
  </span>
}
