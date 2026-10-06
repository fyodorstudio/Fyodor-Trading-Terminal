import type { ContextFamily } from './contracts'

export const contextVersion = 'usd-context-memory-v1'
export const contextWeights: Record<ContextFamily, number> = { nfp: 40, cpi: 40, ism: 20 }
export const contextPriority: ContextFamily[] = ['cpi', 'nfp', 'ism']
export const contextExpiryMs = 45 * 86400000
export const contextNames: Record<ContextFamily, string> = { nfp: 'NFP', cpi: 'CPI', ism: 'ISM' }
export const enabledContextFamilies = (families: readonly string[]): ContextFamily[] => [
  ...(families.includes('jobs') ? ['nfp' as const] : []),
  ...(families.includes('us-cpi') ? ['cpi' as const] : []),
  ...(families.some(f => f === 'ism-services' || f === 'ism-manufacturing') ? ['ism' as const] : []),
]
