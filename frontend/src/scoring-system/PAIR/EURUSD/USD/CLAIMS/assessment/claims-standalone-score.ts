import type { EconomicCalendarEvent } from '../../../../../../inspector/calendar-event'
import type { InspectorRelease } from '../../../../../../inspector/inspector-data'
import type { MagnitudeSettings } from '../../../../../../inspector/magnitude/settings/magnitude-settings-store'
import { chronologicalFeatureHistory } from '../../../../../shared/core/chronological-feature-history'
import { calibrateHistoricalSignal, cleanSignal } from '../../../../../shared/core/historical-release-signals'
import { magnitudeEvidence } from '../../../../../shared/core/magnitude-evidence'
import { claimsSeriesIds } from '../policy/claims-policy'
import { claimsWeightedSignals, claimsStandaloneVersion, type ClaimsHorizon } from '../policy/claims-standalone-policy'
import { supportsClaimsScore } from './claims-features'
import { claimsStandaloneFeatures } from './claims-standalone-features'

const histories = {
  release: chronologicalFeatureHistory(claimsSeriesIds, supportsClaimsScore, (release, history) => claimsStandaloneFeatures(release, history, 'release')),
  trend: chronologicalFeatureHistory(claimsSeriesIds, supportsClaimsScore, (release, history) => claimsStandaloneFeatures(release, history, 'trend')),
}
export function assessClaimsStandalone(release: InspectorRelease | null, events: readonly EconomicCalendarEvent[], horizon: ClaimsHorizon,
  settings: MagnitudeSettings = {}, initialWeight?: number) {
  if (!supportsClaimsScore(release)) return null
  const { history, past } = histories[horizon](release!, events), features = claimsStandaloneFeatures(release!, history, horizon)
  const readings = claimsWeightedSignals(horizon, initialWeight).map(signal => {
    const calibrated = calibrateHistoricalSignal(features[signal.id], past.map(p => p[signal.id].value).filter((n): n is number => n !== null), settings[signal.id])
    return { ...signal, ...calibrated, observations: features[signal.id].observations ?? [],
      contribution: calibrated.points === null ? null : calibrated.points * signal.weight / 100 }
  })
  const usable = readings.filter(r => r.points !== null), total = usable.length ? cleanSignal(usable.reduce((sum, r) => sum + r.contribution!, 0)) : null
  const direction = total === null || total === 0 ? 'uncomputed' : total > 0 ? 'short' : 'long'
  const label = direction === 'short' ? 'EURUSD Short' : direction === 'long' ? 'EURUSD Long' : total === 0 ? 'No net bias' : 'Unavailable'
  const usdLabel = direction === 'short' ? 'USD strength bias' : direction === 'long' ? 'USD weakness bias' : total === 0 ? 'No net USD bias' : 'Unavailable'
  const evidence = magnitudeEvidence(readings, direction, false)
  const improving = usable.filter(r => r.points! > 0), worsening = usable.filter(r => r.points! < 0)
  const explanation = total === null ? 'Claims comparisons are unavailable.' : total === 0 ?
    usable.some(r => r.points !== 0) ? 'The weighted contributions cancel.' : 'The usable comparisons are unchanged.' :
    improving.length && worsening.length ? `${total > 0 ? 'Improving' : 'Deteriorating'} claims carry the larger weighted contribution.` :
      horizon === 'release' ? `The usable weekly readings ${total > 0 ? 'improved' : 'deteriorated'}.` : `The usable four-week trends ${total > 0 ? 'improved' : 'deteriorated'}.`
  return { readings, total, direction, label, usdLabel, explanation, horizon, version: claimsStandaloneVersion, tieBreak: null, ...evidence }
}
export type ClaimsStandaloneAssessment = NonNullable<ReturnType<typeof assessClaimsStandalone>>
