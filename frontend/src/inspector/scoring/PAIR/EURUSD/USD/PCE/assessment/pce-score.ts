import type { EconomicCalendarEvent } from '../../../../../../calendar-event'
import { groupInspectorReleases, type InspectorRelease } from '../../../../../../inspector-data'
import type { MagnitudeSettings } from '../../../../../../magnitude/settings/magnitude-settings-store'
import { calibrateHistoricalSignal, earlierSignalReadings, nativeNumber, releaseSignalContext,
  usableSignal, unavailableSignal, type TimedReading, type HistoricalFeature } from '../../../../../shared/core/historical-release-signals'
import { magnitudeEvidence } from '../../../../../shared/core/magnitude-evidence'

export const pceScoreVersion = 'pce-eurusd-inflation-change-v1'
export const pceSeriesIds = ['840010001', '840010002', '840010003', '840010004'] as const
const rules = pceSeriesIds.map((id) => ({ id, units: [1], multiplier: 0 }))
// Core gets 75% of the vote. Headline informs the assessment without being
// counted as a separate confirmation of the same monthly/annual horizon.
export const pceSignals = [
  { id: 'core-pace', label: 'Latest core pace', group: 'monthly-inflation', weight: 45, unit: 'pp',
    description: 'Actual Core PCE m/m minus the preceding three-month average, replacing the nearest prior actual with supplied Revised Previous when available.' },
  { id: 'core-annual', label: 'Annual core change', group: 'annual-inflation', weight: 30, unit: 'pp',
    description: 'Actual Core PCE y/y minus supplied Revised Previous when available, otherwise supplied Previous.' },
  { id: 'headline-pace', label: 'Latest headline pace', group: 'monthly-inflation', weight: 15, unit: 'pp',
    description: 'Actual Headline PCE m/m minus the preceding three-month average, replacing the nearest prior actual with supplied Revised Previous when available.' },
  { id: 'headline-annual', label: 'Annual headline change', group: 'annual-inflation', weight: 10, unit: 'pp',
    description: 'Actual Headline PCE y/y minus supplied Revised Previous when available, otherwise supplied Previous.' },
] as const
type SignalId = typeof pceSignals[number]['id']
type Features = Record<SignalId, HistoricalFeature>

export function supportsPceScore(release: InspectorRelease | null) {
  return !!release && release.familyId === 'pce' && release.currency === 'USD' && release.country === 'US'
}
export function pceFeatures(release: InspectorRelease, history: readonly TimedReading[]): Features {
  const { current, reasons, recent } = releaseSignalContext(release, history, rules, pceSeriesIds)
  function revision(id: string) {
    const row = current.get(id)
    const supplied = !!row && (row.revised_previous != null || row.revised_previous_raw_scaled_1e6 != null)
    const value = supplied ? nativeNumber(row, 'revised_previous') : null
    return { supplied, value, reason: supplied && value === null ? 'Supplied Revised Previous must be a finite native percentage reading.' : '' }
  }
  function pace(id: string, label: string) {
    const actual = nativeNumber(current.get(id)), preceding = recent(id)
    if (actual === null) return unavailableSignal(reasons.get(id)!)
    if (!preceding) return unavailableSignal('Requires usable actuals for the preceding three consecutive reference months.')
    const revised = revision(id)
    if (revised.reason) return unavailableSignal(revised.reason)
    const baseline = (revised.supplied ? [revised.value!, ...preceding.slice(1)] : preceding).reduce((sum, value) => sum + value, 0) / 3
    return usableSignal(actual - baseline, { actual, baseline, actualLabel: `Actual ${label} m/m`,
      baselineLabel: revised.supplied ? 'Prior three-month average (nearest month revised)' : 'Prior three-month average', unit: '%' })
  }
  function annual(id: string, label: string) {
    const actual = nativeNumber(current.get(id)), revised = revision(id)
    const baseline = revised.supplied ? revised.value : nativeNumber(current.get(id), 'previous')
    return actual === null || baseline === null ? unavailableSignal(reasons.get(id) || revised.reason || 'Actual and supplied Previous annual inflation are required.') :
      usableSignal(actual - baseline, { actual, baseline, actualLabel: `Actual ${label} y/y`,
        baselineLabel: `${revised.supplied ? 'Revised Previous' : 'Supplied Previous'} ${label} y/y`, unit: '%' })
  }
  return {
    'core-pace': pace('840010001', 'core PCE'), 'core-annual': annual('840010002', 'core PCE'),
    'headline-pace': pace('840010003', 'headline PCE'), 'headline-annual': annual('840010004', 'headline PCE'),
  }
}

export function assessPceScore(release: InspectorRelease | null, events: readonly EconomicCalendarEvent[], settings: MagnitudeSettings = {}) {
  if (!release || !supportsPceScore(release)) return null
  const history = earlierSignalReadings(release, events, pceSeriesIds)
  const past = groupInspectorReleases(history).filter(supportsPceScore).map((r) => pceFeatures(r, history))
  const current = pceFeatures(release, history)
  const readings = pceSignals.map((signal) => {
    const samples = past.map((features) => features[signal.id].value).filter((value): value is number => value !== null)
    const calibrated = calibrateHistoricalSignal(current[signal.id], samples, settings[signal.id])
    return { ...signal, ...calibrated, contribution: calibrated.points === null ? null : calibrated.points * signal.weight / 100 }
  })
  const usable = readings.filter((row) => row.points !== null)
  const hasCore = usable.some((row) => row.id === 'core-pace' || row.id === 'core-annual')
  const units = hasCore ? usable.reduce((sum, row) => sum + row.points! * row.weight, 0) : null
  const total = units === null ? null : units / 100
  const tieBreak = units === 0 ? usable.find((row) => row.points !== 0) ?? null : null
  const deciding = units === 0 ? tieBreak?.points ?? 0 : units
  const direction = deciding === null || deciding === 0 ? 'uncomputed' : deciding > 0 ? 'short' : 'long'
  const label = direction === 'short' ? 'EURUSD Short' : direction === 'long' ? 'EURUSD Long' : 'Uncomputed'
  const evidence = magnitudeEvidence(readings, direction, !!tieBreak)
  const driver = usable.filter((row) => Math.sign(row.contribution!) === Math.sign(deciding ?? 0))
    .sort((a, b) => Math.abs(b.contribution!) - Math.abs(a.contribution!))[0]
  const explanations = {
    'core-pace': current['core-pace'].value! < 0 ? 'The latest core PCE inflation pace is below its recent average.' : 'The latest core PCE inflation pace is above its recent average.',
    'core-annual': current['core-annual'].value! < 0 ? 'Annual core PCE inflation is slowing.' : 'Annual core PCE inflation is accelerating.',
    'headline-pace': current['headline-pace'].value! < 0 ? 'Headline PCE inflation is below its recent pace.' : 'Headline PCE inflation is above its recent pace.',
    'headline-annual': current['headline-annual'].value! < 0 ? 'Annual headline PCE inflation is slowing.' : 'Annual headline PCE inflation is accelerating.',
  }
  const explanation = !hasCore ? 'No usable core PCE component; headline alone cannot establish this bias.' :
    units === 0 ? tieBreak ? `Scores cancel; ${tieBreak.label.toLowerCase()} breaks the tie.` : 'Usable signals show no directional change.' :
      driver ? explanations[driver.id] : ''
  // Headline annual PCE is the Fed target measure. Its level describes policy
  // context but is not a new directional change or another weighted vote.
  const context = releaseSignalContext(release, history, rules, pceSeriesIds)
  const headlineAnnual = nativeNumber(context.current.get('840010004'))
  const targetContext = headlineAnnual === null ? 'Annual headline PCE is unavailable for target context.' :
    `Annual headline PCE is ${headlineAnnual > 2 ? 'above' : headlineAnnual < 2 ? 'below' : 'at'} the Fed’s 2% longer-run objective. Its level adds no directional vote.`
  return { readings, total, tieBreak, direction, label, explanation, targetContext, ...evidence, version: pceScoreVersion }
}
