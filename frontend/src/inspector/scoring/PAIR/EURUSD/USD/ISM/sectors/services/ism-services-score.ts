import type { EconomicCalendarEvent } from '../../../../../../../calendar-event'
import { groupInspectorReleases, type InspectorRelease } from '../../../../../../../inspector-data'
import type { MagnitudeSettings } from '../../../../../../../magnitude/settings/magnitude-settings-store'
import { calibrateHistoricalSignal, earlierSignalReadings, nativeNumber, releaseSignalContext } from '../../../../../../shared/core/historical-release-signals'
import { magnitudeEvidence } from '../../../../../../shared/core/magnitude-evidence'
import { ismServicesFeatures, ismServicesSignals, ismServicesSeriesIds, supportsIsmServicesScore, rules, votingIds, isIndex, ismServicesScoreVersion, type SignalId } from './ism-services-features'
export { ismServicesFeatures, ismServicesSignals, ismServicesSeriesIds, supportsIsmServicesScore, ismServicesScoreVersion } from './ism-services-features'

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
