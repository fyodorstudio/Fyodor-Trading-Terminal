import type { RelationshipSupport } from '../../../scoring-system/relationships/relationship-support'
import { WeightedSupportBar } from '../../ui/WeightedSupportBar'

export function ComboSupportSummary({ support }: { support: RelationshipSupport }) {
  const leaders = [...new Set(support.leaders)]
  return <section className="combo-support-summary" aria-label="Weighted directional support">
    <WeightedSupportBar support={support} />
    <div className="combo-support-caption"><span>Share of weighted support</span>
      {!!leaders.length && <span>Main contributors: <strong>{leaders.join(', ')}</strong></span>}</div>
  </section>
}
