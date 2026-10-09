export type ClaimsHorizon = 'release' | 'trend'
export const claimsStandaloneVersion = 'claims-standalone-v3'
export const claimsStandaloneLabel = 'Claims v3'
export const claimsDefaultInitialWeight = 60
export const claimsHorizons = [{ id: 'release', label: 'This release' }, { id: 'trend', label: 'Four-week trend' }] as const

export const claimsStandaloneSignals = {
  release: [
    { id: 'initial-change', seriesId: '840140001', label: 'Initial claims', group: 'new-claims', unit: 'k claims',
      description: 'Revised previous week minus current initial claims; otherwise use the verified prior-week observation.' },
    { id: 'continuing-change', seriesId: '840140002', label: 'Continuing claims', group: 'continued-claims', unit: 'k claims',
      description: 'Revised previous week minus current continuing claims; otherwise use the verified prior-week observation. Millions are converted to thousands.' },
  ],
  trend: [
    { id: 'initial-trend', seriesId: '840140003', label: 'Initial claims four-week average', group: 'new-claims', unit: 'k claims',
      description: 'The reported initial four-week average four reference weeks earlier minus the latest reported average, using revisions known at publication.' },
    { id: 'continuing-trend', seriesId: '840140002', label: 'Continuing claims four-week mean', group: 'continued-claims', unit: 'k claims',
      description: 'Mean of reference weeks t−4 through t−7 minus mean of t through t−3. The periods do not overlap; each week uses its latest known observation or revision.' },
  ],
} as const

export function claimsWeightedSignals(horizon: ClaimsHorizon, initialWeight = claimsDefaultInitialWeight) {
  if (!Number.isInteger(initialWeight) || initialWeight < 1 || initialWeight > 99) throw new RangeError('Initial weight must be an integer from 1 to 99.')
  return claimsStandaloneSignals[horizon].map((signal, index) => ({ ...signal, weight: index === 0 ? initialWeight : 100 - initialWeight }))
}
