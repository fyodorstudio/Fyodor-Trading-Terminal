import type { ContextMember, UsdDirection } from './contracts'
import { contextNames, contextPriority } from './policy'

const evidenceNames = { nfp: 'labor', cpi: 'inflation', claims: 'weekly claims', ism: 'surveyed activity', retail: 'retail spending', pce: 'PCE inflation', ppi: 'producer prices', gdp: 'real growth' }
export function explainContext(direction: UsdDirection, members: ContextMember[], tie: boolean) {
  if (direction === 'uncomputed') return 'No usable USD direction is available from the enabled releases.'
  const supporting = members.filter(m => m.status === 'active' && m.usdDirection === direction)
  const opposing = members.filter(m => m.status === 'active' && m.usdDirection !== direction)
  const describe = (rows: ContextMember[]) => {
    const names = rows.map(r => evidenceNames[r.family])
    return names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
  }
  const noun = direction === 'weaker' ? 'USD weakness' : 'USD strength'
  if (tie) return `Weighted votes cancel; the published ${contextPriority.map(f => contextNames[f]).join(' → ')} priority favors ${noun}.`
  const subject = `${describe(supporting)} evidence`
  const claims = supporting.find(m => m.family === 'claims'), nfp = supporting.find(m => m.family === 'nfp')
  const labor = claims?.traits?.kind === 'claims' && claims.traits.confirmed && nfp ?
    ' Sustained initial and continuing claims trends confirm the latest NFP direction; weekly reports are not added as separate votes.' : ''
  return (opposing.length ? `${subject.charAt(0).toUpperCase() + subject.slice(1)} outweighs ${describe(opposing)} in favor of ${noun}.` :
    `${subject.charAt(0).toUpperCase() + subject.slice(1)} favors ${noun}.`) + labor
}
export function explainUpdate(name: string, previous: { direction: UsdDirection; total: number | null },
  current: { direction: UsdDirection; total: number | null }, sources: readonly ContextMember[]) {
  const readings = sources.length ? sources.map(source => source.status !== 'active' ?
    `${source.sourceLabel}: no usable new vote` : source.total === 0 ?
      `${source.sourceLabel}: zero net source vote` :
      `${source.sourceLabel} supports USD ${source.total! > 0 ? 'strength' : 'weakness'}`).join('; ') : `${name}: no usable new vote`
  if (current.direction === 'uncomputed') return `${readings}. No usable combined direction.`
  const noun = current.direction === 'weaker' ? 'USD-weakness' : 'USD-strength'
  if (previous.direction !== current.direction) return `${readings}. Combined context ${previous.direction === 'uncomputed' ? 'starts with' : 'changes to'} the ${noun} bias.`
  const before = Math.abs(previous.total ?? 0), after = Math.abs(current.total ?? 0)
  return `${readings}. Combined context remains ${noun} with ${after > before ? 'a larger' : after < before ? 'a smaller' : 'the same'} weighted lead.`
}
export const familyTitle = (family: ContextMember) => `${contextNames[family.family]}: ${family.usdDirection} USD · ${family.strength ?? 'no'} evidence · ${family.status}`
