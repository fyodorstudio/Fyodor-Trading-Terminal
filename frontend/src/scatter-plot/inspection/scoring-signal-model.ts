import { currentScorerLabels } from '../../inspector/scoring/shared/core/current-scoring-versions'
import { scatterNumber as number } from './scatter-number-format'
import type { EconomicCalendarEvent } from '../../inspector/calendar-event'
import { groupInspectorReleases, type InspectorRelease } from '../../inspector/inspector-data'
import { cpiV3Features, cpiV3Signals, cpiV3SeriesIds, supportsCpiV3 } from '../../inspector/scoring/PAIR/EURUSD/USD/CPI/assessment/cpi-score-v3'
import { nfpV2Features, nfpV2Signals, nfpV2SeriesIds, supportsNfpV2 } from '../../inspector/scoring/PAIR/EURUSD/USD/NFP/assessment/nfp-score-v2'
import { pceFeatures, pceSignals, pceSeriesIds, supportsPceScore } from '../../inspector/scoring/PAIR/EURUSD/USD/PCE/assessment/pce-score'
import { retailFeatures, supportsRetailScore } from '../../inspector/scoring/PAIR/EURUSD/USD/RETAIL/assessment/retail-features'
import { retailSignals, retailSeriesIds } from '../../inspector/scoring/PAIR/EURUSD/USD/RETAIL/policy/retail-policy'
import { claimsFeatures, supportsClaimsScore } from '../../inspector/scoring/PAIR/EURUSD/USD/CLAIMS/assessment/claims-features'
import { claimsSignals, claimsSeriesIds } from '../../inspector/scoring/PAIR/EURUSD/USD/CLAIMS/policy/claims-policy'
import { ismServicesFeatures, ismServicesSignals, ismServicesSeriesIds, supportsIsmServicesScore } from '../../inspector/scoring/PAIR/EURUSD/USD/ISM/sectors/services/ism-services-score'
import { ismManufacturingFeatures, ismManufacturingSignals, ismManufacturingSeriesIds, supportsIsmManufacturing } from '../../inspector/scoring/PAIR/EURUSD/USD/ISM/sectors/manufacturing/ism-manufacturing-score'
import { calibrateHistoricalSignal, observedReading, type HistoricalFeature, type TimedReading } from '../../inspector/scoring/shared/core/historical-release-signals'
import { cpiSignalSettings, nfpSignalSettings, pceSignalSettings, ismServicesSignalSettings, ismManufacturingSignalSettings, retailSignalSettings, claimsSignalSettings } from '../../inspector/scoring/shared/core/signal-magnitude-settings'
import { gdpFeatures, gdpStage, supportsGdpScore } from '../../inspector/scoring/PAIR/EURUSD/USD/GDP/assessment/gdp-features'
import { gdpSignals, gdpSeriesIds } from '../../inspector/scoring/PAIR/EURUSD/USD/GDP/policy/gdp-policy'
import { ppiFeatures, supportsPpiScore } from '../../inspector/scoring/PAIR/EURUSD/USD/PPI/assessment/ppi-features'
import { ppiSignals, ppiSeriesIds } from '../../inspector/scoring/PAIR/EURUSD/USD/PPI/policy/ppi-policy'
import { gdpSignalSettings, ppiSignalSettings } from '../../inspector/scoring/shared/core/signal-magnitude-settings'
import { magnitudeDistribution } from '../../inspector/magnitude/magnitude-distribution'
import type { MagnitudeSettings, MagnitudeSettingsStore } from '../../inspector/magnitude/settings/magnitude-settings-store'
import type { ScatterModel, ScatterPoint, ScatterSignal } from '../contracts/scatter-plot-types'
import { eurPolicy } from '../../inspector/scoring/PAIR/EURUSD/EUR/policy/eur-policies'
import { eurMagnitudeStores } from '../../inspector/scoring/PAIR/EURUSD/EUR/policy/eur-magnitude-settings'
import { eurFeatures } from '../../inspector/scoring/PAIR/EURUSD/EUR/assessment/eur-features'
import { observedEur, earlierEurSignalReleases } from '../../inspector/scoring/PAIR/EURUSD/EUR/assessment/eur-history'

export type ScoringSignalBinding = {
  label: string; settings: MagnitudeSettingsStore; seriesIds: readonly string[]
  signals: readonly { id: string; label: string; description: string; unit: string }[]
  calibrationClass?: (release: InspectorRelease, history: readonly TimedReading[]) => string
  currency?: 'EUR' | 'USD'
  supports: (release: InspectorRelease | null) => boolean
  features: (release: InspectorRelease, history: readonly TimedReading[]) => Record<string, HistoricalFeature>
}
export function scoringSignalBinding(familyId: string): ScoringSignalBinding | null {
  const eur = eurPolicy(familyId)
  if (eur) return { label: eur.label, currency: 'EUR', settings: eurMagnitudeStores[eur.family], seriesIds: eur.signals.map(s => s.seriesId),
    signals: eur.signals, supports: release => !!release && release.familyId === eur.family && release.country === eur.country && release.currency === 'EUR', features: eurFeatures }
  if (familyId === 'gdp') return { label: 'GDP v1', settings: gdpSignalSettings, seriesIds: gdpSeriesIds, signals: gdpSignals, supports: supportsGdpScore, features: gdpFeatures, calibrationClass: gdpStage }
  if (familyId === 'ppi') return { label: 'PPI v1', settings: ppiSignalSettings, seriesIds: ppiSeriesIds, signals: ppiSignals, supports: supportsPpiScore, features: ppiFeatures }
  if (familyId === 'claims') return {
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
export type SignalHistory = { release: InspectorRelease; features: Record<string, HistoricalFeature>; calibrationClass?: string }[]
// Cache derivation independently of chart selection and boundary edits. Each
// extractor itself admits only publications preceding its own release.
export function prepareScoringSignalHistory(events: readonly EconomicCalendarEvent[], now: number, binding: ScoringSignalBinding): SignalHistory {
  const seen = new Set<string>()
  const history = events.filter((e): e is TimedReading => {
    if (!(binding.currency === 'EUR' ? observedEur(e) : observedReading(e)) || e.release_at! > now || !binding.seriesIds.includes(e.event_id) || seen.has(e.value_id)) return false
    seen.add(e.value_id); return true
  })
  // Keep observed family releases with missing scoring rows inspectable.
  const releases = groupInspectorReleases(events.filter((e) => (binding.currency === 'EUR' ? observedEur(e) : observedReading(e)) && e.release_at! <= now))
    .filter(binding.supports).sort((a, b) => a.releaseAt! - b.releaseAt!)
  return releases.map((release) => ({ release, features: binding.features(release, history), ...(binding.calibrationClass ? { calibrationClass: binding.calibrationClass(release, history) } : {}) }))
}
export function scoringSignalModel(history: SignalHistory, binding: ScoringSignalBinding, signalId: string,
  selectedReleaseId: string | null, settings: MagnitudeSettings = {}): ScatterModel {
  const definition = binding.signals.find((signal) => signal.id === signalId)!
  const selected = selectedReleaseId ? history.find((entry) => entry.release.id === selectedReleaseId) :
    history.findLast((entry) => entry.features[signalId]?.value !== null)
  const formatDelta = (value: number | null, digits = 6) => value === null ? '—' : `${number(value, digits, true)} ${definition.unit}`
  const formatReading = (value: number | null) => value === null ? '—' : `${number(value)} ${selected?.features[signalId]?.inputs?.unit ?? definition.unit}`
  const base = { measure: 'signal' as const, axisLabel: 'Scoring signal', description: `${binding.label}${selected?.calibrationClass ? ` · ${selected.calibrationClass}` : ''} · ${definition.description}`,
    deltaUnit: definition.unit, formatDelta, formatReading }
  const samplesByRelease = new Map<string, number[]>()
  const entriesById = new Map(history.map(entry => [entry.release.id, entry]))
  const calibrated = history.map((entry): ScatterSignal => {
    let comparable = history.filter((past) => past.release.releaseAt! < entry.release.releaseAt! && past.calibrationClass === entry.calibrationClass)
    if (binding.currency === 'EUR') {
      const policy = eurPolicy(entry.release.familyId)!, signal = policy.signals.find(s => s.id === signalId)!
      comparable = earlierEurSignalReleases(comparable.map(past => past.release), policy, signal, entry.release)
        .map(release => entriesById.get(release.id)!)
    }
    const earlier = comparable
      .map((past) => past.features[signalId].value).filter((value): value is number => value !== null)
    samplesByRelease.set(entry.release.id, earlier)
    return { ...calibrateHistoricalSignal(entry.features[signalId], earlier, settings[signalId]), description: definition.description }
  })
  let previousPosition = -1
  const points = history.flatMap((entry, index): ScatterPoint[] => {
    const signal = calibrated[index]
    if (signal.value === null) return []
    const point: ScatterPoint = {
      id: `${entry.release.id}/${signalId}`, releaseId: entry.release.id, at: entry.release.releaseAt!, delta: signal.value,
      actual: signal.inputs!.actual, previous: signal.inputs!.baseline, signal,
      tone: signal.value > 0 ? 'higher' : signal.value < 0 ? 'lower' : 'unchanged',
      breakBefore: previousPosition >= 0 && index !== previousPosition + 1,
    }
    previousPosition = index; return [point]
  })
  if (!selected) return { ...base, points, inspection: null }
  const signal = calibrated[history.indexOf(selected)]
  const sameClass = new Set(history.filter(entry => entry.calibrationClass === selected.calibrationClass).map(entry => entry.release.id))
  const earlier = points.filter((point) => point.at < selected.release.releaseAt! && sameClass.has(point.releaseId))
  // Guide bands belong to the inspected release, not to later chart context.
  const distribution = signal.limits ? magnitudeDistribution(binding.currency === 'EUR' ? samplesByRelease.get(selected.release.id)! : earlier.map((point) => point.delta), signal.value, signal.limits, signal.magnitudeMode === 'automatic') : null
  return { ...base, points, inspection: {
    releaseId: selected.release.id, at: selected.release.releaseAt!, point: points.find((point) => point.releaseId === selected.release.id) ?? null,
    actual: signal.inputs?.actual ?? null, previous: signal.inputs?.baseline ?? null, delta: signal.value, signal,
    magnitudeMode: signal.magnitudeMode, distribution, samples: points,
    earlierCount: signal.sampleCount, excluded: history.length - points.length,
  } }
}
