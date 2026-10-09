import type { InspectorEvent, InspectorRelease } from '../../../inspector/inspector-data'
import { assessCpiScoreV3, cpiV3SeriesIds } from '../../PAIR/EURUSD/USD/CPI/assessment/cpi-score-v3'
import { assessNfpScoreV2, nfpV2SeriesIds } from '../../PAIR/EURUSD/USD/NFP/assessment/nfp-score-v2'
import { assessIsmScoreV3 } from '../../PAIR/EURUSD/USD/ISM/assessment/ism-score-v3'
import { ismSeriesIds } from '../../PAIR/EURUSD/USD/ISM/assessment/ism-monthly-context'
import { assessRetailScore } from '../../PAIR/EURUSD/USD/RETAIL/assessment/retail-score'
import { retailSeriesIds } from '../../PAIR/EURUSD/USD/RETAIL/policy/retail-policy'
import { assessClaimsScore } from '../../PAIR/EURUSD/USD/CLAIMS/assessment/claims-score'
import { claimsSeriesIds } from '../../PAIR/EURUSD/USD/CLAIMS/policy/claims-policy'
import { assessPceScore, pceSeriesIds } from '../../PAIR/EURUSD/USD/PCE/assessment/pce-score'
import { assessPpiScore } from '../../PAIR/EURUSD/USD/PPI/assessment/ppi-score'
import { ppiSeriesIds } from '../../PAIR/EURUSD/USD/PPI/policy/ppi-policy'
import { assessGdpScore } from '../../PAIR/EURUSD/USD/GDP/assessment/gdp-score'
import { gdpSeriesIds } from '../../PAIR/EURUSD/USD/GDP/policy/gdp-policy'
import type { ContextFamily, ContextSettings, FamilyAssessment } from './contracts'
import { cpiContextTraits, nfpContextTraits } from './interaction/source-traits'
import { sourceCoverage } from './source-coverage'
import type { ComboSource } from '../../relationships/contracts'
import { magnitudeEvidence } from '../../shared/core/magnitude-evidence'

export const contextSeriesIds: readonly string[] = [...cpiV3SeriesIds, ...nfpV2SeriesIds, ...ismSeriesIds, ...retailSeriesIds, ...claimsSeriesIds, ...pceSeriesIds, ...ppiSeriesIds, ...gdpSeriesIds, '840050014']
export const publicationFamily = (id: string): ContextFamily | null => id === 'jobs' ? 'nfp' : id === 'us-cpi' ? 'cpi' :
  id === 'ism-services' || id === 'ism-manufacturing' ? 'ism' : id === 'retail' ? 'retail' : id === 'claims' ? 'claims' : id === 'pce' ? 'pce' : id === 'ppi' ? 'ppi' : id === 'gdp' ? 'gdp' : null
export function scorePublication(release: InspectorRelease, events: readonly InspectorEvent[], settings: ContextSettings,
  onIsmSources?: (sources: ComboSource[]) => void): FamilyAssessment {
  const family = publicationFamily(release.familyId)!
  const score = family === 'pce' ? assessPceScore(release, events, settings.pce) : family === 'ppi' ? assessPpiScore(release, events, settings.ppi) : family === 'gdp' ? assessGdpScore(release, events, settings.gdp) : family === 'nfp' ? assessNfpScoreV2(release, events, settings.nfp) : family === 'cpi' ?
    assessCpiScoreV3(release, events, settings.cpi) : family === 'claims' ? assessClaimsScore(release, events, settings.claims) : family === 'retail' ? assessRetailScore(release, events, settings.retail) : assessIsmScoreV3(release, events,
      { services: settings.services, manufacturing: settings.manufacturing }, false)
  if (family === 'ism' && onIsmSources) {
    const ism = score as ReturnType<typeof assessIsmScoreV3>
    onIsmSources(ism ? [ism.manufacturing, ism.services].flatMap(sector => {
      const r = sector.release, a = sector.assessment
      const deciding = a?.total === 0 ? a.readings.find(row => row.points !== null && row.points !== 0)?.points ?? 0 : a?.total
      const direction = deciding == null || deciding === 0 ? 'uncomputed' : deciding > 0 ? 'short' : 'long'
      const evidence = a ? magnitudeEvidence(a.readings, direction, a.total === 0 && deciding !== 0) : null
      return sector.included && r && r.chartTime !== null && r.releaseAt !== null && a ? [{
        family: 'ism' as const, sourceId: r.id, sourceLabel: `ISM ${sector.sector === 'services' ? 'Services' : 'Manufacturing'}`,
        chartAt: r.chartTime * 1000, releaseAt: r.releaseAt, total: a.total,
        usdDirection: direction === 'short' ? 'stronger' as const : direction === 'long' ? 'weaker' as const : 'uncomputed' as const,
        strength: evidence?.strength === 'strong' || evidence?.strength === 'moderate' || evidence?.strength === 'weak' ? evidence.strength : null,
        role: `${sector.weight}% of the ISM sector budget`,
        contribution: sector.readings.reduce((sum, row) => sum + (row.contribution ?? 0), 0),
        sector: sector.sector, referenceMonth: ism.referenceMonth,
        assessment: { family: 'ism' as const, sourceId: r.id, sourceLabel: `ISM ${sector.sector}`, chartAt: r.chartTime * 1000,
          releaseAt: r.releaseAt, total: a.total, usdDirection: direction === 'short' ? 'stronger' as const : direction === 'long' ? 'weaker' as const : 'uncomputed' as const,
          strength: evidence?.strength === 'strong' || evidence?.strength === 'moderate' || evidence?.strength === 'weak' ? evidence.strength : null,
          reason: evidence!.strengthReason, explanation: evidence!.strengthReason, changeSize: evidence!.changeSize, reduced: evidence!.reduced, tie: a.total === 0 && deciding !== 0,
          coverage: sourceCoverage(a.readings), comparisonBasis: `${sector.sector}:${a.readings.filter(x => x.points !== null).map(x => `${x.id}:${x.weight}`).sort().join('|')}`,
          calibrationBasis: `ism-v3/${sector.sector}:${a.readings.filter(x => x.points !== null).map(x => `${x.id}:${x.limits?.join(',') ?? 'zero-only'}`).sort().join('|')}`,
          components: a.readings.map(x => ({ id: x.id, weight: x.weight, points: x.points, value: x.value, limits: x.limits })) },
      }] : []
    }) : [])
  }
  return { family, sourceId: release.id, sourceLabel: release.familyId === 'ism-services' ? 'ISM Services' :
    release.familyId === 'ism-manufacturing' ? 'ISM Manufacturing' : family === 'nfp' ? 'NFP' : family === 'claims' ? 'Jobless Claims' : family === 'retail' ? 'Retail Sales' : family === 'pce' ? 'PCE' : family === 'ppi' ? 'PPI' : family === 'gdp' ? 'GDP' : 'CPI',
    releaseAt: release.releaseAt!, chartAt: release.chartTime! * 1000, total: score?.total ?? null,
    usdDirection: score?.direction === 'short' ? 'stronger' : score?.direction === 'long' ? 'weaker' : 'uncomputed',
    strength: score?.strength === 'strong' || score?.strength === 'moderate' || score?.strength === 'weak' ? score.strength : null,
    reason: score?.strengthReason ?? 'No usable assessment.',
    explanation: score?.explanation ?? 'No usable assessment.', changeSize: score?.changeSize ?? null,
    reduced: score?.reduced ?? true, tie: !!score?.tieBreak, coverage: sourceCoverage(score?.readings),
    comparisonBasis: score ? `${'stage' in score ? score.stage : 'release'}:${score.readings.filter(r => r.points !== null).map(r => `${r.id}:${r.weight}`).sort().join('|')}` : '',
    calibrationBasis: score ? `${score.version}:${score.readings.filter(r => r.points !== null)
      .map(r => `${r.id}:${r.limits?.join(',') ?? 'zero-only'}`).sort().join('|')}` : '',
    components: score?.readings.map(r => ({ id: r.id, value: r.value, points: r.points,
      weight: family === 'ism' ? r.weight / 100 : r.weight, limits: r.limits })) ?? [],
    ...(family === 'cpi' ? { traits: cpiContextTraits(score as ReturnType<typeof assessCpiScoreV3>) } :
      family === 'nfp' ? { traits: nfpContextTraits(score as ReturnType<typeof assessNfpScoreV2>) } :
      family === 'claims' ? { traits: { kind: 'claims' as const, streak: 0, confirmed: false,
        trendAgreement: !!score && score.total !== null && score.total !== 0 &&
          score.readings.filter(r => r.id === 'initial-trend' || r.id === 'continuing-pressure')
            .every(r => r.points !== null && Math.sign(r.points) === Math.sign(score.total!)) } } : {}) }
}
