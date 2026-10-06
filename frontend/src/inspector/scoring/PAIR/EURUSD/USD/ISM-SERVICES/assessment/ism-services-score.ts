import type { EconomicCalendarEvent } from '../../../../../../calendar-event'
import { groupInspectorReleases, type InspectorRelease } from '../../../../../../inspector-data'
import type { MagnitudeSettings } from '../../../../../../magnitude/settings/magnitude-settings-store'
import { calibrateHistoricalSignal, earlierSignalReadings, nativeNumber, releaseSignalContext,
  usableSignal, unavailableSignal, type TimedReading, type HistoricalFeature } from '../../../../../shared/core/historical-release-signals'
import { magnitudeEvidence } from '../../../../../shared/core/magnitude-evidence'

export const ismServicesScoreVersion = 'ism-services-eurusd-activity-change-v1'
export const ismServicesSeriesIds = ['840040003', '840040005', '840040007', '840040008', '840040009'] as const
const rules = ismServicesSeriesIds.map((id) => ({ id, units: [0], multiplier: 0 }))
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
type SignalId = typeof ismServicesSignals[number]['id']
type Features = Record<SignalId, HistoricalFeature>
const votingIds = ismServicesSignals.map((signal) => signal.seriesId)
const isIndex = (value: number | null): value is number => value !== null && value >= 0 && value <= 100

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

const state = (id: SignalId, actual: number | null) => {
  if (!isIndex(actual)) return 'Level unavailable'
  const nouns = { orders: 'Orders', activity: 'Activity', employment: 'Employment', prices: 'Input prices' }
  return `${nouns[id]} ${actual > 50 ? 'rising' : actual < 50 ? 'falling' : 'unchanged'}`
}
export function assessIsmServicesScore(release: InspectorRelease | null, events: readonly EconomicCalendarEvent[], settings: MagnitudeSettings = {}) {
  if (!release || !supportsIsmServicesScore(release)) return null
  const history = earlierSignalReadings(release, events, ismServicesSeriesIds)
  const past = groupInspectorReleases(history).filter(supportsIsmServicesScore).map((r) => ismServicesFeatures(r, history))
  const current = ismServicesFeatures(release, history)
  const context = releaseSignalContext(release, history, rules, votingIds)
  const readings = ismServicesSignals.map((signal) => {
    const samples = past.map((features) => features[signal.id].value).filter((value): value is number => value !== null)
    const calibrated = calibrateHistoricalSignal(current[signal.id], samples, settings[signal.id])
    return { ...signal, ...calibrated, state: state(signal.id, nativeNumber(context.current.get(signal.seriesId))),
      contribution: calibrated.points === null ? null : calibrated.points * signal.weight / 100 }
  })
  const usable = readings.filter((row) => row.points !== null)
  const hasDemand = usable.some((row) => row.id === 'orders' || row.id === 'activity')
  const units = hasDemand ? usable.reduce((sum, row) => sum + row.points! * row.weight, 0) : null
  const total = units === null ? null : units / 100
  const tieBreak = units === 0 ? usable.find((row) => row.points !== 0) ?? null : null
  const deciding = units === 0 ? tieBreak?.points ?? 0 : units
  const direction = deciding === null || deciding === 0 ? 'uncomputed' : deciding > 0 ? 'short' : 'long'
  const label = direction === 'short' ? 'EURUSD Short' : direction === 'long' ? 'EURUSD Long' : 'Uncomputed'
  const evidence = magnitudeEvidence(readings, direction, !!tieBreak)
  const driver = usable.filter((row) => Math.sign(row.contribution!) === Math.sign(deciding ?? 0))
    .sort((a, b) => Math.abs(b.contribution!) - Math.abs(a.contribution!))[0]
  const subjects = { orders: 'New orders are', activity: 'Business activity is', employment: 'Employment is', prices: 'Input prices are' }
  const explanation = !hasDemand ? 'No usable demand component; employment and prices alone cannot establish this bias.' :
    units === 0 ? tieBreak ? `Scores cancel; ${tieBreak.label.toLowerCase()} breaks the tie.` : 'Usable signals show no directional change.' :
      driver ? driver.inputs!.actual < 50 ? `${subjects[driver.id]} falling (below 50); a rebound within decline still counts as adverse.` :
        driver.value! < 0 ? `${subjects[driver.id]} below the recent pace${driver.inputs!.actual > 50 ? ', while still rising' : ''}.` :
          `${subjects[driver.id]} rising above the comparison pace.` : ''
  const headline = nativeNumber(context.current.get('840040003'))
  const headlineContext = !isIndex(headline) ? 'Headline Services PMI is unavailable for context.' :
    `Headline Services PMI indicates ${headline > 50 ? 'expansion' : headline < 50 ? 'contraction' : 'no change'}. It adds no directional vote.`
  return { readings, total, tieBreak, direction, label, explanation, headlineContext, ...evidence, version: ismServicesScoreVersion }
}
