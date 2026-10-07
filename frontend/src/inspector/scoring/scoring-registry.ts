import { EcbScore } from './PAIR/EURUSD/EUR/ui/EcbScore'
import type { InspectorRelease } from '../inspector-data'
import { NfpMagnitudeScoreTables } from './PAIR/EURUSD/USD/NFP/ui/NfpMagnitudeScoreTables'
import { CpiMagnitudeScoreTables } from './PAIR/EURUSD/USD/CPI/ui/CpiMagnitudeScoreTables'
import { PceScore } from './PAIR/EURUSD/USD/PCE/ui/PceScore'
import { RetailScore } from './PAIR/EURUSD/USD/RETAIL/ui/RetailScore'
import { ClaimsScore } from './PAIR/EURUSD/USD/CLAIMS/ui/ClaimsScore'
import { ExpandedReleaseScore } from './shared/ui/ExpandedReleaseScore'
import { FedScore } from './PAIR/EURUSD/USD/FED/ui/FedScore'
import { EurScore } from './PAIR/EURUSD/EUR/ui/EurScore'
import { eurPolicies } from './PAIR/EURUSD/EUR/policy/eur-policies'
import type { InspectorScoringBinding } from './scoring-contracts'

// Pair bindings stay explicit even when Inspector adds support for other pairs.
const matchesEurusdSymbol = (symbol: string) => /^EURUSD(?:[._-].*|[a-z]*)$/i.test(symbol)

export const inspectorScoringBindings: readonly InspectorScoringBinding[] = [
  { pair: 'EURUSD', country: 'EU', currency: 'EUR', familyId: 'ecb', matchesSymbol: matchesEurusdSymbol, Component: EcbScore },
  ...eurPolicies.map(policy => ({ pair: 'EURUSD', country: policy.country, currency: 'EUR' as const, familyId: policy.family,
    matchesSymbol: matchesEurusdSymbol, Component: EurScore })),
  ...['gdp', 'ppi'].map(familyId => ({ pair: 'EURUSD', country: 'US', currency: 'USD' as const, familyId, matchesSymbol: matchesEurusdSymbol, Component: ExpandedReleaseScore })),
  ...['fomc', 'fed-chair'].map(familyId => ({ pair: 'EURUSD', country: 'US', currency: 'USD' as const, familyId, matchesSymbol: matchesEurusdSymbol, Component: FedScore, includesContext: true })),
  { pair: 'EURUSD', country: 'US', currency: 'USD', familyId: 'jobs', matchesSymbol: matchesEurusdSymbol, Component: NfpMagnitudeScoreTables },
  { pair: 'EURUSD', country: 'US', currency: 'USD', familyId: 'us-cpi', matchesSymbol: matchesEurusdSymbol, Component: CpiMagnitudeScoreTables },
  { pair: 'EURUSD', country: 'US', currency: 'USD', familyId: 'pce', matchesSymbol: matchesEurusdSymbol, Component: PceScore },
  { pair: 'EURUSD', country: 'US', currency: 'USD', familyId: 'retail', matchesSymbol: matchesEurusdSymbol, Component: RetailScore },
  { pair: 'EURUSD', country: 'US', currency: 'USD', familyId: 'claims', matchesSymbol: matchesEurusdSymbol, Component: ClaimsScore },
]

export function inspectorScoringBinding(symbol: string, release: InspectorRelease | null) {
  if (!release) return null
  return inspectorScoringBindings.find((binding) => binding.matchesSymbol(symbol) &&
    binding.familyId === release.familyId && binding.country === release.country && binding.currency === release.currency) ?? null
}
