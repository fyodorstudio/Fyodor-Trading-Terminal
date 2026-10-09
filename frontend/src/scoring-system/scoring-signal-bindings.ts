import { currentScorerLabels } from './shared/core/current-scoring-versions'
import { cpiV3Features, cpiV3Signals, cpiV3SeriesIds, supportsCpiV3 } from './PAIR/EURUSD/USD/CPI/assessment/cpi-score-v3'
import { nfpV2Features, nfpV2Signals, nfpV2SeriesIds, supportsNfpV2 } from './PAIR/EURUSD/USD/NFP/assessment/nfp-score-v2'
import { pceFeatures, pceSignals, pceSeriesIds, supportsPceScore } from './PAIR/EURUSD/USD/PCE/assessment/pce-score'
import { retailFeatures, supportsRetailScore } from './PAIR/EURUSD/USD/RETAIL/assessment/retail-features'
import { retailSignals, retailSeriesIds } from './PAIR/EURUSD/USD/RETAIL/policy/retail-policy'
import { claimsFeatures, supportsClaimsScore } from './PAIR/EURUSD/USD/CLAIMS/assessment/claims-features'
import { claimsSignals, claimsSeriesIds } from './PAIR/EURUSD/USD/CLAIMS/policy/claims-policy'
import { claimsStandaloneFeatures } from './PAIR/EURUSD/USD/CLAIMS/assessment/claims-standalone-features'
import { claimsWeightedSignals, type ClaimsHorizon } from './PAIR/EURUSD/USD/CLAIMS/policy/claims-standalone-policy'
import { claimsStandaloneMagnitude } from './PAIR/EURUSD/USD/CLAIMS/policy/claims-standalone-settings'
import { ismServicesFeatures, ismServicesSignals, ismServicesSeriesIds, supportsIsmServicesScore } from './PAIR/EURUSD/USD/ISM/sectors/services/ism-services-score'
import { ismManufacturingFeatures, ismManufacturingSignals, ismManufacturingSeriesIds, supportsIsmManufacturing } from './PAIR/EURUSD/USD/ISM/sectors/manufacturing/ism-manufacturing-score'
import { cpiSignalSettings, nfpSignalSettings, pceSignalSettings, ismServicesSignalSettings, ismManufacturingSignalSettings, retailSignalSettings, claimsSignalSettings } from './shared/core/signal-magnitude-settings'
import { gdpFeatures, gdpStage, supportsGdpScore } from './PAIR/EURUSD/USD/GDP/assessment/gdp-features'
import { gdpSignals, gdpSeriesIds } from './PAIR/EURUSD/USD/GDP/policy/gdp-policy'
import { ppiFeatures, supportsPpiScore } from './PAIR/EURUSD/USD/PPI/assessment/ppi-features'
import { ppiSignals, ppiSeriesIds } from './PAIR/EURUSD/USD/PPI/policy/ppi-policy'
import { gdpSignalSettings, ppiSignalSettings } from './shared/core/signal-magnitude-settings'
import type { MagnitudeSettingsStore } from '../inspector/magnitude/settings/magnitude-settings-store'
import { eurPolicy } from './PAIR/EURUSD/EUR/policy/eur-policies'
import { eurMagnitudeStores } from './PAIR/EURUSD/EUR/policy/eur-magnitude-settings'
import { eurFeatures } from './PAIR/EURUSD/EUR/assessment/eur-features'
import type { InspectorRelease } from '../inspector/inspector-data'
import type { HistoricalFeature, TimedReading } from './shared/core/historical-release-signals'

export type ScoringSignalBinding = {
  label: string; settings: MagnitudeSettingsStore; seriesIds: readonly string[]
  signals: readonly { id: string; label: string; description: string; unit: string; weight?: number }[]
  calibrationClass?: (release: InspectorRelease, history: readonly TimedReading[]) => string
  currency?: 'EUR' | 'USD'
  supports: (release: InspectorRelease | null) => boolean
  features: (release: InspectorRelease, history: readonly TimedReading[]) => Record<string, HistoricalFeature>
}
export function scoringSignalBinding(familyId: string, horizon: ClaimsHorizon = 'release'): ScoringSignalBinding | null {
  const eur = eurPolicy(familyId)
  if (eur) return { label: eur.label, currency: 'EUR', settings: eurMagnitudeStores[eur.family], seriesIds: eur.signals.map(s => s.seriesId),
    signals: eur.signals, supports: release => !!release && release.familyId === eur.family && release.country === eur.country && release.currency === 'EUR', features: eurFeatures }
  if (familyId === 'gdp') return { label: 'GDP v1', settings: gdpSignalSettings, seriesIds: gdpSeriesIds, signals: gdpSignals, supports: supportsGdpScore, features: gdpFeatures, calibrationClass: gdpStage }
  if (familyId === 'ppi') return { label: 'PPI v1', settings: ppiSignalSettings, seriesIds: ppiSeriesIds, signals: ppiSignals, supports: supportsPpiScore, features: ppiFeatures }
  if (familyId === 'claims') return { label: 'Claims v3', settings: claimsStandaloneMagnitude[horizon], seriesIds: claimsSeriesIds,
    signals: claimsWeightedSignals(horizon), supports: supportsClaimsScore, features: (release, history) => claimsStandaloneFeatures(release, history, horizon) }
  if (familyId === 'claims-v2') return {
    label: 'Jobless Claims v2', settings: claimsSignalSettings, seriesIds: claimsSeriesIds,
    signals: claimsSignals, supports: supportsClaimsScore, features: claimsFeatures,
  }
  if (familyId === 'us-cpi') return {
    label: currentScorerLabels.cpi, settings: cpiSignalSettings, seriesIds: cpiV3SeriesIds,
    signals: cpiV3Signals.map((signal) => ({ ...signal, unit: 'pp' })), supports: supportsCpiV3, features: cpiV3Features,
  }
  if (familyId === 'jobs') return {
    label: 'NFP v2', settings: nfpSignalSettings, seriesIds: nfpV2SeriesIds,
    signals: nfpV2Signals, supports: supportsNfpV2, features: (release, history) => nfpV2Features(release, history).features,
  }
  if (familyId === 'pce') return {
    label: 'PCE v1', settings: pceSignalSettings, seriesIds: pceSeriesIds,
    signals: pceSignals, supports: supportsPceScore, features: pceFeatures,
  }
  if (familyId === 'retail') return {
    label: 'Retail Sales v1', settings: retailSignalSettings, seriesIds: retailSeriesIds,
    signals: retailSignals, supports: supportsRetailScore, features: retailFeatures,
  }
  if (familyId === 'ism-services') return {
    label: 'ISM Services v3', settings: ismServicesSignalSettings, seriesIds: ismServicesSeriesIds,
    signals: ismServicesSignals, supports: supportsIsmServicesScore, features: ismServicesFeatures,
  }
  if (familyId === 'ism-manufacturing') return {
    label: 'ISM Manufacturing v3', settings: ismManufacturingSignalSettings, seriesIds: ismManufacturingSeriesIds,
    signals: ismManufacturingSignals, supports: supportsIsmManufacturing, features: ismManufacturingFeatures,
  }
  return null
}
