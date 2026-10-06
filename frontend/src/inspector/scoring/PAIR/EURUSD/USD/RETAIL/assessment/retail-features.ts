import type { InspectorRelease } from '../../../../../../inspector-data'
import { nativeNumber, releaseSignalContext, usableSignal, unavailableSignal,
  type TimedReading, type HistoricalFeature } from '../../../../../shared/core/historical-release-signals'
import { retailSeriesIds, retailVotingIds, retailSignals, type RetailSignalId } from '../policy/retail-policy'

const rules = retailSeriesIds.map(id => ({ id, units: [1], multiplier: 0 }))
export const supportsRetailScore = (release: InspectorRelease | null) =>
  !!release && release.familyId === 'retail' && release.country === 'US' && release.currency === 'USD'

export function retailFeatures(release: InspectorRelease, history: readonly TimedReading[]): Record<RetailSignalId, HistoricalFeature> {
  const { current, reasons, recent } = releaseSignalContext(release, history, rules, retailVotingIds)
  const features = retailSignals.map(signal => {
    const row = current.get(signal.seriesId), actual = nativeNumber(row), preceding = recent(signal.seriesId)
    let feature: HistoricalFeature
    if (actual === null) feature = unavailableSignal(reasons.get(signal.seriesId)!)
    else if (!preceding) feature = unavailableSignal('Requires usable actuals for the preceding three consecutive reference months.')
    else {
      const supplied = !!row && (row.revised_previous != null || row.revised_previous_raw_scaled_1e6 != null)
      const revised = supplied ? nativeNumber(row, 'revised_previous') : null
      if (supplied && revised === null) feature = unavailableSignal('Supplied Revised Previous must be a finite native percentage reading.')
      else {
        const comparison = supplied ? [revised!, ...preceding.slice(1)] : preceding
        const baseline = Math.max(0, comparison.reduce((sum, n) => sum + n, 0) / 3)
        feature = usableSignal(actual - baseline, { actual, baseline, actualLabel: `Actual ${signal.label} m/m`,
          baselineLabel: supplied ? 'Prior three-month average (nearest month revised; floor 0)' : 'Prior three-month average (floor 0)', unit: '%' })
      }
    }
    return [signal.id, feature] as const
  })
  return Object.fromEntries(features) as Record<RetailSignalId, HistoricalFeature>
}

export function retailSupportingContext(release: InspectorRelease, history: readonly TimedReading[]) {
  const { current } = releaseSignalContext(release, history, rules, retailVotingIds)
  const describe = (id: string, label: string) => {
    const actual = nativeNumber(current.get(id))
    return { id, label, text: actual === null ? 'Unavailable.' : actual > 0 ? 'Nominal sales are growing.' : actual < 0 ? 'Nominal sales are falling.' : 'Nominal sales are flat.' }
  }
  const annual = current.get('840020025'), actual = nativeNumber(annual)
  const hasRevision = !!annual && (annual.revised_previous != null || annual.revised_previous_raw_scaled_1e6 != null)
  const baseline = nativeNumber(annual, hasRevision ? 'revised_previous' : 'previous')
  return [describe('840020012', 'Control group'), describe('840020021', 'Excluding autos and gas'),
    describe('840020010', 'Headline monthly'), { ...describe('840020011', 'Core retail (ex autos)'), text:
      `${describe('840020011', '').text} Composition context only; not another vote.` },
    { id: '840020025', label: 'Annual headline sales', text: actual === null ? 'Unavailable.' :
      `Nominal annual sales ${actual > 0 ? 'are growing' : actual < 0 ? 'are falling' : 'are flat'}${baseline === null ? '; prior comparison unavailable' :
        actual > baseline ? '; annual growth accelerated' : actual < baseline ? '; annual growth slowed' : '; annual growth is unchanged'}. Context only; not another vote.` }]
}
