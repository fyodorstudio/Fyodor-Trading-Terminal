export const claimsScoreVersion = 'claims-eurusd-sustained-pressure-v2'
export const claimsSeriesIds = ['840140001', '840140002', '840140003'] as const
export const claimsSignals = [
  { id: 'initial-trend', seriesId: '840140003', label: 'Smoothed initial claims', group: 'new-claims', weight: 45, unit: 'k claims',
    description: 'Reported initial-claims four-week average from four reference weeks earlier minus the latest reported four-week average. The two windows do not overlap.' },
  { id: 'continuing-pressure', seriesId: '840140002', label: 'Continuing claims trend', group: 'continued-claims', weight: 40, unit: 'k claims',
    description: 'Previous four-week continuing-claims mean minus the latest four-week mean, converted from millions to thousands. The two windows do not overlap. Supplied Revised Previous replaces the nearest earlier week in the latest window.' },
  { id: 'initial-week', seriesId: '840140001', label: 'Latest initial claims', group: 'new-claims', weight: 15, unit: 'k claims',
    description: 'Preceding four weekly Initial Claims mean minus Actual. A supplied Revised Previous replaces the nearest prior reading.' },
] as const
export type ClaimsSignalId = typeof claimsSignals[number]['id']
