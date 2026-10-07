import type { RelationshipSupport as Support } from '../core/relationship-support'

export function RelationshipSupport({ support }: { support: Support }) {
  const gross = support.long + support.short
  const share = (n: number) => gross ? `${(100 * n / gross).toFixed(1)}%` : '0%'
  return <div className="relationship-support" aria-label="Weighted directional support">
    <div className="relationship-split"><span>Long support {share(support.long)}</span><span>Short support {share(support.short)}</span></div>
    <div className="relationship-bar" aria-hidden="true"><span style={{ width: share(support.long) }} /><span style={{ width: share(support.short) }} /></div>
    <small>Support shares, not probabilities. Net {support.net.toFixed(3)}; separation {(support.separation * 100).toFixed(1)}%.
      {support.narrow ? ' Narrow lead · weak evidence.' : ''}{support.qualified ? ' Partial or missing evidence.' : ''}</small>
    {!!support.leaders.length && <p>Leading contributors: {[...new Set(support.leaders)].join(', ')}.</p>}
  </div>
}
