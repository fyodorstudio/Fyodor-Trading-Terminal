import type { CalendarFamily } from './family'

export const chfCalendarFamilies = [
  { id: 'snb', label: 'SNB policy', country: 'CH', currency: 'CHF', category: 'policy', symbol: 'moon',
    events: ['756010001', '756010002', '756010009'] },
  { id: 'snb-speakers', label: 'SNB speeches', country: 'CH', currency: 'CHF', category: 'policy', symbol: 'snowflake',
    events: ['756010005', '756010007', '756010008', '756010010'] },
  { id: 'ch-cpi', label: 'Switzerland CPI', country: 'CH', currency: 'CHF', category: 'inflation', symbol: 'star',
    events: ['756020001', '756020002'] },
  { id: 'ch-labor', label: 'Switzerland employment / unemployment', country: 'CH', currency: 'CHF', category: 'labor', symbol: 'cloud',
    events: ['756040003', '756040005', '756020008'] },
  { id: 'ch-gdp', label: 'Switzerland GDP', country: 'CH', currency: 'CHF', category: 'growth', symbol: 'umbrella',
    events: ['756040001', '756040002'] },
  { id: 'ch-pmi', label: 'Switzerland Manufacturing PMI', country: 'CH', currency: 'CHF', category: 'growth', symbol: 'umbrella',
    events: ['756060001'] },
  { id: 'ch-retail', label: 'Switzerland Retail Sales', country: 'CH', currency: 'CHF', category: 'growth', symbol: 'umbrella',
    events: ['756020007'] },
  { id: 'ch-kof', label: 'KOF Economic Barometer', country: 'CH', currency: 'CHF', category: 'growth', symbol: 'umbrella',
    events: ['756050001'] },
] as const satisfies readonly CalendarFamily[]
