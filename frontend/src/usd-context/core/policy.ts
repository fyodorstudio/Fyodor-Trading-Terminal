import type { ContextFamily } from './contracts'
export const contextVersion = 'usd-context-memory-v6.1'
// Domain budgets: inflation 40, labor 40, activity 20. Weights never redistribute when off/missing.
export const contextWeights: Record<ContextFamily, number> = { cpi: 28, pce: 10, ppi: 2, nfp: 30, claims: 10, ism: 10, retail: 7, gdp: 3 }
export const contextPriority: ContextFamily[] = ['cpi', 'nfp', 'claims', 'pce', 'ism', 'retail', 'gdp', 'ppi']
export const contextExpiryMs = 45 * 86400000
export const contextFamilyExpiry = (family: ContextFamily) => (family === 'claims' ? 14 : family === 'gdp' ? 120 : 45) * 86400000
export const contextNames: Record<ContextFamily, string> = { nfp: 'NFP', cpi: 'CPI', claims: 'Jobless Claims', ism: 'ISM', retail: 'Retail Sales', pce: 'PCE', ppi: 'PPI', gdp: 'GDP' }
export const contextScorers: Record<ContextFamily, string> = { nfp: 'NFP v2', cpi: 'CPI v3.1', claims: 'Claims v2', ism: 'ISM v3', retail: 'Retail Sales v1', pce: 'PCE v1', ppi: 'PPI v1', gdp: 'GDP v1' }
const sourceFamilies: Record<ContextFamily, string[]> = { nfp: ['jobs'], cpi: ['us-cpi'], claims: ['claims'], ism: ['ism-manufacturing','ism-services'], retail: ['retail'], pce: ['pce'], ppi: ['ppi'], gdp: ['gdp'] }
export const contextSourceFamilies = (families: readonly ContextFamily[]): string[] => families.flatMap(f => sourceFamilies[f])
export const enabledContextFamilies = (families: readonly string[]): ContextFamily[] => contextPriority.filter(f => sourceFamilies[f].some(id => families.includes(id)))
