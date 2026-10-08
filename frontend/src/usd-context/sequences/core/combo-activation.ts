import type { ContextResult } from '../../core/contracts'
import type { ComboActivation, ComboSnapshot, ComboSource, FreshPoint } from './contracts'
import { freshWindowMs } from './fresh-news'

// Explanatory provenance only. Marker filters and chart layout never decide cause.
export function describeComboActivation(kind: ComboSnapshot['kind'], sources: readonly ComboSource[], at: number,
  previousFresh: FreshPoint | undefined, previous: ContextResult | undefined, current: ContextResult): ComboActivation {
  const removed: ComboActivation['removed'] = kind === 'fresh-news' ?
    (previousFresh?.members.flatMap(s => s.participants ?? [s]) ?? [])
      .filter(s => at - s.chartAt >= freshWindowMs)
      .map(s => ({ sourceId: s.sourceId, sourceLabel: s.sourceLabel, chartAt: s.chartAt, releaseAt: s.releaseAt, reason: 'fresh-window' })) :
    (previous?.members ?? []).filter(s => s.status === 'active' && current.members.some(m => m.family === s.family && m.status === 'expired'))
      .map(s => ({ sourceId: s.sourceId, sourceLabel: s.sourceLabel, chartAt: s.chartAt, releaseAt: s.releaseAt, reason: 'assessment-expiry' }))
  return { kind: sources.some(s => s.chartAt === at) ? 'publication' : removed.length ? 'expiry' : 'aging', removed }
}
export function comboActivation(combo: ComboSnapshot): ComboActivation {
  return combo.activation ?? { kind: combo.sources.some(s => s.chartAt === combo.chartAt) ? 'publication' : 'aging', removed: [] }
}
export const activationLabel = (kind: ComboActivation['kind']) => kind === 'publication' ? 'New publication' : kind === 'expiry' ? 'Expiry update' : 'Aging update'
export const removalReason = (reason: ComboActivation['removed'][number]['reason']) => reason === 'fresh-window' ? 'Removed from the seven-day fresh-news window' : 'Assessment expired'
