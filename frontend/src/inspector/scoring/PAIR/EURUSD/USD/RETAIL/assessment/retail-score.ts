import type { EconomicCalendarEvent } from '../../../../../../calendar-event'
import { groupInspectorReleases, type InspectorRelease } from '../../../../../../inspector-data'
import type { MagnitudeSettings } from '../../../../../../magnitude/settings/magnitude-settings-store'
import { earlierSignalReadings, calibrateHistoricalSignal } from '../../../../../shared/core/historical-release-signals'
import { magnitudeEvidence } from '../../../../../shared/core/magnitude-evidence'
import { retailFeatures, retailSupportingContext, supportsRetailScore } from './retail-features'
import { retailScoreVersion, retailSeriesIds, retailSignals } from '../policy/retail-policy'

export function assessRetailScore(release: InspectorRelease | null, events: readonly EconomicCalendarEvent[], settings: MagnitudeSettings = {}) {
  if (!release || !supportsRetailScore(release)) return null
  const history = earlierSignalReadings(release, events, retailSeriesIds)
  const past = groupInspectorReleases(history).filter(supportsRetailScore).map(r => retailFeatures(r, history))
  const current = retailFeatures(release, history)
  const readings = retailSignals.map(signal => {
    const samples = past.map(features => features[signal.id].value).filter((n): n is number => n !== null)
    const calibrated = calibrateHistoricalSignal(current[signal.id], samples, settings[signal.id])
    return { ...signal, ...calibrated, contribution: calibrated.points === null ? null : calibrated.points * signal.weight / 100 }
  })
  const usable = readings.filter(row => row.points !== null)
  const hasUnderlying = usable.some(row => row.id === 'control-pace' || row.id === 'ex-autos-gas-pace')
  const units = hasUnderlying ? usable.reduce((sum, row) => sum + row.points! * row.weight, 0) : null
  const total = units === null ? null : units / 100
  const tieBreak = units === 0 ? usable.find(row => row.points !== 0) ?? null : null
  const deciding = units === 0 ? tieBreak?.points ?? 0 : units
  const direction = deciding === null || deciding === 0 ? 'uncomputed' : deciding > 0 ? 'short' : 'long'
  const label = direction === 'short' ? 'EURUSD Short' : direction === 'long' ? 'EURUSD Long' : 'Uncomputed'
  const driver = usable.filter(row => Math.sign(row.contribution!) === Math.sign(deciding ?? 0))
    .sort((a, b) => Math.abs(b.contribution!) - Math.abs(a.contribution!))[0]
  const explainDriver = () => {
    if (!driver) return ''
    const actual = driver.inputs!.actual
    const subject = driver.id === 'control-pace' ? 'Control-group sales' : driver.id === 'ex-autos-gas-pace' ? 'Sales excluding autos and gas' : 'Headline retail sales'
    const text = actual < 0 ? `${subject} fell; a smaller contraction still counts as falling sales.` :
      driver.value! < 0 ? `${subject} ${actual === 0 ? 'are flat' : 'are growing'}, but below their recent pace.` : `${subject} are above their recent pace.`
    return `${text} This is the largest contribution supporting the bias.`
  }
  const explanation = !hasUnderlying ? 'No usable control-group or ex-autos-and-gas component; headline alone cannot establish this bias.' :
    units === 0 ? tieBreak ? `Scores cancel; ${tieBreak.label.toLowerCase()} breaks the tie.` : 'Usable signals show no directional change.' : explainDriver()
  return { readings, total, tieBreak, direction, label, explanation, supporting: retailSupportingContext(release, history),
    ...magnitudeEvidence(readings, direction, !!tieBreak), version: retailScoreVersion }
}
export type RetailAssessment = NonNullable<ReturnType<typeof assessRetailScore>>
