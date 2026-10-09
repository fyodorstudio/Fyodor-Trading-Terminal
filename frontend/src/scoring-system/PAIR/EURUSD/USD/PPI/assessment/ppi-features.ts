import type { InspectorRelease } from '../../../../../../inspector/inspector-data'
import { nativeNumber, releaseSignalContext, usableSignal, unavailableSignal, type TimedReading } from '../../../../../shared/core/historical-release-signals'
import { ppiSeriesIds, ppiSignals } from '../policy/ppi-policy'
export const supportsPpiScore = (r: InspectorRelease | null) => !!r && r.familyId === 'ppi' && r.country === 'US' && r.currency === 'USD'
const rules = ppiSeriesIds.map(id => ({ id, units: [1], multiplier: 0 }))
export function ppiFeatures(release: InspectorRelease, history: readonly TimedReading[]) {
  const { current, reasons, recent } = releaseSignalContext(release, history, rules, ppiSeriesIds)
  return Object.fromEntries(ppiSignals.map(signal => {
    const row = current.get(signal.seriesId), actual = nativeNumber(row)
    const revised = !!row && (row.revised_previous != null || row.revised_previous_raw_scaled_1e6 != null)
    const prior = nativeNumber(row, revised ? 'revised_previous' : 'previous')
    const monthly = signal.id.endsWith('pace'), preceding = monthly ? recent(signal.seriesId) : null
    const reason = actual === null ? reasons.get(signal.seriesId)! : revised && prior === null ? 'Supplied Revised Previous is invalid.' :
      monthly && !preceding ? 'Requires three consecutive earlier reference months.' : !monthly && prior === null ? 'Requires supplied Previous or Revised Previous.' : ''
    const baseline = monthly && preceding ? (revised ? [prior!, ...preceding.slice(1)] : preceding).reduce((a,b) => a+b,0)/3 : prior
    return [signal.id, reason || baseline === null ? unavailableSignal(reason || 'Comparison unavailable.') : usableSignal(actual! - baseline, {
      actual: actual!, baseline, actualLabel: signal.label, baselineLabel: monthly ? `Prior three-month mean${revised ? ' (nearest month revised)' : ''}` : revised ? 'Revised Previous' : 'Previous', unit: '%' })]
  }))
}
