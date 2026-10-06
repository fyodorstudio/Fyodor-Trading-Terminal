import type { EconomicCalendarEvent } from '../../../../../../../calendar-event'
import { groupInspectorReleases, type InspectorRelease } from '../../../../../../../inspector-data'
import type { MagnitudeSettings } from '../../../../../../../magnitude/settings/magnitude-settings-store'
import { calibrateHistoricalSignal, earlierSignalReadings, nativeNumber, releaseSignalContext } from '../../../../../../shared/core/historical-release-signals'
import { ismManufacturingFeatures, ismManufacturingSignals, ismManufacturingSeriesIds, supportsIsmManufacturing, rules, votingIds, isIndex } from './ism-manufacturing-features'
export { ismManufacturingFeatures, ismManufacturingSignals, ismManufacturingSeriesIds, supportsIsmManufacturing } from './ism-manufacturing-features'

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
