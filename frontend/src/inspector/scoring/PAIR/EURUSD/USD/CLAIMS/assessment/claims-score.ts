import type { EconomicCalendarEvent } from '../../../../../../calendar-event'
import { groupInspectorReleases, type InspectorRelease } from '../../../../../../inspector-data'
import type { MagnitudeSettings } from '../../../../../../magnitude/settings/magnitude-settings-store'
import { earlierSignalReadings, calibrateHistoricalSignal } from '../../../../../shared/core/historical-release-signals'
import { magnitudeEvidence } from '../../../../../shared/core/magnitude-evidence'
import { claimsFeatures, supportsClaimsScore } from './claims-features'
import { claimsScoreVersion, claimsSeriesIds, claimsSignals } from '../policy/claims-policy'

export function assessClaimsScore(release: InspectorRelease | null, events: readonly EconomicCalendarEvent[], settings: MagnitudeSettings = {}) {
  if (!release || !supportsClaimsScore(release)) return null
  const history = earlierSignalReadings(release, events, claimsSeriesIds)
  const past = groupInspectorReleases(history).filter(supportsClaimsScore).map(r => claimsFeatures(r, history))
  const current = claimsFeatures(release, history)
  const readings = claimsSignals.map(signal => {
    const samples = past.map(features => features[signal.id].value).filter((n): n is number => n !== null)
    const calibrated = calibrateHistoricalSignal(current[signal.id], samples, settings[signal.id])
    return { ...signal, ...calibrated, contribution: calibrated.points === null ? null : calibrated.points * signal.weight / 100 }
  })
  const usable = readings.filter(row => row.points !== null)
  const units = usable.length ? usable.reduce((sum, row) => sum + row.points! * row.weight, 0) : null
  const total = units === null ? null : units / 100
  const tieBreak = units === 0 ? usable.find(row => row.points !== 0) ?? null : null
  const deciding = units === 0 ? tieBreak?.points ?? 0 : units
  const direction = deciding === null || deciding === 0 ? 'uncomputed' : deciding > 0 ? 'short' : 'long'
  const label = direction === 'short' ? 'EURUSD Short' : direction === 'long' ? 'EURUSD Long' : 'Uncomputed'
  const driver = usable.filter(row => Math.sign(row.contribution!) === Math.sign(deciding ?? 0))
    .sort((a, b) => Math.abs(b.contribution!) - Math.abs(a.contribution!))[0]
  const explanation = units === null ? 'No calibrated claims component is usable; see the missing-data reasons.' :
    units === 0 ? tieBreak ? `Scores cancel; ${tieBreak.label.toLowerCase()} breaks the tie.` : 'Usable signals show no directional change.' :
      `${driver!.label} are ${driver!.value! > 0 ? 'below' : 'above'} their recent four-week comparison. ${driver!.value! > 0 ? 'Less' : 'More'} claims pressure is the largest contribution ${driver!.value! > 0 ? 'supporting' : 'weighing on'} USD.`
  return { readings, total, tieBreak, direction, label, explanation,
    ...magnitudeEvidence(readings, direction, !!tieBreak), version: claimsScoreVersion }
}
export type ClaimsAssessment = NonNullable<ReturnType<typeof assessClaimsScore>>
