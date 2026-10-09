import { activationLabel, comboActivation } from '../core/combo-activation'
import type { ComboSnapshot } from '../core/contracts'
import { roofSupport } from '../core/relationship-support'
import { relationshipReading } from '../../core/support-reading'

const joinNames = (names: string[]) => names.length < 2 ? names[0] ?? '' : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`

export function comboSummary(combo: ComboSnapshot) {
  const updates = combo.sources.filter(source => source.chartAt === combo.chartAt)
  const cause = comboActivation(combo)
  const activation = cause.kind === 'publication' ? joinNames([...new Set(updates.map(s => s.sourceLabel))]) : `${activationLabel(cause.kind)} · Memory update; no new publication`
  const policy = combo.kind === 'labor-inflation' || combo.kind === 'weekly-labor'
  const support = roofSupport(combo)
  const why = relationshipReading(support)
  const meaning = combo.kind === 'fresh-news' ? 'How recent news is changing USD support. Older accumulated context can still point the other way.' :
    combo.kind === 'ism-sectors' ? 'What Services and Manufacturing say together. They share one ISM vote.' :
    policy ? 'A labor relationship changed the priorities. The support split includes all active USD inputs.' :
    combo.kind === 'fed-relationship' ? 'The Fed rate action alongside the selected economic reading. The percentages cover economic support only.' :
    'What the selected releases say together, allowing for their weights and age. USD inputs only.'
  return { activation, cause, updates, why, meaning,
    changed: combo.kind === 'fresh-news' ? 'Recent changes in support; accumulated context appears separately.' : cause.kind === 'publication' ?
      'Earlier inputs become jointly inspectable at this publication.' : 'Stored inputs are reassessed at this memory update.' }
}
