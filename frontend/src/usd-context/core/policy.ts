import type { ContextFamily } from './contracts'

export const contextVersion = 'usd-context-memory-v2'
export const contextWeights: Record<ContextFamily, number> = { nfp: 40, cpi: 40, ism: 10, retail: 10 }
export const contextPriority: ContextFamily[] = ['cpi', 'nfp', 'ism', 'retail']
export const contextExpiryMs = 45 * 86400000
export const contextNames: Record<ContextFamily, string> = { nfp: 'NFP', cpi: 'CPI', ism: 'ISM', retail: 'Retail Sales' }
export const contextScorers: Record<ContextFamily, string> = { nfp: 'NFP v2', cpi: 'CPI v3.1', ism: 'ISM v3', retail: 'Retail Sales v1' }
export function contextSourceFamilies(families: readonly ContextFamily[]): string[] {
  return families.flatMap(f => f === 'nfp' ? ['jobs'] : f === 'cpi' ? ['us-cpi'] : f === 'ism' ? ['ism-manufacturing', 'ism-services'] : ['retail'])
}
export const enabledContextFamilies = (families: readonly string[]): ContextFamily[] => [
  ...(families.includes('jobs') ? ['nfp' as const] : []),
  ...(families.includes('us-cpi') ? ['cpi' as const] : []),
  ...(families.some(f => f === 'ism-services' || f === 'ism-manufacturing') ? ['ism' as const] : []),
  ...(families.includes('retail') ? ['retail' as const] : []),
]
