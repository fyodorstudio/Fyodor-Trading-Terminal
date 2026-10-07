import type { ContextFamily } from './contracts'
import { currentScorerLabels } from '../../inspector/scoring/shared/core/current-scoring-versions'
export const contextVersion = 'usd-context-memory-v6.2'
// Domain budgets: inflation 40, labor 40, activity 20. Weights never redistribute when off/missing.
export const contextWeights: Record<ContextFamily, number> = { cpi: 28, pce: 10, ppi: 2, nfp: 30, claims: 10, ism: 10, retail: 7, gdp: 3 }
export const contextPriority: ContextFamily[] = ['cpi', 'nfp', 'claims', 'pce', 'ism', 'retail', 'gdp', 'ppi']
export const contextExpiryMs = 45 * 86400000
export const contextFamilyExpiry = (family: ContextFamily) => (family === 'claims' ? 14 : family === 'gdp' ? 120 : 45) * 86400000
export const contextNames: Record<ContextFamily, string> = { nfp: 'NFP', cpi: 'CPI', claims: 'Jobless Claims', ism: 'ISM', retail: 'Retail Sales', pce: 'PCE', ppi: 'PPI', gdp: 'GDP' }
export const contextScorers: Record<ContextFamily, string> = currentScorerLabels
const sourceFamilies: Record<ContextFamily, string[]> = { nfp: ['jobs'], cpi: ['us-cpi'], claims: ['claims'], ism: ['ism-manufacturing','ism-services'], retail: ['retail'], pce: ['pce'], ppi: ['ppi'], gdp: ['gdp'] }
export const contextSourceFamilies = (families: readonly ContextFamily[]): string[] => families.flatMap(f => sourceFamilies[f])
export const enabledContextFamilies = (families: readonly string[]): ContextFamily[] => contextPriority.filter(f => sourceFamilies[f].some(id => families.includes(id)))
