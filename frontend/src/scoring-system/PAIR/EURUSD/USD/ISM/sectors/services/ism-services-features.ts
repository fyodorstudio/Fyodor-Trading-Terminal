import { type InspectorRelease } from '../../../../../../../inspector/inspector-data'
import { nativeNumber, releaseSignalContext,
  usableSignal, unavailableSignal, type TimedReading, type HistoricalFeature } from '../../../../../../shared/core/historical-release-signals'

export const ismServicesScoreVersion = 'ism-services-eurusd-activity-change-v1'
export const ismServicesSeriesIds = ['840040003', '840040005', '840040007', '840040008', '840040009'] as const
export const rules = ismServicesSeriesIds.map((id) => ({ id, units: [0], multiplier: 0 }))
// The composite is context only: its constituents must not receive a second vote.
export const ismServicesSignals = [
  { id: 'orders', seriesId: '840040007', label: 'New orders', group: 'demand', weight: 35, unit: 'pts',
    description: 'Actual New Orders index minus the higher of 50 and its preceding three-month average; supplied Revised Previous replaces the nearest prior month.' },
  { id: 'activity', seriesId: '840040009', label: 'Business activity', group: 'demand', weight: 25, unit: 'pts',
    description: 'Actual Business Activity index minus the higher of 50 and its preceding three-month average; supplied Revised Previous replaces the nearest prior month.' },
  { id: 'employment', seriesId: '840040005', label: 'Employment', group: 'labor', weight: 25, unit: 'pts',
    description: 'Actual Employment index minus the higher of 50 and its preceding three-month average; supplied Revised Previous replaces the nearest prior month.' },
  { id: 'prices', seriesId: '840040008', label: 'Prices paid', group: 'prices', weight: 15, unit: 'pts',
    description: 'Actual Prices Paid index minus the higher of 50 and its preceding three-month average; supplied Revised Previous replaces the nearest prior month.' },
] as const
export type SignalId = typeof ismServicesSignals[number]['id']
type Features = Record<SignalId, HistoricalFeature>
export const votingIds = ismServicesSignals.map((signal) => signal.seriesId)
export const isIndex = (value: number | null): value is number => value !== null && value >= 0 && value <= 100

export function supportsIsmServicesScore(release: InspectorRelease | null) {
  return !!release && release.familyId === 'ism-services' && release.currency === 'USD' && release.country === 'US'
}
export function ismServicesFeatures(release: InspectorRelease, history: readonly TimedReading[]): Features {
  const { current, reasons, recent } = releaseSignalContext(release, history, rules, votingIds)
  const features = ismServicesSignals.map(({ id, seriesId, label }) => {
    const row = current.get(seriesId), actual = nativeNumber(row), preceding = recent(seriesId)
    if (actual === null) return [id, unavailableSignal(reasons.get(seriesId)!)] as const
    if (!isIndex(actual)) return [id, unavailableSignal('Actual must be a native diffusion index between 0 and 100.')] as const
    if (!preceding) return [id, unavailableSignal('Requires usable actuals for the preceding three consecutive reference months.')] as const
    const revised = !!row && (row.revised_previous != null || row.revised_previous_raw_scaled_1e6 != null)
    const revisedValue = revised ? nativeNumber(row, 'revised_previous') : null
    if (revised && !isIndex(revisedValue)) return [id, unavailableSignal('Supplied Revised Previous must be a native diffusion index between 0 and 100.')] as const
    const values = revised ? [revisedValue!, ...preceding.slice(1)] : preceding
    if (!values.every(isIndex)) return [id, unavailableSignal('Prior comparison readings must be native diffusion indexes between 0 and 100.')] as const
    // A rebound within contraction remains adverse. This floor is an explicit
    // interpretation policy, not an official ISM formula or fitted coefficient.
    const baseline = Math.max(50, values.reduce((sum, value) => sum + value, 0) / 3)
    return [id, usableSignal(actual - baseline, { actual, baseline, actualLabel: `Actual ${label} index`,
      baselineLabel: `Higher of 50 and prior three-month average${revised ? ' (nearest month revised)' : ''}`, unit: 'pts' })] as const
  })
  return Object.fromEntries(features) as Features
}

