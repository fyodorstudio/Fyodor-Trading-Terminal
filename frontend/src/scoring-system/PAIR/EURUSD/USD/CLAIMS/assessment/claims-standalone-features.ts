import type { InspectorRelease } from '../../../../../../inspector/inspector-data'
import { observedReading, usableSignal, unavailableSignal, type HistoricalFeature, type TimedReading } from '../../../../../shared/core/historical-release-signals'
import { claimsStandaloneSignals, type ClaimsHorizon } from '../policy/claims-standalone-policy'
import { claimsCount, claimsReference, claimsWeekSeconds, validClaimsReference } from './claims-weekly-history'
import { claimsObservationAsOf, type ClaimsObservation } from './claims-revised-history'

export type ClaimsFeature = HistoricalFeature & { observations?: ClaimsObservation[] }
const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

export function claimsStandaloneFeatures(release: InspectorRelease, history: readonly TimedReading[], horizon: ClaimsHorizon): Record<string, ClaimsFeature> {
  const definitions = claimsStandaloneSignals[horizon], rows = new Map<string, TimedReading>(), reasons = new Map<string, string>()
  for (const signal of definitions) {
    const matches = release.events.filter(e => e.event_id === signal.seriesId), row = matches[0]
    const reason = release.timingUncertain || release.releaseAt === null || !Number.isFinite(release.releaseAt) ? 'Publication time is unavailable.' :
      matches.length !== 1 ? 'Requires one unambiguous reading.' : !observedReading(row) || row.release_at !== release.releaseAt ? 'Requires an observed US reading at this publication.' :
        claimsCount(row) === null ? 'Requires nonnegative claims in the expected native unit.' : !validClaimsReference(row) ? 'The weekly reference date is invalid.' : ''
    if (reason) reasons.set(signal.seriesId, reason)
    else rows.set(signal.seriesId, row as TimedReading)
  }
  const initial = rows.get(definitions[0].seriesId), continuing = rows.get('840140002')
  if (initial && continuing && claimsReference(continuing)! !== claimsReference(initial)! - claimsWeekSeconds) {
    rows.delete('840140002'); reasons.set('840140002', 'Continuing claims must refer to the week before initial claims.')
  }
  return Object.fromEntries(definitions.map((signal, index) => {
    const row = rows.get(signal.seriesId)
    if (!row) return [signal.id, unavailableSignal(reasons.get(signal.seriesId)!)]
    const reference = claimsReference(row)!, count = horizon === 'release' ? 1 : index === 0 ? 4 : 7
    const offsets = horizon === 'trend' && index === 0 ? [4] : Array.from({ length: count }, (_, i) => i + 1)
    const observations = offsets.map(offset => claimsObservationAsOf(history, row, reference - offset * claimsWeekSeconds))
    if (observations.some(o => o?.value == null)) return [signal.id, unavailableSignal('A comparison week is missing, ambiguous or invalid.')]
    const prior = observations.map(o => o!.value!), current = claimsCount(row)!
    const actual = horizon === 'trend' && index === 1 ? mean([current, ...prior.slice(0, 3)]) : current
    const baseline = horizon === 'trend' && index === 1 ? mean(prior.slice(3, 7)) : prior[0]
    return [signal.id, { ...usableSignal(baseline - actual, { actual, baseline,
      actualLabel: horizon === 'trend' ? 'Latest four-week period' : 'Current week',
      baselineLabel: horizon === 'trend' ? 'Preceding four-week period' : observations[0]!.kind === 'revision' ? 'Revised previous week' : 'Previous week', unit: 'k claims' }),
      observations: [{ value: current, publishedAt: row.release_at, reference, kind: 'actual' as const, sourceId: row.value_id }, ...observations as ClaimsObservation[]] }]
  }))
}
