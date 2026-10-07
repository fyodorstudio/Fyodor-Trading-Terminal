import type { ComboSnapshot } from '../core/contracts'
import { contextResultLabel } from '../../core/usd-pair'
import { contextNames } from '../../core/policy'
import type { ContextFamily } from '../../core/contracts'

const compactNames: Partial<Record<ContextFamily, string>> = { claims: 'Claims', retail: 'Retail' }
const labels = new WeakMap<ComboSnapshot, string>()
const descriptions = new WeakMap<ComboSnapshot, string>()

// Name contributing families once, even when several weekly/sector reports participate.
// Zero-change companions remain in the tooltip and Inspector, not the driver label.
export function roofLabel(combo: ComboSnapshot) {
  const cached = labels.get(combo)
  if (cached !== undefined) return cached
  if (combo.kind !== 'fresh-news') return combo.kind === 'ism-sectors' ? 'ISM sectors' :
    combo.kind === 'weekly-labor' ? 'Claims + NFP' : 'Labor + inflation'
  const families = [...new Set(combo.sources.filter(s => s.change !== undefined && s.change !== 0).map(s => s.family))]
  const names = families.map(f => compactNames[f] ?? contextNames[f])
  const label = names.length ? `${names.slice(0, 3).join(' + ')}${names.length > 3 ? ` +${names.length - 3}` : ''}` : 'No fresh change'
  labels.set(combo, label)
  return label
}

export function roofTooltip(combo: ComboSnapshot, hidden = 0) {
  let description = descriptions.get(combo)
  if (description === undefined) {
    const sources = combo.sources.map(s => `${s.sourceLabel} — ${s.role ?? 'Participating release'}${s.change === undefined ? '' :
    s.change === 0 ? ' (no comparable support change)' : s.change > 0 ? ' (interpreted support increased)' : ' (interpreted support decreased)'}`)
    description = `${sources.join('\n')}\n${combo.explanation}`
    descriptions.set(combo, description)
  }
  return `${combo.title} · USD inputs only · ${contextResultLabel('EURUSD', combo)} · ${combo.strength ? `${combo.strength} evidence` : 'direction withheld'}${hidden ? ` · ${hidden} inputs hidden by marker filters` : ''}\nAvailable from ${new Date(combo.chartAt).toISOString().slice(0, 19).replace('T', ' ')} broker time (right endpoint). Earlier connecting lines identify prior inputs.\n${description}`
}
