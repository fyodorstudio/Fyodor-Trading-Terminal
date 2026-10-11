import { eventFamilyOptions } from '../../economic-calendar/catalog'

export const originalInspectorFamilies = ['ecb', 'ecb-president', 'fomc', 'fed-chair', 'euro-inflation', 'german-inflation', 'us-cpi', 'pce', 'ppi']
const existingOrder = [...originalInspectorFamilies, 'euro-labor', 'euro-wages', 'jobs', 'claims',
  'euro-gdp', 'euro-pmi', 'german-pmi', 'french-pmi', 'gdp', 'retail', 'ism-manufacturing', 'ism-services',
  'boe', 'boe-governor', 'uk-cpi', 'uk-labor', 'uk-wages', 'uk-gdp', 'uk-pmi', 'uk-retail']
export const inspectorFamilies = eventFamilyOptions.filter(f => !('inspector' in f) || f.inspector !== false)
  .sort((a, b) => {
    const rank = (id: string) => existingOrder.includes(id) ? existingOrder.indexOf(id) : existingOrder.length
    return rank(a.id) - rank(b.id)
  })
export type InspectorFamilyId = typeof inspectorFamilies[number]['id']
export const inspectorCategories = [
  { id: 'policy', label: 'Monetary policy' }, { id: 'inflation', label: 'Inflation' },
  { id: 'labor', label: 'Labor / wages' }, { id: 'growth', label: 'Growth / activity' },
].map(category => ({ ...category, families: inspectorFamilies.filter(f => f.category === category.id).map(f => f.id) }))

// Exact admission is indexed once, independent of the number of registered families.
const byEvent = new Map<string, typeof inspectorFamilies[number]>(inspectorFamilies.flatMap(family => family.events.map(id =>
  [`${family.country}\0${family.currency}\0${id}`, family] as const)))
export const inspectorFamilyById = new Map(inspectorFamilies.map(family => [family.id, family]))
export function inspectorFamilyForEvent(event: { country_code: string; currency: string; event_id: string }) {
  return byEvent.get(`${event.country_code}\0${event.currency}\0${event.event_id}`)
}
