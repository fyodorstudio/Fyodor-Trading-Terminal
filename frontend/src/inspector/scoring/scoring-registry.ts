import { EcbScore } from './PAIR/EURUSD/EUR/ui/EcbScore'
import type { InspectorRelease } from '../inspector-data'
import { NfpScoreV2 } from './PAIR/EURUSD/USD/NFP/ui/NfpScoreV2'
import { CpiScoreV4 } from './PAIR/EURUSD/USD/CPI/ui/CpiScoreV4'
import { IsmScoreV3 } from './PAIR/EURUSD/USD/ISM/ui/IsmScoreV3'
import { currentScorerLabels, fedScorerLabel } from '../../scoring-system/shared/core/current-scoring-versions'
import { PceScore } from './PAIR/EURUSD/USD/PCE/ui/PceScore'
import { RetailScore } from './PAIR/EURUSD/USD/RETAIL/ui/RetailScore'
import { ClaimsScore } from './PAIR/EURUSD/USD/CLAIMS/ui/ClaimsScore'
import { claimsStandaloneLabel } from '../../scoring-system/PAIR/EURUSD/USD/CLAIMS/policy/claims-standalone-policy'
import { ExpandedReleaseScore } from './shared/ui/ExpandedReleaseScore'
import { FedScore } from './PAIR/EURUSD/USD/FED/ui/FedScore'
import { EurScore } from './PAIR/EURUSD/EUR/ui/EurScore'
import { eurPolicies } from '../../scoring-system/PAIR/EURUSD/EUR/policy/eur-policies'
import type { InspectorScoringBinding } from './scoring-contracts'

// Pair bindings stay explicit even when Inspector adds support for other pairs.
const matchesEurusdSymbol = (symbol: string) => /^EURUSD(?:[._-].*|[a-z]*)$/i.test(symbol)

export const inspectorScoringBindings: readonly InspectorScoringBinding[] = [
  { pair: 'EURUSD', country: 'EU', currency: 'EUR', familyId: 'ecb', matchesSymbol: matchesEurusdSymbol, Component: EcbScore, versionLabel: 'ECB v1' },
  ...eurPolicies.map(policy => ({ pair: 'EURUSD', country: policy.country, currency: 'EUR' as const, familyId: policy.family,
    matchesSymbol: matchesEurusdSymbol, Component: EurScore, versionLabel: policy.label })),
  ...(['gdp', 'ppi'] as const).map(familyId => ({ pair: 'EURUSD', country: 'US', currency: 'USD' as const, familyId, matchesSymbol: matchesEurusdSymbol, Component: ExpandedReleaseScore, versionLabel: currentScorerLabels[familyId] })),
  ...['fomc', 'fed-chair'].map(familyId => ({ pair: 'EURUSD', country: 'US', currency: 'USD' as const, familyId, matchesSymbol: matchesEurusdSymbol, Component: FedScore, includesContext: true, versionLabel: fedScorerLabel })),
  { pair: 'EURUSD', country: 'US', currency: 'USD', familyId: 'jobs', matchesSymbol: matchesEurusdSymbol, Component: NfpScoreV2, versionLabel: currentScorerLabels.nfp },
  { pair: 'EURUSD', country: 'US', currency: 'USD', familyId: 'us-cpi', matchesSymbol: matchesEurusdSymbol, Component: CpiScoreV4, includesContext: true, versionLabel: currentScorerLabels.cpi },
  ...['ism-manufacturing', 'ism-services'].map(familyId => ({ pair: 'EURUSD', country: 'US', currency: 'USD' as const, familyId, matchesSymbol: matchesEurusdSymbol, Component: IsmScoreV3, versionLabel: currentScorerLabels.ism })),
  { pair: 'EURUSD', country: 'US', currency: 'USD', familyId: 'pce', matchesSymbol: matchesEurusdSymbol, Component: PceScore, versionLabel: currentScorerLabels.pce },
  { pair: 'EURUSD', country: 'US', currency: 'USD', familyId: 'retail', matchesSymbol: matchesEurusdSymbol, Component: RetailScore, versionLabel: currentScorerLabels.retail },
  { pair: 'EURUSD', country: 'US', currency: 'USD', familyId: 'claims', matchesSymbol: matchesEurusdSymbol, Component: ClaimsScore, versionLabel: claimsStandaloneLabel },
]

export function inspectorScoringBinding(symbol: string, release: InspectorRelease | null) {
  if (!release) return null
  return inspectorScoringBindings.find((binding) => binding.matchesSymbol(symbol) &&
    binding.familyId === release.familyId && binding.country === release.country && binding.currency === release.currency) ?? null
}
