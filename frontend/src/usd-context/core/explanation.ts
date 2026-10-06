import type { ContextMember, UsdDirection } from './contracts'
import { contextNames } from './policy'

const evidenceNames = { nfp: 'labor', cpi: 'inflation', ism: 'surveyed activity' }
export function explainContext(direction: UsdDirection, members: ContextMember[], tie: boolean) {
  if (direction === 'uncomputed') return 'No usable USD direction is available from the enabled releases.'
  const supporting = members.filter(m => m.status === 'active' && m.usdDirection === direction)
  const opposing = members.filter(m => m.status === 'active' && m.usdDirection !== direction)
  const describe = (rows: ContextMember[]) => rows.map(r => evidenceNames[r.family]).join(' and ')
  const noun = direction === 'weaker' ? 'USD weakness' : 'USD strength'
  if (tie) return `Weighted votes cancel; the published CPI → NFP → ISM priority favors ${noun}.`
  const subject = `${describe(supporting)} evidence`
  return opposing.length ? `${subject.charAt(0).toUpperCase() + subject.slice(1)} outweighs ${describe(opposing)} in favor of ${noun}.` :
    `${subject.charAt(0).toUpperCase() + subject.slice(1)} favors ${noun}.`
}
export function explainUpdate(name: string, previous: { direction: UsdDirection; total: number | null },
  current: { direction: UsdDirection; total: number | null }, source: ContextMember | undefined) {
  if (!source || source.status !== 'active') return `${name}: no usable new vote; evidence is incomplete.`
  if (current.direction === 'uncomputed') return `${name}: no usable combined direction.`
  const noun = current.direction === 'weaker' ? 'USD-weakness' : 'USD-strength'
  if (previous.direction !== current.direction) return `${name} ${previous.direction === 'uncomputed' ? 'establishes' : 'changes the context to'} the ${noun} bias.`
  const before = Math.abs(previous.total ?? 0), after = Math.abs(current.total ?? 0)
  return `${name} ${after > before ? 'reinforces' : after < before ? 'reduces support for' : 'maintains'} the ${noun} bias.`
}
export const familyTitle = (family: ContextMember) => `${contextNames[family.family]}: ${family.usdDirection} USD · ${family.strength ?? 'no'} evidence · ${family.status}`
