import sourceEvents from '../../../economic-calendar/catalog/source-events.json'
import { eventFamilyOptions } from '../../../economic-calendar/catalog'

export type MacroDefinition = { label: string; controlLabel: string; eventId: string; currency: string; country: string;
  category: string; lowerIsStronger?: boolean; unit?: number; multiplier?: number; suffix?: string; carry?: boolean }
export const macroMetrics: Record<string, MacroDefinition> = {
  rate: { label: 'Fed rate', controlLabel: 'Fed Rate (%)', eventId: '840050014', currency: 'USD', country: 'US', category: 'policy', unit: 1, multiplier: 0, suffix: '%', carry: true },
  payrolls: { label: 'Nonfarm Payrolls', controlLabel: 'Payroll (k)', eventId: '840030016', currency: 'USD', country: 'US', category: 'labor', unit: 4, multiplier: 1, suffix: 'k' },
  unemployment: { label: 'Unemployment', controlLabel: 'Unemployment (%)', eventId: '840030015', currency: 'USD', country: 'US', category: 'labor', lowerIsStronger: true, unit: 1, multiplier: 0, suffix: '%' },
  coreCpi: { label: 'Core CPI MoM', controlLabel: 'Core CPI m/m (%)', eventId: '840030006', currency: 'USD', country: 'US', category: 'inflation', unit: 1, multiplier: 0, suffix: '%' },
  headlineCpi: { label: 'Headline CPI MoM', controlLabel: 'Headline CPI m/m (%)', eventId: '840030005', currency: 'USD', country: 'US', category: 'inflation', unit: 1, multiplier: 0, suffix: '%' },
}
const policyRates = new Set(['999010006', '999010007', '826020009', '392060022', '756010001', '124040006', '36030008', '554020009'])
const lowerIsStronger = new Set([
  '840030024', '840140001', '840140002', '840140003',
  '999030020', '380010022', '380010023', '276060001', '276060002', '276060003', '276060004',
  '250010014', '724010010', '724050001', '826010003', '826010004', '392030007',
  '756040003', '756040005', '124010014', '36010006', '554010014',
])
const byId = new Map(Object.entries(macroMetrics).map(([key, value]) => [value.eventId, key]))
const families = new Map(eventFamilyOptions.flatMap(family => family.events.map(id => [id, family] as const)))
export const macroCatalog: Record<string, MacroDefinition> = { ...macroMetrics }
export function isMacroTextEvent(key: string) {
  const definition = macroCatalog[key]
  return !!definition && (/speech|speeches|speaks|statement|minutes|press conference|testimony|testifies/i.test(definition.controlLabel) || definition.category === 'speeches')
}
for (const event of sourceEvents) {
  if (byId.has(event.id) || event.sector === 'holidays') continue
  const key = `${event.currency}:${event.country}:${event.id}`
  macroCatalog[key] = { label: `${event.currency} · ${event.name}`, controlLabel: `${event.currency} · ${event.name}`,
    eventId: event.id, currency: event.currency, country: event.country, category: families.get(event.id)?.category ?? 'other', ...(policyRates.has(event.id) ? { carry: true } : {}),
    ...(lowerIsStronger.has(event.id) ? { lowerIsStronger: true } : {}) }
}
