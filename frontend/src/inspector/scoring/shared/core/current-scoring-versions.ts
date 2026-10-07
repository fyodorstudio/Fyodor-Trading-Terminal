// Public revisions track the current family interpreter/view. Calculation revisions
// remain explicit where a newer publication view reuses an unchanged release engine.
export const currentScorerLabels = {
  cpi: 'CPI v4.1', nfp: 'NFP v2.2', claims: 'Claims v2', ism: 'ISM v3',
  pce: 'PCE v1', retail: 'Retail Sales v1', gdp: 'GDP v1', ppi: 'PPI v1',
} as const
export const cpiStandaloneVersionLabel = 'Standalone engine v3.2'
export const fedScorerLabel = 'Fed v2'
