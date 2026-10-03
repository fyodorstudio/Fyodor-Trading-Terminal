import type { TimelineReleaseBlock } from './CpiEventTimelineTable'
import type { EventSymbol } from './timeline-event-view'

// IDs from the pinned calendar catalog. Names alone are insufficient: GDP's
// quarterly PCE readings, for example, must not become monthly PCE releases.
export const eventFamilyOptions = [
  { id: 'jobs', label: 'US Jobs report / NFP', country: 'US', currency: 'USD', symbol: 'star',
    events: ['840030015', '840030016', '840030017', '840030018', '840030019', '840030020', '840030022', '840030023', '840030024', '840030032'] },
  { id: 'fomc', label: 'US FOMC', country: 'US', currency: 'USD', symbol: 'moon',
    events: ['840050002', '840050003', '840050004', '840050014', '840050018'] },
  { id: 'ppi', label: 'US PPI', country: 'US', currency: 'USD', symbol: 'sun',
    events: ['840030001', '840030002', '840030003', '840030004'] },
  { id: 'retail', label: 'US Retail Sales', country: 'US', currency: 'USD', symbol: 'cloud',
    events: ['840020010', '840020011', '840020012', '840020021', '840020025'] },
  { id: 'gdp', label: 'US GDP', country: 'US', currency: 'USD', symbol: 'snowflake',
    events: ['840010007', '840010008', '840010009', '840010010', '840010011', '840010012', '840010016', '840010018'] },
  { id: 'ism-manufacturing', label: 'US ISM Manufacturing', country: 'US', currency: 'USD', symbol: 'umbrella',
    events: ['840040001', '840040002', '840040004', '840040006'] },
  { id: 'pce', label: 'US PCE inflation', country: 'US', currency: 'USD', symbol: 'sun',
    events: ['840010001', '840010002', '840010003', '840010004'] },
  { id: 'ism-services', label: 'US ISM Services', country: 'US', currency: 'USD', symbol: 'umbrella',
    events: ['840040003', '840040005', '840040007', '840040008', '840040009'] },
  { id: 'claims', label: 'US Jobless Claims', country: 'US', currency: 'USD', symbol: 'cloud',
    events: ['840140001', '840140002', '840140003'] },
  { id: 'ecb', label: 'ECB policy', country: 'EU', currency: 'EUR', symbol: 'moon',
    events: ['999010002', '999010003', '999010006', '999010007', '999010024'] },
  { id: 'euro-inflation', label: 'Euro-area inflation', country: 'EU', currency: 'EUR', symbol: 'snowflake',
    events: ['999030010', '999030011', '999030012', '999030013', '999030021', '999030022', '999030024', '999030025', '999030026', '999030027'] },
] as const
export type CuratedFamilyId = typeof eventFamilyOptions[number]['id']
export type FamilyWatchlist = CuratedFamilyId[] | null // null means every source family.
export const sixEventFamilies: CuratedFamilyId[] = eventFamilyOptions.slice(0, 6).map((option) => option.id)

export function isCuratedFamily(value: unknown): value is CuratedFamilyId {
  return eventFamilyOptions.some((option) => option.id === value)
}

export function curatedFamilyForBlock(block: TimelineReleaseBlock): CuratedFamilyId | undefined {
  return eventFamilyOptions.find((option) => option.country === block.countryCode &&
    option.currency === block.currency && block.rows.length > 0 && block.rows.every((row) =>
      (option.events as readonly string[]).includes(row.eventId ?? block.eventId ?? '')))?.id
}

export function curatedGroupName(id: CuratedFamilyId, block: TimelineReleaseBlock): string {
  const ids = block.rows.map((row) => row.eventId ?? block.eventId)
  if (id === 'fomc') return ids.includes('840050004') ? 'FOMC minutes' :
    ids.includes('840050018') ? 'FOMC press conference' : 'FOMC decision'
  if (id === 'ecb') return ids.includes('999010002') ? 'ECB meeting accounts' :
    ids.includes('999010003') ? 'ECB press conference' : 'ECB decision'
  // Retain established labels where possible, including saved symbol defaults.
  return ({ jobs: 'Jobs report / NFP', ppi: 'PPI', retail: 'Retail Sales', gdp: 'GDP',
    'ism-manufacturing': 'ISM Manufacturing', pce: 'PCE', 'ism-services': 'ISM Services',
    claims: 'Jobless Claims', 'euro-inflation': 'CPI' } as Record<string, string>)[id]
}

export function defaultFamilySymbol(id?: CuratedFamilyId): EventSymbol {
  return eventFamilyOptions.find((option) => option.id === id)?.symbol ?? 'star'
}
