import type { ComboSnapshot } from '../core/contracts'
import { contextNames } from '../../core/policy'

const joinNames = (names: string[]) => names.length < 2 ? names[0] ?? '' : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`

export function comboSummary(combo: ComboSnapshot) {
  const updates = combo.sources.filter(source => source.chartAt === combo.chartAt)
  const activation = updates.length ? joinNames([...new Set(updates.map(s => s.sourceLabel))]) : 'Memory update; no new publication'
  const support = combo.direction === 'stronger' ? 'USD strength' : 'USD weakness'
  if (combo.decision && combo.decision.state !== 'directional') return { activation, updates, why: combo.decision.reason,
    meaning: combo.kind === 'fresh-news' ? 'Recent changes in interpreted support · USD inputs only.' : 'Accumulated USD context interaction.',
    changed: 'This snapshot withholds a directional conclusion. Participating standalone readings remain visible below.' }
  if (combo.direction === 'uncomputed') return { activation, updates, why: 'The available inputs do not establish a directional interpretation.',
    meaning: 'Relationship snapshot · directional evidence unavailable.', changed: 'Inspect the participating releases for missing evidence.' }
  if (combo.kind === 'fresh-news') {
    const changes = combo.sources.filter(s => s.change !== undefined && s.change !== 0)
    const total = changes.reduce((sum, s) => sum + s.change!, 0)
    const agreeing = [...new Set(changes.filter(s => Math.sign(s.change!) === (combo.direction === 'stronger' ? 1 : -1)).map(s => contextNames[s.family]))]
    const opposing = [...new Set(changes.filter(s => Math.sign(s.change!) !== (combo.direction === 'stronger' ? 1 : -1)).map(s => contextNames[s.family]))]
    const why = Math.abs(total) < 1e-12 ? 'Recent support changes cancel; no directional conclusion is justified.' :
      `${joinNames(agreeing)} updates favor ${support}${opposing.length ? `, outweighing opposing changes from ${joinNames(opposing)}` : ''}.`
    return { activation, updates, why,
      meaning: 'Recent changes in interpreted support · USD inputs only. Calibration drift, aging, renewal and coverage changes do not vote.',
      changed: 'This is the direction of the recent changes. Older accumulated context is shown separately below.' }
  }
  if (combo.kind === 'ism-sectors') {
    const usable = combo.sources.filter(s => s.usdDirection !== 'uncomputed')
    const disagree = new Set(usable.map(s => s.usdDirection)).size > 1
    return { activation, updates,
      why: usable.length < combo.sources.length ? `Only part of the sector evidence is usable; the available weighted components favor ${support}.` :
        disagree ? `Manufacturing and Services disagree; their weighted components favor ${support}.` : `Manufacturing and Services both favor ${support}.`,
      meaning: 'ISM sector resolution · one family interpretation, without a second context vote.',
      changed: 'Both sector publications are now available. The latest sector update completes or refreshes the month’s comparison.' }
  }
  const before = combo.before?.direction
  const why = combo.kind === 'weekly-labor' ? `Persistent weekly Claims challenge an older, weak or incomplete NFP reading; the combined evidence favors ${support}.` :
    `Confirmed labor weakness receives priority while core inflation stays within the rule’s limits; the combined evidence favors ${support}.`
  return { activation, updates, why,
    meaning: combo.kind === 'weekly-labor' ? 'Labor interaction · Claims challenge older NFP.' : 'Labor / inflation interaction · a context priority rule qualified.',
    changed: before === undefined || before === 'uncomputed' ? 'This update establishes a direction where earlier context was unavailable.' :
      before !== combo.after.direction ? 'The combined context changes direction at this update.' : 'The combined context keeps its direction; the qualifying relationship changed.' }
}
