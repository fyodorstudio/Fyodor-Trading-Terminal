import type { CuratedFamilyId } from './timeline-event-families'

// Editorial priorities for EURUSD episode review, independent of MT5 importance
// and observed returns. Family IDs preserve the original report constituents.
export type PriorityCategory = {
  id: 'policy' | 'inflation' | 'labor' | 'growth'
  label: string
  description: string
  families: CuratedFamilyId[]
}

export const priorityCategories: Record<'EUR' | 'USD', PriorityCategory[]> = {
  EUR: [
    { id: 'policy', label: 'Monetary policy', description: 'ECB decisions, conferences and President speeches', families: ['ecb', 'ecb-president'] },
    { id: 'inflation', label: 'Inflation', description: 'Euro-area headline/core inflation · German CPI/HICP', families: ['euro-inflation', 'german-inflation'] },
    { id: 'growth', label: 'Growth / activity', description: 'Euro-area GDP · Euro-area, German and French PMIs', families: ['euro-gdp', 'euro-pmi', 'german-pmi', 'french-pmi'] },
    { id: 'labor', label: 'Labor / wages', description: 'Euro-area unemployment, employment and wage costs', families: ['euro-labor', 'euro-wages'] },
  ],
  USD: [
    { id: 'policy', label: 'Monetary policy', description: 'FOMC decisions, projections, conferences and Chair remarks', families: ['fomc', 'fed-chair'] },
    { id: 'inflation', label: 'Inflation', description: 'CPI/core CPI · PCE/core PCE · Supporting PPI', families: ['us-cpi', 'pce', 'ppi'] },
    { id: 'labor', label: 'Labor', description: 'NFP report, unemployment and earnings together', families: ['jobs'] },
    { id: 'growth', label: 'Growth / activity', description: 'ISM manufacturing/services · Retail Sales · GDP', families: ['ism-manufacturing', 'ism-services', 'retail', 'gdp'] },
  ],
}

export const mostRelevantFamilies = [...new Set(Object.values(priorityCategories)
  .flatMap((categories) => categories.flatMap((category) => category.families)))]

export function isMostRelevantSelection(selection: string[]): boolean {
  return selection.length === mostRelevantFamilies.length && mostRelevantFamilies.every((id) => selection.includes(id))
}

// Existing source-key selections and marker symbols must survive promotion of a
// source family into the shortlist. Each alias is country/currency-specific.
const promotedSources: [string, string, string, CuratedFamilyId][] = [
  ['US', 'USD', 'CPI', 'us-cpi'],
  ['US', 'USD', 'Fed Chair Yellen Speech', 'fed-chair'],
  ['US', 'USD', 'Fed Chair Yellen Testimony', 'fed-chair'],
  ['US', 'USD', 'Fed Chair Powell Speech', 'fed-chair'],
  ['US', 'USD', 'Fed Chair Powell Testimony', 'fed-chair'],
  ['EU', 'EUR', 'ECB President Draghi Speech', 'ecb-president'],
  ['EU', 'EUR', 'ECB President Lagarde Speech', 'ecb-president'],
  ['EU', 'EUR', 'ECB Marginal Lending Facility Rate Decision', 'ecb'],
  ['DE', 'EUR', 'CPI', 'german-inflation'],
  ['DE', 'EUR', 'HICP', 'german-inflation'],
  ...(['EU', 'DE', 'FR'] as const).flatMap((country) =>
    ['Manufacturing', 'Services', 'Composite'].map((kind) =>
      [country, 'EUR', `S&P Global ${kind} PMI`,
        ({ EU: 'euro-pmi', DE: 'german-pmi', FR: 'french-pmi' } as const)[country]] as [string, string, string, CuratedFamilyId])),
  ['EU', 'EUR', 'Unemployment Rate', 'euro-labor'],
  ['EU', 'EUR', 'Employment Change', 'euro-labor'],
  ['EU', 'EUR', 'Employment Level', 'euro-labor'],
  ['EU', 'EUR', 'Labour Cost Index', 'euro-wages'],
  ['EU', 'EUR', 'Wage Costs', 'euro-wages'],
]
const sourceAliases = new Map(promotedSources.map(([country, currency, family, id]) =>
  [`source:${JSON.stringify([country, currency, family])}`, id]))
const legacyUsCpi = `source:${JSON.stringify(['US', 'USD', 'CPI'])}`

export function upgradeFamilySelections(selection: string[], legacyPolicy = false): string[] {
  return [...new Set(selection.flatMap((id) => [sourceAliases.get(id) ?? id,
    // The former generic CPI choice also covered Median CPI. Keep that source
    // choice alongside the promoted headline/core family in custom profiles.
    ...(id === legacyUsCpi ? [id] : []),
    ...(legacyPolicy && id === 'fomc' ? ['fed-minutes'] : []),
    ...(legacyPolicy && id === 'ecb' ? ['ecb-accounts'] : [])]))]
}
