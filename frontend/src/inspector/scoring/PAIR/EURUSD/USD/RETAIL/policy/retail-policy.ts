export const retailScoreVersion = 'retail-eurusd-demand-pace-v1'
export const retailSeriesIds = ['840020010', '840020011', '840020012', '840020021', '840020025'] as const
export const retailVotingIds = ['840020012', '840020021', '840020010'] as const

// These are interpretation priorities, not GDP shares or fitted coefficients.
// Nested spending measures provide descriptive breadth, not independent evidence.
export const retailSignals = [
  { id: 'control-pace', seriesId: '840020012', label: 'Control-group pace', group: 'underlying-demand', weight: 60, unit: 'pp',
    description: 'Actual Retail Control m/m minus max(0, preceding three-month average), replacing the nearest prior actual with supplied Revised Previous when available.' },
  { id: 'ex-autos-gas-pace', seriesId: '840020021', label: 'Sales excluding autos and gas', group: 'spending-breadth', weight: 25, unit: 'pp',
    description: 'Actual Retail Sales excl. Autos and Gas m/m minus max(0, preceding three-month average), replacing the nearest prior actual with supplied Revised Previous when available.' },
  { id: 'headline-pace', seriesId: '840020010', label: 'Headline sales pace', group: 'spending-breadth', weight: 15, unit: 'pp',
    description: 'Actual Retail Sales m/m minus max(0, preceding three-month average), replacing the nearest prior actual with supplied Revised Previous when available.' },
] as const
export type RetailSignalId = typeof retailSignals[number]['id']
