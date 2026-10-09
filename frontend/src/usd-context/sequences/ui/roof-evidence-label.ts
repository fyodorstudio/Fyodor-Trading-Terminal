import type { ComboSnapshot } from '../core/contracts'
import type { RelationshipSupport } from '../core/relationship-support'

export function roofEvidenceLabel(combo: ComboSnapshot, support: RelationshipSupport) {
  return support.narrow ? 'weak evidence · narrow lead' : support.qualified ? 'weak evidence · limited inputs' :
    combo.strength ? `${combo.strength} evidence` : 'evidence ungraded'
}
