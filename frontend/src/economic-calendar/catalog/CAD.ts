import type { CalendarFamily } from './family'

export const cadCalendarFamilies = [
  { id: 'boc', label: 'BoC policy', country: 'CA', currency: 'CAD', category: 'policy', symbol: 'moon',
    events: ['124040006', '124040007', '124040004', '124040009'] },
  { id: 'boc-speakers', label: 'BoC Governor speeches', country: 'CA', currency: 'CAD', category: 'policy', symbol: 'snowflake',
    events: ['124040003', '124040017'] },
  { id: 'ca-cpi', label: 'Canada CPI / core / trimmed / median', country: 'CA', currency: 'CAD', category: 'inflation', symbol: 'star',
    events: ['124010003', '124010004', '124010005', '124010006', '124010033', '124010034', '124010032'] },
  { id: 'ca-labor', label: 'Canada employment / unemployment', country: 'CA', currency: 'CAD', category: 'labor', symbol: 'cloud',
    events: ['124010011', '124010012', '124010013', '124010014', '124010015'] },
  { id: 'ca-gdp', label: 'Canada GDP', country: 'CA', currency: 'CAD', category: 'growth', symbol: 'umbrella',
    events: ['124010021', '124010022', '124010035', '124010036'] },
  { id: 'ca-pmi', label: 'Canada Ivey / Manufacturing PMI', country: 'CA', currency: 'CAD', category: 'growth', symbol: 'umbrella',
    events: ['124020001', '124020002', '124500001'] },
  { id: 'ca-retail', label: 'Canada Retail Sales', country: 'CA', currency: 'CAD', category: 'growth', symbol: 'umbrella',
    events: ['124010007', '124010008'] },
  { id: 'ca-trade', label: 'Canada Trade Balance', country: 'CA', currency: 'CAD', category: 'growth', symbol: 'umbrella',
    events: ['124010018', '124010017', '124010016'] },
] as const satisfies readonly CalendarFamily[]
