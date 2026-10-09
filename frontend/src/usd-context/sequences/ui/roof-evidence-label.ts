import type { ComboSnapshot } from '../../../scoring-system/relationships/contracts'
import type { RelationshipSupport } from '../../../scoring-system/relationships/relationship-support'

export function roofEvidenceLabel(combo: ComboSnapshot, support: RelationshipSupport) {
  return support.narrow ? 'weak evidence · narrow lead' : support.qualified ? 'weak evidence · limited inputs' :
    combo.strength ? `${combo.strength} evidence` : 'evidence ungraded'
}
