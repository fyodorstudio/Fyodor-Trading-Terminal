export const gdpScoreVersion = 'gdp-eurusd-growth-v1'
export const gdpSeriesIds = ['840010007', '840010008', '840010009', '840010010', '840010011', '840010012', '840010016', '840010018'] as const
export const gdpSignals = [
  { id: 'growth', label: 'Real GDP growth', seriesId: '840010007', weight: 50, group: 'output', unit: 'pp', description: 'New quarter: actual minus the preceding four-quarter mean (floor zero). Updated estimate: actual minus the latest earlier estimate for this quarter.' },
  { id: 'consumption', label: 'Real consumer spending', seriesId: '840010016', weight: 30, group: 'demand', unit: 'pp', description: 'Real PCE growth: same new-quarter or same-quarter revision comparison as GDP.' },
  { id: 'sales', label: 'Real final sales', seriesId: '840010018', weight: 20, group: 'output', unit: 'pp', description: 'GDP Sales growth: same new-quarter or same-quarter revision comparison as GDP. Overlaps output; does not establish an independent evidence group.' },
] as const
