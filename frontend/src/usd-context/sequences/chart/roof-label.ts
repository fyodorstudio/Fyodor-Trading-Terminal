import { activationLabel, comboActivation, removalReason } from '../../../scoring-system/relationships/combo-activation'
import type { ComboSnapshot } from '../../../scoring-system/relationships/contracts'
import { roofResultLabel } from '../../../scoring-system/relationships/relationship-support'
import { relationshipName } from '../../../scoring-system/relationships/relationship-registry'
import type { RelationshipFamily } from '../../../scoring-system/relationships/contracts'

const compactNames: Partial<Record<RelationshipFamily, string>> = { claims: 'Claims', retail: 'Retail' }
const labels = new WeakMap<ComboSnapshot, string>()
const descriptions = new WeakMap<ComboSnapshot, string>()

// Name contributing families once, even when several weekly/sector reports participate.
// Zero-change companions remain in the tooltip and Inspector, not the driver label.
export function roofLabel(combo: ComboSnapshot) {
  const cached = labels.get(combo)
  if (cached !== undefined) return cached
  if (combo.kind === 'release-relationship' || combo.kind === 'fed-relationship') return combo.title
  if (combo.kind !== 'fresh-news') return combo.kind === 'ism-sectors' ? 'ISM sectors' :
    combo.kind === 'weekly-labor' ? 'Claims + NFP' : 'Labor + inflation'
  const families = [...new Set(combo.sources.filter(s => s.change !== undefined && s.change !== 0).map(s => s.family))]
  const names = families.map(f => compactNames[f] ?? relationshipName(f))
  const label = names.length ? `${names.slice(0, 3).join(' + ')}${names.length > 3 ? ` +${names.length - 3}` : ''}` : 'No fresh change'
  labels.set(combo, label)
  return label
}

export function roofRateLabel(combo: ComboSnapshot) {
  const fed = combo.sources.find(source => source.family === 'fed')
  if (!fed || fed.chartAt > combo.chartAt || !fed.policyAction) return null
  const delta = fed.policyAction.delta
  return delta !== null && Number.isFinite(delta) ? `Rate ${delta > 0 ? '+' : ''}${delta} bp` : `Rate ${fed.policyAction.action}`
}

export function roofTooltip(combo: ComboSnapshot, hidden = 0, clock = (t: number) => new Date(t).toISOString().slice(0, 19).replace('T', ' ')) {
  let description = descriptions.get(combo)
  if (description === undefined) {
    const sources = combo.sources.map(s => `${s.sourceLabel} — ${s.role ?? 'Participating release'}${s.change === undefined ? '' :
    s.change === 0 ? ' (no comparable support change)' : s.change > 0 ? ' (interpreted support increased)' : ' (interpreted support decreased)'}`)
    description = `${sources.join('\n')}\n${combo.explanation}`
    descriptions.set(combo, description)
  }
  const activation = comboActivation(combo)
  return `${combo.title} · USD inputs only · ${roofResultLabel(combo)} · ${combo.strength ? `${combo.strength} evidence` : 'evidence ungraded'}${hidden ? ` · ${hidden} inputs have no drawable symbol (filtered or outside loaded chart history)` : ''}\nAvailable from ${clock(combo.chartAt)} (label’s candle). ${activationLabel(activation.kind)}${activation.kind !== 'publication' ? '; no new participating publication' : ''}. ${activation.removed.map(s => `${removalReason(s.reason)}: ${s.sourceLabel}`).join('; ')} Connecting lines identify contributing releases. Click the label for the combined reading.\n${description}`
}
