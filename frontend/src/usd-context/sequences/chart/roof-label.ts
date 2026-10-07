import type { ComboSnapshot } from '../core/contracts'
import { contextPairLabel } from '../../core/usd-pair'
import { contextNames } from '../../core/policy'
import type { ContextFamily } from '../../core/contracts'

const compactNames: Partial<Record<ContextFamily, string>> = { claims: 'Claims', retail: 'Retail' }

// Name contributing families once, even when several weekly/sector reports participate.
// Zero-change companions remain in the tooltip and Inspector, not the driver label.
export function roofLabel(combo: ComboSnapshot) {
  if (combo.kind !== 'fresh-news') return combo.kind === 'ism-sectors' ? 'ISM sectors' :
    combo.kind === 'weekly-labor' ? 'Claims + NFP' : 'Labor + inflation'
  const families = [...new Set(combo.sources.filter(s => s.change !== undefined && s.change !== 0).map(s => s.family))]
  const names = families.map(f => compactNames[f] ?? contextNames[f])
  return names.length ? `${names.slice(0, 3).join(' + ')}${names.length > 3 ? ` +${names.length - 3}` : ''}` : 'No fresh change'
}

export function roofTooltip(combo: ComboSnapshot, hidden = 0) {
  const sources = combo.sources.map(s => `${s.sourceLabel} — ${s.role ?? 'Participating release'}${s.change === undefined ? '' :
    s.change === 0 ? ' (no replacement effect)' : s.change > 0 ? ' (adds USD support)' : ' (reduces USD support)'}`)
  return `${combo.title} · ${contextPairLabel('EURUSD', combo.direction)} · ${combo.strength ?? 'weak'} evidence${hidden ? ` · ${hidden} inputs hidden by marker filters` : ''}\n${sources.join('\n')}\n${combo.explanation}`
}
