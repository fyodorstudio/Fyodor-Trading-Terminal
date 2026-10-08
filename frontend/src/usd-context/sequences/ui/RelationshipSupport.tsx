import type { RelationshipSupport as Support } from '../core/relationship-support'
import { SupportSplit } from '../../ui/SupportSplit'

export function RelationshipSupport({ support, calculations = true }: { support: Support; calculations?: boolean }) {
  const gross = support.long + support.short
  const share = (n: number) => gross ? `${(100 * n / gross).toFixed(1)}%` : '0%'
  return <div className="relationship-support" aria-label="Weighted directional support">
    <div className="relationship-split"><SupportSplit support={support} /></div>
    <div className="relationship-bar" aria-hidden="true"><span style={{ width: share(support.long) }} /><span style={{ width: share(support.short) }} /></div>
    <small>Share of weighted support.{calculations && <> Net {support.net.toFixed(3)}; separation {(support.separation * 100).toFixed(1)}%.</>}
      {support.narrow ? ' Narrow lead · weak evidence.' : ''}{support.qualified ? ' Partial or missing evidence.' : ''}</small>
    {calculations && !!support.leaders.length && <p>Leading contributors: {[...new Set(support.leaders)].join(', ')}.</p>}
  </div>
}
