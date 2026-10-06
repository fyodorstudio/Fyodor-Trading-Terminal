import type { InspectorEvent, InspectorRelease } from '../../inspector/inspector-data'
import { assessCpiScoreV3, cpiV3SeriesIds } from '../../inspector/scoring/PAIR/EURUSD/USD/CPI/assessment/cpi-score-v3'
import { assessNfpScoreV2, nfpV2SeriesIds } from '../../inspector/scoring/PAIR/EURUSD/USD/NFP/assessment/nfp-score-v2'
import { assessIsmScoreV3 } from '../../inspector/scoring/PAIR/EURUSD/USD/ISM/assessment/ism-score-v3'
import { ismV2SeriesIds } from '../../inspector/scoring/PAIR/EURUSD/USD/ISM/assessment/ism-score-v2'
import { assessRetailScore } from '../../inspector/scoring/PAIR/EURUSD/USD/RETAIL/assessment/retail-score'
import { retailSeriesIds } from '../../inspector/scoring/PAIR/EURUSD/USD/RETAIL/policy/retail-policy'
import type { ContextFamily, ContextSettings, FamilyAssessment } from './contracts'

export const contextSeriesIds: readonly string[] = [...cpiV3SeriesIds, ...nfpV2SeriesIds, ...ismV2SeriesIds, ...retailSeriesIds]
export const publicationFamily = (id: string): ContextFamily | null => id === 'jobs' ? 'nfp' : id === 'us-cpi' ? 'cpi' :
  id === 'ism-services' || id === 'ism-manufacturing' ? 'ism' : id === 'retail' ? 'retail' : null
export function scorePublication(release: InspectorRelease, events: readonly InspectorEvent[], settings: ContextSettings): FamilyAssessment {
  const family = publicationFamily(release.familyId)!
  const score = family === 'nfp' ? assessNfpScoreV2(release, events, settings.nfp) : family === 'cpi' ?
    assessCpiScoreV3(release, events, settings.cpi) : family === 'retail' ? assessRetailScore(release, events, settings.retail) : assessIsmScoreV3(release, events,
      { services: settings.services, manufacturing: settings.manufacturing })
  return { family, sourceId: release.id, sourceLabel: release.familyId === 'ism-services' ? 'ISM Services' :
    release.familyId === 'ism-manufacturing' ? 'ISM Manufacturing' : family === 'nfp' ? 'NFP' : family === 'retail' ? 'Retail Sales' : 'CPI',
    releaseAt: release.releaseAt!, chartAt: release.chartTime! * 1000, total: score?.total ?? null,
    usdDirection: score?.direction === 'short' ? 'stronger' : score?.direction === 'long' ? 'weaker' : 'uncomputed',
    strength: score?.strength === 'strong' || score?.strength === 'moderate' || score?.strength === 'weak' ? score.strength : null,
    reason: score?.strengthReason ?? 'No usable assessment.',
    explanation: score?.explanation ?? 'No usable assessment.', changeSize: score?.changeSize ?? null,
    reduced: score?.reduced ?? true, tie: !!score?.tieBreak }
}
