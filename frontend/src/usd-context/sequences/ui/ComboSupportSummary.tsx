import type { RelationshipSupport } from '../core/relationship-support'
import '../../ui/support-split.css'

export function ComboSupportSummary({ support, compact }: { support: RelationshipSupport; compact: boolean }) {
  const gross = support.long + support.short
  const available = support.state !== 'insufficient' && gross > 1e-12
  const long = available ? 100 * support.long / gross : 0
  const short = available ? 100 * support.short / gross : 0
  const leaders = [...new Set(support.leaders)]
  return <section className="combo-support-summary" aria-label="Weighted directional support">
    <div className={`combo-support-bar${available ? '' : ' unavailable'}`} aria-label="Long and Short weighted support">
      <div className="combo-support-fill" aria-hidden="true">
        <span style={{ width: `${long}%` }} /><span style={{ width: `${short}%` }} />
      </div>
      <div className="combo-support-values">
        <strong className="support-long">Long {available ? `${long.toFixed(1)}%` : '—'}</strong>
        <strong className="support-short">Short {available ? `${short.toFixed(1)}%` : '—'}</strong>
      </div>
    </div>
    {!compact && <div className="combo-support-caption"><span>Share of weighted support</span>
      {!!leaders.length && <span>Main contributors: <strong>{leaders.join(', ')}</strong></span>}</div>}
  </section>
}
