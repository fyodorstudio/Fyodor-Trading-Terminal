import type { assessCpiScoreV3 } from '../../../inspector/scoring/PAIR/EURUSD/USD/CPI/assessment/cpi-score-v3'
import type { assessNfpScoreV2 } from '../../../inspector/scoring/PAIR/EURUSD/USD/NFP/assessment/nfp-score-v2'
import type { CpiContextTraits, NfpContextTraits } from '../contracts'

// Reuse verified canonical features, never re-read unvalidated calendar rows.
// Monthly core is one gate: overlapping fresh/trend signals are not added.
export function cpiContextTraits(score: ReturnType<typeof assessCpiScoreV3>): CpiContextTraits {
  const fresh = score?.readings.find(r => r.id === 'fresh'), trend = score?.readings.find(r => r.id === 'trend')
  const annual = score?.readings.find(r => r.id === 'annual')
  return { kind: 'cpi', monthlyCore: fresh?.inputs?.actual ?? null, threeMonthCore: trend?.inputs?.actual ?? null,
    annualCore: annual?.inputs?.actual ?? null,
    monthlyPressure: fresh?.points != null && trend?.points != null ? Math.max(0, fresh.points, trend.points) : null,
    annualPressure: annual?.points ?? null }
}
export function nfpContextTraits(score: ReturnType<typeof assessNfpScoreV2>): NfpContextTraits {
  return { kind: 'nfp', hiringChange: score?.readings.find(r => r.id === 'hiring')?.value ?? null,
    unemploymentSignal: score?.readings.find(r => r.id === 'unemployment')?.value ?? null }
}
