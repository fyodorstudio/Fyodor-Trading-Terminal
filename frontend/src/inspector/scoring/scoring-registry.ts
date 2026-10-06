import type { InspectorRelease } from '../inspector-data'
import { NfpMagnitudeScoreTables } from './PAIR/EURUSD/USD/NFP/ui/NfpMagnitudeScoreTables'
import { CpiMagnitudeScoreTables } from './PAIR/EURUSD/USD/CPI/ui/CpiMagnitudeScoreTables'
import { PceScore } from './PAIR/EURUSD/USD/PCE/ui/PceScore'
import { IsmServicesScore } from './PAIR/EURUSD/USD/ISM-SERVICES/ui/IsmServicesScore'
import type { InspectorScoringBinding } from './scoring-contracts'

// Pair bindings stay explicit even when Inspector adds support for other pairs.
const matchesEurusdSymbol = (symbol: string) => /^EURUSD(?:[._-].*|[a-z]*)$/i.test(symbol)

export const inspectorScoringBindings: readonly InspectorScoringBinding[] = [
  { pair: 'EURUSD', country: 'US', currency: 'USD', familyId: 'jobs', matchesSymbol: matchesEurusdSymbol, Component: NfpMagnitudeScoreTables },
  { pair: 'EURUSD', country: 'US', currency: 'USD', familyId: 'us-cpi', matchesSymbol: matchesEurusdSymbol, Component: CpiMagnitudeScoreTables },
  { pair: 'EURUSD', country: 'US', currency: 'USD', familyId: 'pce', matchesSymbol: matchesEurusdSymbol, Component: PceScore, fullView: true },
  { pair: 'EURUSD', country: 'US', currency: 'USD', familyId: 'ism-services', matchesSymbol: matchesEurusdSymbol, Component: IsmServicesScore, fullView: true },
]

export function inspectorScoringBinding(symbol: string, release: InspectorRelease | null) {
  if (!release) return null
  return inspectorScoringBindings.find((binding) => binding.matchesSymbol(symbol) &&
    binding.familyId === release.familyId && binding.country === release.country && binding.currency === release.currency) ?? null
}
