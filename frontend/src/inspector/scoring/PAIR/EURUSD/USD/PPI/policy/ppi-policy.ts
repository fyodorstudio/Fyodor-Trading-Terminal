export const ppiScoreVersion = 'ppi-eurusd-producer-inflation-v1'
export const ppiSeriesIds = ['840030001', '840030002', '840030003', '840030004'] as const
export const ppiSignals = [
  { id: 'core-pace', label: 'Core producer-price pace', seriesId: '840030002', group: 'monthly-prices', weight: 50, unit: 'pp', description: 'Core PPI m/m minus the preceding three-month average, with the nearest prior month revised when supplied.' },
  { id: 'core-annual', label: 'Annual core producer-price change', seriesId: '840030004', group: 'annual-prices', weight: 30, unit: 'pp', description: 'Core PPI y/y minus Revised Previous, otherwise Previous.' },
  { id: 'headline-pace', label: 'Headline producer-price pace', seriesId: '840030001', group: 'monthly-prices', weight: 15, unit: 'pp', description: 'Headline PPI m/m minus the preceding three-month average, with the nearest prior month revised when supplied.' },
  { id: 'headline-annual', label: 'Annual headline producer-price change', seriesId: '840030003', group: 'annual-prices', weight: 5, unit: 'pp', description: 'Headline PPI y/y minus Revised Previous, otherwise Previous.' },
] as const
