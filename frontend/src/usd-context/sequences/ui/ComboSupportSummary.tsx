import type { RelationshipSupport } from '../core/relationship-support'
import { WeightedSupportBar } from '../../ui/WeightedSupportBar'

export function ComboSupportSummary({ support, compact }: { support: RelationshipSupport; compact: boolean }) {
  const leaders = [...new Set(support.leaders)]
  return <section className="combo-support-summary" aria-label="Weighted directional support">
    <WeightedSupportBar support={support} />
    {!compact && <div className="combo-support-caption"><span>Share of weighted support</span>
      {!!leaders.length && <span>Main contributors: <strong>{leaders.join(', ')}</strong></span>}</div>}
  </section>
}
