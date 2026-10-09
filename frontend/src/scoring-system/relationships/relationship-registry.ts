import { contextNames, contextPriority } from '../context/usd/policy'
import type { ContextFamily } from '../context/usd/contracts'
import type { RelationshipFamily } from './contracts'

export const relationshipFamilies: readonly RelationshipFamily[] = [...contextPriority, 'fed']
export const relationshipName = (f: RelationshipFamily) => f === 'fed' ? 'Fed' : contextNames[f]
export const relationshipDomain = (f: RelationshipFamily) => f === 'fed' ? 'policy' :
  ['cpi', 'pce', 'ppi'].includes(f) ? 'inflation' : ['nfp', 'claims'].includes(f) ? 'labor' : 'activity'
export const macroRelationshipFamilies = contextPriority as readonly ContextFamily[]
export const relationshipPairs = relationshipFamilies.flatMap((first, index) => relationshipFamilies.slice(index + 1).map(second => ({
  id: `${first}+${second}`, families: [first, second] as readonly RelationshipFamily[],
  label: `${relationshipName(first)} + ${relationshipName(second)}`,
  group: `${relationshipDomain(first)} / ${relationshipDomain(second)}`,
})))
