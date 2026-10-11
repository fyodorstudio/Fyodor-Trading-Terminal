import type { CalendarFamily } from './family'

export const gbpCalendarFamilies = [
  { id: 'boe', label: 'BoE policy', country: 'GB', currency: 'GBP', category: 'policy', symbol: 'moon',
    events: ['826020009', '826020010', '826020011', '826020012', '826020008', '826020031', '826020005', '826020013', '826020021'] },
  { id: 'boe-governor', label: 'BoE Governor speeches / testimony', country: 'GB', currency: 'GBP', category: 'policy', symbol: 'snowflake',
    events: ['826020001', '826020032', '826040001'] },
  { id: 'uk-cpi', label: 'UK CPI / core CPI', country: 'GB', currency: 'GBP', category: 'inflation', symbol: 'star',
    events: ['826010011', '826010043', '826010012', '826010013', '826010044'] },
  { id: 'uk-wages', label: 'UK wages / earnings', country: 'GB', currency: 'GBP', category: 'labor', symbol: 'cloud',
    events: ['826010001', '826010002'] },
  { id: 'uk-labor', label: 'UK employment / unemployment', country: 'GB', currency: 'GBP', category: 'labor', symbol: 'cloud',
    events: ['826010003', '826010046', '826010004'] },
  { id: 'uk-gdp', label: 'UK GDP', country: 'GB', currency: 'GBP', category: 'growth', symbol: 'umbrella',
    events: ['826010039', '826010040', '826010037', '826010038'] },
  { id: 'uk-pmi', label: 'UK PMI · Services / Manufacturing / Composite', country: 'GB', currency: 'GBP', category: 'growth', symbol: 'umbrella',
    events: ['826500002', '826500001', '826500005'] },
  { id: 'uk-retail', label: 'UK Retail Sales', country: 'GB', currency: 'GBP', category: 'growth', symbol: 'umbrella',
    events: ['826010019', '826010021', '826010020', '826010022'] },
] as const satisfies readonly CalendarFamily[]
