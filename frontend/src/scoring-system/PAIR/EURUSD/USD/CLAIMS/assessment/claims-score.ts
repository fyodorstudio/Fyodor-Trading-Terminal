import type { EconomicCalendarEvent } from '../../../../../../inspector/calendar-event'
import type { InspectorRelease } from '../../../../../../inspector/inspector-data'
import type { MagnitudeSettings } from '../../../../../../inspector/magnitude/settings/magnitude-settings-store'
import { calibrateHistoricalSignal } from '../../../../../shared/core/historical-release-signals'
import { chronologicalFeatureHistory } from '../../../../../shared/core/chronological-feature-history'
import { magnitudeEvidence } from '../../../../../shared/core/magnitude-evidence'
import { claimsFeatures, supportsClaimsScore } from './claims-features'
import { claimsLevelContext } from './claims-level-context'
import { claimsRevisionContext } from './claims-revision-context'
import { claimsScoreVersion, claimsSeriesIds, claimsSignals } from '../policy/claims-policy'

const featureHistory = chronologicalFeatureHistory(claimsSeriesIds, supportsClaimsScore, claimsFeatures)

export function assessClaimsScore(release: InspectorRelease | null, events: readonly EconomicCalendarEvent[], settings: MagnitudeSettings = {}) {
  if (!release || !supportsClaimsScore(release)) return null
  const { history, past } = featureHistory(release, events)
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
      `${driver!.label} ${driver!.value! > 0 ? 'eased' : 'increased'} against their ${driver!.id === 'initial-week' ? 'recent weekly' : 'previous four-week'} comparison; this is the largest ${driver!.value! > 0 ? 'USD-supportive' : 'USD-adverse'} contribution.`
  const trend = readings[0], continuing = readings[1], weekly = readings[2]
  const shape = trend.points === null || continuing.points === null ? 'Some underlying claims trends are unavailable.' :
    trend.value! < 0 && continuing.value! < 0 ? 'Both underlying claims trends show increasing pressure.' :
    trend.value! > 0 && continuing.value! > 0 ? 'Both underlying claims trends show easing pressure.' :
    trend.value! > 0 && continuing.value! < 0 ? 'New claims eased, while continuing claims pressure increased.' :
    trend.value! < 0 && continuing.value! > 0 ? 'New claims pressure increased, while continuing claims eased.' :
    trend.value === 0 && continuing.value === 0 ? weekly.points !== null && weekly.value !== 0 ?
      'The latest week moved, while both underlying trends were unchanged.' : 'Both underlying claims trends were unchanged.' :
    'One underlying trend changed while the other was unchanged.'
  const levels = claimsLevelContext(release, history)
  const cautions = weekly.points !== null && weekly.points !== 0 && trend.points === 0 && continuing.points === 0 ?
    ['Only the latest week changed; sustained deterioration or improvement is not confirmed.'] : []
  const evidence = magnitudeEvidence(readings, direction, !!tieBreak, cautions)
  return { readings, levels, revisions: claimsRevisionContext(release, history), shape, total, tieBreak, direction, label,
    explanation: `${shape} ${explanation}${levels.some(level => level.state === 'elevated') ? ' Some claims levels remain elevated relative to their own preceding year.' : ''}`,
    ...evidence, ...(cautions.length && direction !== 'uncomputed' ? { strength: 'weak' as const } : {}), version: claimsScoreVersion }
}
export type ClaimsAssessment = NonNullable<ReturnType<typeof assessClaimsScore>>
