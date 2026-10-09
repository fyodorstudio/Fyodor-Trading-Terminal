import { type InspectorRelease } from '../../../../../../../inspector/inspector-data'
import { nativeNumber, releaseSignalContext,
  usableSignal, unavailableSignal, type TimedReading, type HistoricalFeature } from '../../../../../../shared/core/historical-release-signals'

export const ismManufacturingSeriesIds = ['840040001', '840040002', '840040004', '840040006'] as const
export const rules = ismManufacturingSeriesIds.map((id) => ({ id, units: [0], multiplier: 0 }))
export const ismManufacturingSignals = [
  { id: 'orders', seriesId: '840040006', label: 'New orders', group: 'demand', weight: 50, unit: 'pts',
    description: 'Actual Manufacturing New Orders minus max(50, preceding three-month mean); supplied Revised Previous replaces the nearest month.' },
  { id: 'employment', seriesId: '840040004', label: 'Employment', group: 'labor', weight: 35, unit: 'pts',
    description: 'Actual Manufacturing Employment minus max(50, preceding three-month mean); supplied Revised Previous replaces the nearest month.' },
  { id: 'prices', seriesId: '840040002', label: 'Prices paid', group: 'prices', weight: 15, unit: 'pts',
    description: 'Actual Manufacturing Prices Paid minus max(50, preceding three-month mean); supplied Revised Previous replaces the nearest month.' },
] as const
export type SignalId = typeof ismManufacturingSignals[number]['id']
export const votingIds = ismManufacturingSignals.map((signal) => signal.seriesId)
export const isIndex = (value: number | null): value is number => value !== null && value >= 0 && value <= 100
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
