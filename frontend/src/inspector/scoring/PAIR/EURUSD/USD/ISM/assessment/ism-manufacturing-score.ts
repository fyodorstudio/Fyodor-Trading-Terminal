import type { EconomicCalendarEvent } from '../../../../../../calendar-event'
import { groupInspectorReleases, type InspectorRelease } from '../../../../../../inspector-data'
import type { MagnitudeSettings } from '../../../../../../magnitude/settings/magnitude-settings-store'
import { calibrateHistoricalSignal, earlierSignalReadings, nativeNumber, releaseSignalContext,
  usableSignal, unavailableSignal, type TimedReading, type HistoricalFeature } from '../../../../../shared/core/historical-release-signals'

export const ismManufacturingSeriesIds = ['840040001', '840040002', '840040004', '840040006'] as const
const rules = ismManufacturingSeriesIds.map((id) => ({ id, units: [0], multiplier: 0 }))
export const ismManufacturingSignals = [
  { id: 'orders', seriesId: '840040006', label: 'New orders', group: 'demand', weight: 50, unit: 'pts',
    description: 'Actual Manufacturing New Orders minus max(50, preceding three-month mean); supplied Revised Previous replaces the nearest month.' },
  { id: 'employment', seriesId: '840040004', label: 'Employment', group: 'labor', weight: 35, unit: 'pts',
    description: 'Actual Manufacturing Employment minus max(50, preceding three-month mean); supplied Revised Previous replaces the nearest month.' },
  { id: 'prices', seriesId: '840040002', label: 'Prices paid', group: 'prices', weight: 15, unit: 'pts',
    description: 'Actual Manufacturing Prices Paid minus max(50, preceding three-month mean); supplied Revised Previous replaces the nearest month.' },
] as const
type SignalId = typeof ismManufacturingSignals[number]['id']
const votingIds = ismManufacturingSignals.map((signal) => signal.seriesId)
const isIndex = (value: number | null): value is number => value !== null && value >= 0 && value <= 100
export const supportsIsmManufacturing = (release: InspectorRelease | null) => !!release &&
  release.familyId === 'ism-manufacturing' && release.currency === 'USD' && release.country === 'US'
export function ismManufacturingFeatures(release: InspectorRelease, history: readonly TimedReading[]) {
  const { current, reasons, recent } = releaseSignalContext(release, history, rules, votingIds)
  return Object.fromEntries(ismManufacturingSignals.map(({ id, seriesId, label }) => {
    const row = current.get(seriesId), actual = nativeNumber(row), preceding = recent(seriesId)
    if (actual === null) return [id, unavailableSignal(reasons.get(seriesId)!)]
    if (!isIndex(actual)) return [id, unavailableSignal('Actual must be a native diffusion index between 0 and 100.')]
    if (!preceding) return [id, unavailableSignal('Requires usable actuals for the preceding three consecutive reference months.')]
    const revised = !!row && (row.revised_previous != null || row.revised_previous_raw_scaled_1e6 != null)
    const revisedValue = revised ? nativeNumber(row, 'revised_previous') : null
    if (revised && !isIndex(revisedValue)) return [id, unavailableSignal('Supplied Revised Previous must be a native diffusion index between 0 and 100.')]
    const values = revised ? [revisedValue!, ...preceding.slice(1)] : preceding
    if (!values.every(isIndex)) return [id, unavailableSignal('Prior comparison readings must be native diffusion indexes between 0 and 100.')]
    const baseline = Math.max(50, values.reduce((sum, value) => sum + value, 0) / 3)
    return [id, usableSignal(actual - baseline, { actual, baseline, actualLabel: `Actual Manufacturing ${label} index`,
      baselineLabel: `Higher of 50 and prior three-month average${revised ? ' (nearest month revised)' : ''}`, unit: 'pts' })]
  })) as Record<SignalId, HistoricalFeature>
}
export function assessIsmManufacturing(release: InspectorRelease | null, events: readonly EconomicCalendarEvent[], settings: MagnitudeSettings = {}) {
  if (!release || !supportsIsmManufacturing(release)) return null
  const history = earlierSignalReadings(release, events, ismManufacturingSeriesIds)
  const past = groupInspectorReleases(history).filter(supportsIsmManufacturing).map((r) => ismManufacturingFeatures(r, history))
  const current = ismManufacturingFeatures(release, history)
  const context = releaseSignalContext(release, history, rules, votingIds)
  const readings = ismManufacturingSignals.map((signal) => {
    const calibrated = calibrateHistoricalSignal(current[signal.id], past.map((features) => features[signal.id].value)
      .filter((value): value is number => value !== null), settings[signal.id])
    const actual = nativeNumber(context.current.get(signal.seriesId))
    const noun = signal.id === 'orders' ? 'Orders' : signal.id === 'prices' ? 'Input prices' : 'Employment'
    return { ...signal, ...calibrated, state: !isIndex(actual) ? 'Level unavailable' : `${noun} ${actual > 50 ? 'rising' : actual < 50 ? 'falling' : 'unchanged'}`,
      contribution: calibrated.points === null ? null : calibrated.points * signal.weight / 100 }
  })
  const hasDemand = readings[0].points !== null
  const total = hasDemand ? readings.reduce((sum, row) => sum + (row.points ?? 0) * row.weight, 0) / 100 : null
  const headline = nativeNumber(context.current.get('840040001'))
  const headlineContext = !isIndex(headline) ? 'Headline Manufacturing PMI is unavailable for context.' :
    `Headline Manufacturing PMI indicates ${headline > 50 ? 'expansion' : headline < 50 ? 'contraction' : 'no change'}. It adds no directional vote.`
  return { readings, total, headlineContext }
}
