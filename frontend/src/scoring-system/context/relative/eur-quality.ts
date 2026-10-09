import type { EurFamily } from '../../PAIR/EURUSD/EUR/policy/eur-policies'
import type { EurSlot } from './contracts'
import { eurSlotWeights } from './eur-policy'

export function eurConfiguredWeight(families: readonly EurFamily[]) {
  const slots = new Set<EurSlot>()
  for (const family of families) {
    if (family.includes('inflation')) slots.add('inflation')
    else if (family.endsWith('pmi')) slots.add('pmi')
    else if (family === 'euro-labor') { slots.add('employment'); slots.add('unemployment') }
    else if (family === 'euro-wages') slots.add('wages')
    else if (family === 'euro-gdp') slots.add('gdp')
  }
  return [...slots].reduce((sum, slot) => sum + eurSlotWeights[slot], 0)
}
