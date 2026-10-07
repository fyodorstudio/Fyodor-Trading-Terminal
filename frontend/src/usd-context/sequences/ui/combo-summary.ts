import type { ComboSnapshot } from '../core/contracts'
import { roofSupport, supportLabel } from '../core/relationship-support'

const joinNames = (names: string[]) => names.length < 2 ? names[0] ?? '' : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`

export function comboSummary(combo: ComboSnapshot) {
  const updates = combo.sources.filter(source => source.chartAt === combo.chartAt)
  const activation = updates.length ? joinNames([...new Set(updates.map(s => s.sourceLabel))]) : 'Memory update; no new publication'
  const policy = combo.kind === 'labor-inflation' || combo.kind === 'weekly-labor'
  const support = roofSupport(combo)
  const why = support.state === 'insufficient' ? `Usable evidence is missing${support.missing.length ? ` for ${joinNames(support.missing)}` : ''}. No complete relationship conclusion is available.` :
    support.direction ? `${joinNames([...new Set(support.leaders)])} contribute most to the ${support.direction === 'long' ? 'Long' : 'Short'} side.${support.state === 'conflicted' ? ' Opposing support remains visible; the lead is the weighted difference, not unanimity.' : ''}${support.narrow ? ' The weighted lead is narrow.' : ''}` :
    support.state === 'balanced' ? 'The two weighted sides cancel exactly; neither side wins.' : 'The available comparable readings add no directional support.'
  const meaning = combo.kind === 'fresh-news' ? 'Recent comparable support changes · USD inputs only. Calibration drift, aging, renewal and coverage changes do not vote.' :
    combo.kind === 'ism-sectors' ? 'Manufacturing / Services resolution · one ISM family budget.' :
    policy ? 'Named labor policy relationship · combined USD evidence is shown separately.' :
    combo.kind === 'fed-relationship' ? 'Numerical rate action alongside macro evidence. Basis points and macro magnitude points are not interchangeable.' :
    'Relationship between available standalone interpretations · base family budgets and source age retained.'
  return { activation, updates, why, meaning,
    changed: `${supportLabel(support)} at this snapshot. ${combo.kind === 'fresh-news' ? 'This describes changes in support, rather than the level of accumulated context.' : 'Earlier inputs become jointly inspectable at the activation publication.'}` }
}
