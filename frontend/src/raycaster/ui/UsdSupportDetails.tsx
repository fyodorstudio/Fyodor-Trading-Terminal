import type { UsdContextPresentation } from '../core/usd-context-presentation'
import './usd-support.css'

export function UsdSupportDetails({ presentation: p, compact = false }: { presentation: UsdContextPresentation; compact?: boolean }) {
  if (p.state === 'insufficient') return <small className="usd-support-note">No directional lead is asserted with insufficient context. Usable configured coverage {(100 * p.coverage).toFixed(1)}% (60% required).</small>
  const gross = p.long + p.short
  const share = (value: number) => gross > 1e-12 ? `${(100 * value / gross).toFixed(1)}%` : '—'
  return <div className="usd-support" aria-label="USD directional support">
    <div className="usd-support-split"><span>Long {share(p.long)}</span><span>Short {share(p.short)}</span></div>
    <div className="usd-support-bar" aria-hidden="true"><span style={{ width: gross ? `${100 * p.long / gross}%` : '0%' }} /><span style={{ width: gross ? `${100 * p.short / gross}%` : '0%' }} /></div>
    <small>Weighted support, not probabilities.{p.narrow ? ' Narrow lead.' : ''}</small>
    {!compact && <>
      <p>Long support {p.long.toFixed(3)} · Short support {p.short.toFixed(3)} · Net toward Long {p.net.toFixed(3)}.</p>
      <p>Separation {(100 * p.separation).toFixed(1)}% · Usable configured coverage {(100 * p.coverage).toFixed(1)}%.</p>
      {!!p.leaders.length && <p>Leading contributors: {p.leaders.join(', ')}.</p>}
    </>}
    {compact && !!p.leaders.length && <small>Leading: {p.leaders.slice(0, 2).join(', ')}{p.leaders.length > 2 ? ` +${p.leaders.length - 2}` : ''}.</small>}
  </div>
}
