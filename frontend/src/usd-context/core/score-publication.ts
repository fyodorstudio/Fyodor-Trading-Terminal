import type { InspectorEvent, InspectorRelease } from '../../inspector/inspector-data'
import { assessCpiScoreV3, cpiV3SeriesIds } from '../../inspector/scoring/PAIR/EURUSD/USD/CPI/assessment/cpi-score-v3'
import { assessNfpScoreV2, nfpV2SeriesIds } from '../../inspector/scoring/PAIR/EURUSD/USD/NFP/assessment/nfp-score-v2'
import { assessIsmScoreV3 } from '../../inspector/scoring/PAIR/EURUSD/USD/ISM/assessment/ism-score-v3'
import { ismV2SeriesIds } from '../../inspector/scoring/PAIR/EURUSD/USD/ISM/assessment/ism-score-v2'
import { assessRetailScore } from '../../inspector/scoring/PAIR/EURUSD/USD/RETAIL/assessment/retail-score'
import { retailSeriesIds } from '../../inspector/scoring/PAIR/EURUSD/USD/RETAIL/policy/retail-policy'
import { assessClaimsScore } from '../../inspector/scoring/PAIR/EURUSD/USD/CLAIMS/assessment/claims-score'
import { claimsSeriesIds } from '../../inspector/scoring/PAIR/EURUSD/USD/CLAIMS/policy/claims-policy'
import { assessPceScore, pceSeriesIds } from '../../inspector/scoring/PAIR/EURUSD/USD/PCE/assessment/pce-score'
import { assessPpiScore } from '../../inspector/scoring/PAIR/EURUSD/USD/PPI/assessment/ppi-score'
import { ppiSeriesIds } from '../../inspector/scoring/PAIR/EURUSD/USD/PPI/policy/ppi-policy'
import { assessGdpScore } from '../../inspector/scoring/PAIR/EURUSD/USD/GDP/assessment/gdp-score'
import { gdpSeriesIds } from '../../inspector/scoring/PAIR/EURUSD/USD/GDP/policy/gdp-policy'
import type { ContextFamily, ContextSettings, FamilyAssessment } from './contracts'
import { cpiContextTraits, nfpContextTraits } from './interaction/source-traits'
import { sourceCoverage } from './source-coverage'

export const contextSeriesIds: readonly string[] = [...cpiV3SeriesIds, ...nfpV2SeriesIds, ...ismV2SeriesIds, ...retailSeriesIds, ...claimsSeriesIds, ...pceSeriesIds, ...ppiSeriesIds, ...gdpSeriesIds]
export const publicationFamily = (id: string): ContextFamily | null => id === 'jobs' ? 'nfp' : id === 'us-cpi' ? 'cpi' :
  id === 'ism-services' || id === 'ism-manufacturing' ? 'ism' : id === 'retail' ? 'retail' : id === 'claims' ? 'claims' : id === 'pce' ? 'pce' : id === 'ppi' ? 'ppi' : id === 'gdp' ? 'gdp' : null
export function scorePublication(release: InspectorRelease, events: readonly InspectorEvent[], settings: ContextSettings): FamilyAssessment {
  const family = publicationFamily(release.familyId)!
  const score = family === 'pce' ? assessPceScore(release, events, settings.pce) : family === 'ppi' ? assessPpiScore(release, events, settings.ppi) : family === 'gdp' ? assessGdpScore(release, events, settings.gdp) : family === 'nfp' ? assessNfpScoreV2(release, events, settings.nfp) : family === 'cpi' ?
    assessCpiScoreV3(release, events, settings.cpi) : family === 'claims' ? assessClaimsScore(release, events, settings.claims) : family === 'retail' ? assessRetailScore(release, events, settings.retail) : assessIsmScoreV3(release, events,
      { services: settings.services, manufacturing: settings.manufacturing })
  return { family, sourceId: release.id, sourceLabel: release.familyId === 'ism-services' ? 'ISM Services' :
    release.familyId === 'ism-manufacturing' ? 'ISM Manufacturing' : family === 'nfp' ? 'NFP' : family === 'claims' ? 'Jobless Claims' : family === 'retail' ? 'Retail Sales' : family === 'pce' ? 'PCE' : family === 'ppi' ? 'PPI' : family === 'gdp' ? 'GDP' : 'CPI',
    releaseAt: release.releaseAt!, chartAt: release.chartTime! * 1000, total: score?.total ?? null,
    usdDirection: score?.direction === 'short' ? 'stronger' : score?.direction === 'long' ? 'weaker' : 'uncomputed',
    strength: score?.strength === 'strong' || score?.strength === 'moderate' || score?.strength === 'weak' ? score.strength : null,
    reason: score?.strengthReason ?? 'No usable assessment.',
    explanation: score?.explanation ?? 'No usable assessment.', changeSize: score?.changeSize ?? null,
    reduced: score?.reduced ?? true, tie: !!score?.tieBreak, coverage: sourceCoverage(score?.readings),
    ...(family === 'cpi' ? { traits: cpiContextTraits(score as ReturnType<typeof assessCpiScoreV3>) } :
      family === 'nfp' ? { traits: nfpContextTraits(score as ReturnType<typeof assessNfpScoreV2>) } :
      family === 'claims' ? { traits: { kind: 'claims' as const, streak: 0, confirmed: false,
        trendAgreement: !!score && score.total !== null && score.total !== 0 &&
          score.readings.filter(r => r.id === 'initial-trend' || r.id === 'continuing-pressure')
            .every(r => r.points !== null && Math.sign(r.points) === Math.sign(score.total!)) } } : {}) }
}
