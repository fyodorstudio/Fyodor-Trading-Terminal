export const claimsScoreVersion = 'claims-eurusd-weekly-pressure-v1'
export const claimsSeriesIds = ['840140001', '840140002', '840140003'] as const
export const claimsSignals = [
  { id: 'initial-trend', seriesId: '840140003', label: 'Smoothed initial claims', group: 'new-claims', weight: 50, unit: 'k claims',
    description: 'Preceding four reported weekly averages minus the latest reported Initial Claims 4-Week Average. A supplied Revised Previous replaces the nearest prior reading.' },
  { id: 'continuing-pressure', seriesId: '840140002', label: 'Continuing claims', group: 'continued-claims', weight: 30, unit: 'k claims',
    description: 'Preceding four weekly Continuing Claims mean minus Actual, converted from millions to thousands. Continuing claims refers to the week before initial claims.' },
  { id: 'initial-week', seriesId: '840140001', label: 'Latest initial claims', group: 'new-claims', weight: 20, unit: 'k claims',
    description: 'Preceding four weekly Initial Claims mean minus Actual. A supplied Revised Previous replaces the nearest prior reading.' },
] as const
export type ClaimsSignalId = typeof claimsSignals[number]['id']
