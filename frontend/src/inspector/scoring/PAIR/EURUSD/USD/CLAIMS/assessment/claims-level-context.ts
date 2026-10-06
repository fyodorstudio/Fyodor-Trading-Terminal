import type { InspectorRelease } from '../../../../../../inspector-data'
import type { TimedReading } from '../../../../../shared/core/historical-release-signals'
import { claimsCurrentReadings } from './claims-features'
import { claimsCount, priorClaimsWeekValues } from './claims-weekly-history'

// Descriptive levels, not another vote or a universal healthy/unhealthy cutoff.
export function claimsLevelContext(release: InspectorRelease, history: readonly TimedReading[]) {
  const { current } = claimsCurrentReadings(release)
  return [['840140003', 'Smoothed initial claims'], ['840140002', 'Continuing claims']].map(([id, label]) => {
    const row = current.get(id), values = row ? priorClaimsWeekValues(history, row, 52) : []
    const earlier = values.filter((value): value is number => value !== null), sampleCount = earlier.length
    if (!row || sampleCount < 40) return { id, label, state: 'unavailable' as const, actual: null, lower: null, upper: null, sampleCount,
      explanation: `Requires at least 40 usable weeks within the preceding 52; found ${sampleCount}. Unavailable level context does not remove a usable trend vote.` }
    const sorted = [...earlier].sort((a, b) => a - b), lower = sorted[Math.ceil(sampleCount / 4) - 1],
      upper = sorted[Math.ceil(sampleCount * .75) - 1], actual = claimsCount(row)!
    const state = actual > upper ? 'elevated' as const : actual < lower ? 'low' as const : 'typical' as const
    return { id, label, state, actual, lower, upper, sampleCount, explanation: (state === 'elevated' ?
      'Higher than the usual range of available readings within its preceding 52 weeks; improvement does not necessarily mean low claims pressure.' :
      state === 'low' ? 'Lower than the usual range of available readings within its preceding 52 weeks.' :
        'Within the middle half of available readings within its preceding 52 weeks.') +
        (sampleCount < 52 ? ` Partial history: ${sampleCount} of 52 weeks usable; missing weeks are not filled or replaced with older weeks.` : '') }
  })
}
