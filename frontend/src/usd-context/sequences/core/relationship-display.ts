import type { ComboSnapshot } from './contracts'
import { relationshipPairs } from './relationship-registry'

export const roofDisplayOptions = [
  ...relationshipPairs.map(pair => ({ id: pair.id, label: pair.label, group: pair.families.includes('fed') ? 'Fed pairs' : 'Macro pairs' })),
  { id: 'ism-sectors', label: 'ISM Manufacturing + Services', group: 'Specialized relationships' },
  { id: 'labor-inflation', label: 'Labor + inflation priority', group: 'Specialized relationships' },
  { id: 'weekly-labor', label: 'Claims challenge older NFP', group: 'Specialized relationships' },
  { id: 'fresh-news', label: 'Fresh-news combinations', group: 'Specialized relationships' },
]
const displayIds = new Set(roofDisplayOptions.map(option => option.id))
export const validRoofDisplayId = (id: unknown): id is string => typeof id === 'string' && displayIds.has(id)

/** Identity describes a relationship, independently of release date or Fed action. */
export function roofDisplayKey(combo: ComboSnapshot): string {
  if (combo.kind !== 'release-relationship' && combo.kind !== 'fed-relationship') return combo.kind
  const families = new Set(combo.sources.map(source => source.family))
  return relationshipPairs.find(pair => families.size === 2 && pair.families.every(family => families.has(family)))?.id ?? combo.kind
}

export function roofDisplayVisible(combo: ComboSnapshot, preferences: { fresh: boolean; hiddenRoofs?: readonly string[] }): boolean {
  return (combo.kind !== 'fresh-news' || preferences.fresh) && !preferences.hiddenRoofs?.includes(roofDisplayKey(combo))
}
