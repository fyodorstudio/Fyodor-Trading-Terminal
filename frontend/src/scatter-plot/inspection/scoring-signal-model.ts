import { scatterNumber as number } from './scatter-number-format'
import type { EconomicCalendarEvent } from '../../inspector/calendar-event'
import { groupInspectorReleases, type InspectorRelease } from '../../inspector/inspector-data'
import { calibrateHistoricalSignal, observedReading, type HistoricalFeature, type TimedReading } from '../../scoring-system/shared/core/historical-release-signals'
import { magnitudeDistribution } from '../../inspector/magnitude/magnitude-distribution'
import type { ScatterModel, ScatterPoint, ScatterSignal } from '../contracts/scatter-plot-types'
import { eurPolicy } from '../../scoring-system/PAIR/EURUSD/EUR/policy/eur-policies'
import { observedEur, earlierEurSignalReleases } from '../../scoring-system/PAIR/EURUSD/EUR/assessment/eur-history'
import type { MagnitudeSettings } from '../../inspector/magnitude/settings/magnitude-settings-store'
import { type ScoringSignalBinding } from '../../scoring-system/scoring-signal-bindings'
export { scoringSignalBinding, type ScoringSignalBinding } from '../../scoring-system/scoring-signal-bindings'

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
