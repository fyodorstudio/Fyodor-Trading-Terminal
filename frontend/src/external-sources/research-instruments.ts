import catalog from '../../../config/research-instruments.json'

export const researchInstruments = catalog
export type Commodity = keyof typeof catalog
export const commodityIds = Object.keys(catalog) as Commodity[]
export function chartCommodity(symbol: string): Commodity | undefined {
  return commodityIds.find(id => catalog[id].chart_aliases.some(alias => new RegExp(`^${alias}(?:[._].*|[a-z]*)$`).test(symbol)))
}
