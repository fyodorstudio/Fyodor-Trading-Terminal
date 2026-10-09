import { scoringSignalBinding } from './scoring-signal-bindings'
import { ismSectorWeights } from './PAIR/EURUSD/USD/ISM/assessment/ism-monthly-context'

export const usdScoringFamilies = [
  { id: 'claims', label: 'Jobless Claims' }, { id: 'jobs', label: 'NFP' },
  { id: 'us-cpi', label: 'CPI' }, { id: 'pce', label: 'PCE' }, { id: 'ppi', label: 'PPI' },
  { id: 'retail', label: 'Retail Sales' }, { id: 'gdp', label: 'GDP' },
  { id: 'ism-services', label: 'ISM Services' }, { id: 'ism-manufacturing', label: 'ISM Manufacturing' },
  { id: 'fomc', label: 'Fed decision / speeches' },
] as const

export function scoringMethod(family: string) {
  const binding = scoringSignalBinding(family)
  return { binding, signals: binding?.signals ?? [],
    sectorWeight: family === 'ism-services' ? ismSectorWeights.services : family === 'ism-manufacturing' ? ismSectorWeights.manufacturing : null }
}
