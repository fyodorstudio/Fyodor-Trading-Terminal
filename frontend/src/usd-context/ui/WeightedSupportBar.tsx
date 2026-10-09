import type { SupportBalance } from '../../scoring-system/context/usd/support-reading'
import './support-split.css'
import './weighted-support-bar.css'

export function WeightedSupportBar({ support }: { support: SupportBalance }) {
  const gross = support.long + support.short
  const available = support.state !== 'insufficient' && gross > 1e-12
  const long = available ? 100 * support.long / gross : 0
  const short = available ? 100 * support.short / gross : 0
  return <div className={`weighted-support-bar combo-support-bar${available ? '' : ' unavailable'}`} aria-label="Long and Short weighted support">
    <div className="combo-support-fill" aria-hidden="true">
      <span style={{ width: `${long}%` }} /><span style={{ width: `${short}%` }} />
    </div>
    <div className="combo-support-values">
      <strong className="support-long">Long {available ? `${long.toFixed(1)}%` : '—'}</strong>
      <strong className="support-short">Short {available ? `${short.toFixed(1)}%` : '—'}</strong>
    </div>
  </div>
}
