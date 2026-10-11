import type { CalendarFamily } from './family'

export const audCalendarFamilies = [
  { id: 'rba', label: 'RBA policy', country: 'AU', currency: 'AUD', category: 'policy', symbol: 'moon',
    events: ['36030008', '36030005', '36030003', '36030004'] },
  { id: 'rba-speakers', label: 'RBA speeches', country: 'AU', currency: 'AUD', category: 'policy', symbol: 'snowflake',
    events: ['36030006', '36030007', '36030024', '36030031'] },
  { id: 'au-cpi', label: 'Australia CPI / underlying inflation', country: 'AU', currency: 'AUD', category: 'inflation', symbol: 'star',
    events: ['36010014', '36010015', '36010018', '36030014', '36030015', '36030009', '36030010'] },
  { id: 'au-labor', label: 'Australia employment / unemployment', country: 'AU', currency: 'AUD', category: 'labor', symbol: 'cloud',
    events: ['36010003', '36010004', '36010005', '36010006'] },
  { id: 'au-wages', label: 'Australia Wage Price Index', country: 'AU', currency: 'AUD', category: 'labor', symbol: 'cloud',
    events: ['36010031', '36010032'] },
  { id: 'au-gdp', label: 'Australia GDP', country: 'AU', currency: 'AUD', category: 'growth', symbol: 'umbrella',
    events: ['36010019', '36010020'] },
  { id: 'au-pmi', label: 'Australia PMI · Services / Manufacturing / Composite', country: 'AU', currency: 'AUD', category: 'growth', symbol: 'umbrella',
    events: ['36500002', '36500001', '36500003'] },
  { id: 'au-retail', label: 'Australia Retail Sales', country: 'AU', currency: 'AUD', category: 'growth', symbol: 'umbrella',
    events: ['36010012', '36010038'] },
  { id: 'au-trade', label: 'Australia Trade Balance', country: 'AU', currency: 'AUD', category: 'growth', symbol: 'umbrella',
    events: ['36010011', '36010009', '36010010'] },
] as const satisfies readonly CalendarFamily[]
