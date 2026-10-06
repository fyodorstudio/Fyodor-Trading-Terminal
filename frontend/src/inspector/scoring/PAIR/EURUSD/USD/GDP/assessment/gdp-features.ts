import type { EconomicCalendarEvent } from '../../../../../../calendar-event'
import type { InspectorRelease } from '../../../../../../inspector-data'
import { nativeNumber, observedReading, usableSignal, unavailableSignal, type TimedReading } from '../../../../../shared/core/historical-release-signals'
import { gdpSignals } from '../policy/gdp-policy'
export const supportsGdpScore = (r: InspectorRelease | null) => !!r && r.familyId === 'gdp' && r.country === 'US' && r.currency === 'USD'
export function referenceQuarter(e: EconomicCalendarEvent | undefined) {
  if (!e || !Number.isFinite(e.period_seconds) || e.period_seconds <= 0) return null
  const date = new Date(e.period_seconds * 1000)
  return Number.isFinite(date.getTime()) ? date.getUTCFullYear() * 4 + Math.floor(date.getUTCMonth() / 3) : null
}
const valid = (e: EconomicCalendarEvent, at: number) => observedReading(e) && e.release_at <= at && e.unit === 1 && e.multiplier === 0 && nativeNumber(e) !== null &&
  referenceQuarter(e) !== null && referenceQuarter(e)! < new Date(e.release_at).getUTCFullYear() * 4 + Math.floor(new Date(e.release_at).getUTCMonth() / 3)
function latestRows(history: readonly TimedReading[], id: string, quarter: number, at: number) {
  const rows = history.filter(e => e.event_id === id && e.release_at < at && referenceQuarter(e) === quarter).sort((a,b) => b.release_at - a.release_at)
  return rows.length ? rows.filter(e => e.release_at === rows[0].release_at) : []
}
export function gdpStage(release: InspectorRelease, history: readonly TimedReading[]) {
  const row = release.events.find(e => e.event_id === '840010007'), quarter = row && referenceQuarter(row)
  return quarter != null && release.releaseAt !== null && latestRows(history, '840010007', quarter, release.releaseAt).length ? 'revision' : 'new-quarter'
}
export function gdpFeatures(release: InspectorRelease, history: readonly TimedReading[]) {
  const at = release.releaseAt, anchor = release.events.filter(e => e.event_id === '840010007')
  const quarter = anchor.length === 1 ? referenceQuarter(anchor[0]) : null
  const stage = gdpStage(release, history)
  return Object.fromEntries(gdpSignals.map(signal => {
    const rows = release.events.filter(e => e.event_id === signal.seriesId), row = rows[0]
    if (at === null || release.timingUncertain || quarter === null || rows.length !== 1 || row.release_at !== at || !valid(row, at) || referenceQuarter(row) !== quarter)
      return [signal.id, unavailableSignal('Requires one observed native percentage reading for the GDP reference quarter at a verified publication time.')]
    const sameQuarter = latestRows(history, signal.seriesId, quarter, at)
    let baseline: number | null = null
    if (stage === 'revision') {
      if (sameQuarter.length === 1 && valid(sameQuarter[0], at)) baseline = nativeNumber(sameQuarter[0])
    } else {
      const preceding = [1,2,3,4].map(n => {
        const prior = latestRows(history, signal.seriesId, quarter - n, at)
        return prior.length === 1 && valid(prior[0], at) ? nativeNumber(prior[0]) : null
      })
      if (preceding.every(v => v !== null)) {
        const supplied = row.revised_previous != null || row.revised_previous_raw_scaled_1e6 != null
        const revised = nativeNumber(row, 'revised_previous')
        if (!supplied || revised !== null) baseline = Math.max(0, (supplied ? [revised!, ...preceding.slice(1)] : preceding).reduce((a,b) => a + b!,0)/4)
      }
    }
    return [signal.id, baseline === null ? unavailableSignal(stage === 'revision' ? 'Requires an unambiguous earlier estimate for this quarter; no fallback to another quarter.' : 'Requires four consecutive prior quarters and a valid supplied revision.') :
      usableSignal(nativeNumber(row)! - baseline, { actual: nativeNumber(row)!, baseline, actualLabel: signal.label,
        baselineLabel: stage === 'revision' ? 'Latest earlier estimate of this quarter' : 'Prior four-quarter mean (nearest quarter revised if supplied; floor zero)', unit: '%' })]
  }))
}
